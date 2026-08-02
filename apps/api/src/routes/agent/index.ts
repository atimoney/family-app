import type { FastifyPluginAsync, FastifyBaseLogger } from "fastify";
import { randomUUID } from "node:crypto";
import {
  runFamilyAgent,
  type AgentAction,
  type AgentDomain,
  type AgentLogger,
  type AgentResponse,
  type AgentToolSpec,
  type ToolResult,
} from "@family/agent-core";
import {
  toolRegistry,
  registerTaskToolHandlers,
  registerCalendarToolHandlers,
  registerMealToolHandlers,
  registerShoppingToolHandlers,
  registerPrefsToolHandlers,
} from "@family/mcp-server";
import type { ToolContext } from "@family/mcp-server";
import authPlugin from "../../plugins/auth.js";
import {
  createTaskToolHandlers,
  createCalendarToolHandlers,
  createMealToolHandlers,
  createShoppingToolHandlers,
  createPrefsToolHandlers,
} from "../../lib/agent/index.js";
import {
  appendChatMessages,
  consumePendingAction,
  createPendingAction,
  loadChatHistory,
} from "../../lib/agent/assistant-store.js";
import { chatRequestSchema } from "./schema.js";
import { rateLimits } from "../../lib/rate-limiter.js";

// ----------------------------------------------------------------------
// TOOL POLICY
// ----------------------------------------------------------------------

/** Mutating tools are queued for explicit user confirmation before running. */
const CONFIRM_TOOLS = new Set([
  "calendar.create",
  "calendar.update",
  "calendar.batchUpdate",
  "calendar.delete",
  "tasks.create",
  "tasks.assign",
  "meals.savePlan",
  "shopping.addItems",
  "shopping.checkItems",
  "prefs.delete",
]);

/** Internal tools never exposed to the model. */
const HIDDEN_TOOLS = new Set(["system.ping", "system.listTools"]);

function buildToolSpecs(): AgentToolSpec[] {
  return toolRegistry
    .getDefinitions()
    .filter((tool) => !HIDDEN_TOOLS.has(tool.name))
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      requiresConfirmation: CONFIRM_TOOLS.has(tool.name),
    }));
}

function deriveDomain(toolNames: string[]): AgentDomain {
  for (const name of toolNames) {
    const prefix = name.split(".")[0];
    if (prefix === "calendar") return "calendar";
    if (prefix === "tasks") return "tasks";
    if (prefix === "meals") return "meals";
    if (prefix === "shopping") return "lists";
  }
  return "unknown";
}

function isDestructive(toolNames: string[]): boolean {
  return toolNames.some(
    (name) => name.includes("delete") || name.includes("batchUpdate"),
  );
}

// ----------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------

function createRequestLogger(
  baseLogger: FastifyBaseLogger,
  requestId: string,
): AgentLogger {
  return {
    info: (obj, msg) => baseLogger.info({ ...obj, requestId }, msg),
    warn: (obj, msg) => baseLogger.warn({ ...obj, requestId }, msg),
    error: (obj, msg) => baseLogger.error({ ...obj, requestId }, msg),
    debug: (obj, msg) => baseLogger.debug({ ...obj, requestId }, msg),
  };
}

type FamilyMemberSummary = {
  id: string;
  name: string;
  role: string;
};

function buildSystemPrompt(options: {
  familyName: string;
  members: FamilyMemberSummary[];
  currentMemberName: string;
  timezone: string;
}): string {
  const { familyName, members, currentMemberName, timezone } = options;
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-AU", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);

  const memberLines = members
    .map((m) => `- ${m.name} (${m.role}) [familyMemberId: ${m.id}]`)
    .join("\n");

  return `You are the household assistant for the "${familyName}" family. You help manage the shared calendar, tasks, meal plans, shopping lists, and family preferences using the tools provided.

Current date: ${today}
Timezone: ${timezone} (interpret all natural-language dates in this timezone; pass timestamps to tools as ISO 8601)
You are speaking with: ${currentMemberName}

Family members:
${memberLines}

Guidelines:
- Use tools to look up real data before answering; never invent events, tasks, or list items.
- Mutating tools (creating/updating events, tasks, plans, list items) are QUEUED for the user's confirmation rather than executed. After queuing, clearly summarize exactly what will happen once they confirm, and never claim it already happened.
- You may chain multiple tool calls to complete a request (e.g. search for events, then update them).
- Be concise and friendly. Format replies with Markdown (short lists, bold for key details).
- If a request is ambiguous (which event, which person, what time), ask a brief clarifying question instead of guessing.`;
}

function buildConfirmationText(results: AgentAction[]): string {
  const failed = results.filter((action) => !action.result.success);
  if (failed.length === 0) {
    return results.length === 1
      ? "Done! The change has been applied. ✅"
      : `Done! All ${results.length} changes have been applied. ✅`;
  }
  const failureLines = failed
    .map(
      (action) => `- ${action.tool}: ${action.result.error ?? "unknown error"}`,
    )
    .join("\n");
  const okCount = results.length - failed.length;
  return `${okCount} of ${results.length} changes were applied. These failed:\n${failureLines}`;
}

// ----------------------------------------------------------------------
// ROUTES
// ----------------------------------------------------------------------

const agentRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(authPlugin);

  // --------------------------------------------------------------------------
  // REGISTER TOOL HANDLERS (wire Prisma/Google-backed implementations into the
  // shared tool registry)
  // --------------------------------------------------------------------------
  registerTaskToolHandlers(createTaskToolHandlers({ prisma: fastify.prisma }));
  registerCalendarToolHandlers(
    createCalendarToolHandlers({
      prisma: fastify.prisma,
      googleOAuth: {
        clientId: fastify.config.GOOGLE_CLIENT_ID,
        clientSecret: fastify.config.GOOGLE_CLIENT_SECRET,
        redirectUri: fastify.config.GOOGLE_REDIRECT_URL,
      },
      tokenEncryptionKey: fastify.config.TOKEN_ENCRYPTION_KEY,
    }),
  );
  registerMealToolHandlers(createMealToolHandlers({ prisma: fastify.prisma }));
  registerShoppingToolHandlers(
    createShoppingToolHandlers({ prisma: fastify.prisma }),
  );
  registerPrefsToolHandlers(
    createPrefsToolHandlers({ prisma: fastify.prisma }),
  );
  fastify.log.info("Agent tool handlers registered");

  const toolSpecs = buildToolSpecs();
  fastify.log.info(
    { tools: toolSpecs.map((t) => t.name) },
    "Assistant tools exposed to model",
  );

  async function getUserFamilyMembership(userId: string) {
    return fastify.prisma.familyMember.findFirst({
      where: { profileId: userId, removedAt: null },
      include: { family: true, profile: true },
    });
  }

  // --------------------------------------------------------------------------
  // POST /agent/chat - Main agent conversation endpoint
  // --------------------------------------------------------------------------
  fastify.post<{
    Body: {
      message?: string;
      conversationId?: string;
      confirmationToken?: string;
      confirmed?: boolean;
      timezone?: string;
    };
  }>(
    "/chat",
    { preHandler: [fastify.authenticate, rateLimits.agentChat] },
    async (request, reply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const parsed = chatRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const membership = await getUserFamilyMembership(userId);
      if (!membership) {
        return reply
          .status(404)
          .send({
            error: "No family found. Please join or create a family first.",
          });
      }

      const requestId = randomUUID();
      const conversationId = parsed.data.conversationId ?? randomUUID();
      const logger = createRequestLogger(fastify.log, requestId);
      const timezone =
        membership.profile.timezone ?? parsed.data.timezone ?? "UTC";
      const chatScope = {
        conversationId,
        userId,
        familyId: membership.familyId,
      };

      const toolContext: ToolContext = {
        requestId,
        userId,
        familyId: membership.familyId,
        familyMemberId: membership.id,
        roles: [membership.role],
        timezone,
        logger,
      };

      const executeTool = (
        toolName: string,
        input: Record<string, unknown>,
      ): Promise<ToolResult> =>
        toolRegistry.invoke(toolName, input, toolContext);

      // ------------------------------------------------------------------------
      // CONFIRMATION FLOW - execute previously queued mutating actions
      // ------------------------------------------------------------------------
      if (parsed.data.confirmationToken && parsed.data.confirmed === true) {
        const pending = await consumePendingAction(
          fastify.prisma,
          parsed.data.confirmationToken,
          userId,
          membership.familyId,
        );

        if (!pending.found) {
          const text =
            pending.reason === "expired"
              ? "That confirmation has expired. Please ask me again."
              : "I could not find that pending action - it may have already been applied or expired. Please ask me again.";
          const response: AgentResponse = {
            text,
            actions: [],
            domain: "unknown",
            conversationId,
            requestId,
          };
          return response;
        }

        logger.info(
          { count: pending.actions.length, familyId: membership.familyId },
          "Executing confirmed actions",
        );

        const actions: AgentAction[] = [];
        for (const call of pending.actions) {
          const result = await executeTool(call.toolName, call.input);
          actions.push({ tool: call.toolName, input: call.input, result });
        }

        const text = buildConfirmationText(actions);
        await appendChatMessages(fastify.prisma, chatScope, [
          { role: "assistant", content: text },
        ]);

        const response: AgentResponse = {
          text,
          actions,
          domain: deriveDomain(actions.map((a) => a.tool)),
          conversationId,
          requestId,
        };
        return response;
      }

      // ------------------------------------------------------------------------
      // REGULAR CHAT FLOW - native Claude tool-use loop
      // ------------------------------------------------------------------------
      const message = parsed.data.message ?? "";

      if (!fastify.anthropic) {
        const response: AgentResponse = {
          text: "The AI assistant is not configured on this server yet (missing ANTHROPIC_API_KEY). Everything else in the app still works!",
          actions: [],
          domain: "unknown",
          conversationId,
          requestId,
        };
        return response;
      }

      logger.info(
        {
          userId,
          familyId: membership.familyId,
          message: message.substring(0, 100),
        },
        "Agent chat request received",
      );

      const members = await fastify.prisma.familyMember.findMany({
        where: { familyId: membership.familyId, removedAt: null },
        include: { profile: true },
      });

      const systemPrompt = buildSystemPrompt({
        familyName: membership.family.name,
        members: members.map((m) => ({
          id: m.id,
          name: m.displayName ?? m.profile?.displayName ?? "Unknown",
          role: m.role,
        })),
        currentMemberName:
          membership.displayName ??
          membership.profile?.displayName ??
          "a family member",
        timezone,
      });

      const history = await loadChatHistory(fastify.prisma, chatScope);

      let result;
      try {
        result = await runFamilyAgent({
          client: fastify.anthropic,
          model: fastify.config.AI_MODEL,
          maxTokens: fastify.config.AI_MAX_TOKENS,
          systemPrompt,
          history,
          message,
          tools: toolSpecs,
          executeTool,
          logger,
        });
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          "Assistant run failed",
        );
        return reply
          .status(502)
          .send({
            error:
              "The assistant is temporarily unavailable. Please try again.",
          });
      }

      const response: AgentResponse = {
        text: result.text,
        actions: result.actions,
        domain: deriveDomain([
          ...result.actions.map((a) => a.tool),
          ...result.queuedActions.map((a) => a.toolName),
        ]),
        conversationId,
        requestId,
      };

      if (result.queuedActions.length > 0) {
        const description =
          result.queuedActions.length === 1
            ? `Run ${result.queuedActions[0].toolName}`
            : `Apply ${result.queuedActions.length} changes`;
        const { token, expiresAt } = await createPendingAction(fastify.prisma, {
          ...chatScope,
          description,
          actions: result.queuedActions,
        });
        response.requiresConfirmation = true;
        response.pendingAction = {
          token,
          description,
          toolName: result.queuedActions[0].toolName,
          inputPreview: result.queuedActions[0].input,
          expiresAt: expiresAt.toISOString(),
          isDestructive: isDestructive(
            result.queuedActions.map((a) => a.toolName),
          ),
        };
      }

      await appendChatMessages(fastify.prisma, chatScope, [
        { role: "user", content: message },
        { role: "assistant", content: result.text },
      ]);

      return response;
    },
  );
};

export default agentRoutes;
