import type { FastifyPluginAsync, FastifyBaseLogger } from 'fastify';
import { randomUUID } from 'node:crypto';
import {
  orchestrate,
  registerAgentExecutor,
  executeTasksAgent,
  executeTasksConfirmedAction,
  executeCalendarAgent,
  executeCalendarConfirmedAction,
  executeMealsAgent,
  executeMealsConfirmedAction,
  pendingActionStore,
} from '@family/agent-core';
import type { AgentRequest, AgentRunContext, AgentLogger, ToolResult } from '@family/agent-core';
import {
  toolRegistry,
  registerTaskToolHandlers,
  registerCalendarToolHandlers,
  registerMealToolHandlers,
  registerShoppingToolHandlers,
  registerPrefsToolHandlers,
} from '@family/mcp-server';
import type { ToolContext } from '@family/mcp-server';
import authPlugin from '../../plugins/auth.js';
import {
  createTaskToolHandlers,
  createCalendarToolHandlers,
  createMealToolHandlers,
  createShoppingToolHandlers,
  createPrefsToolHandlers,
} from '../../lib/agent/index.js';
import {
  chatRequestSchema,
  mcpInvokeRequestSchema,
} from './schema.js';
import { rateLimits } from '../../lib/rate-limiter.js';

// ----------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------

/**
 * Create a child logger with requestId context.
 */
function createRequestLogger(
  baseLogger: FastifyBaseLogger,
  requestId: string
): AgentLogger {
  // Use the Fastify logger with added context
  return {
    info: (obj, msg) => baseLogger.info({ ...obj, requestId }, msg),
    warn: (obj, msg) => baseLogger.warn({ ...obj, requestId }, msg),
    error: (obj, msg) => baseLogger.error({ ...obj, requestId }, msg),
    debug: (obj, msg) => baseLogger.debug({ ...obj, requestId }, msg),
  };
}

// ----------------------------------------------------------------------
// ROUTES
// ----------------------------------------------------------------------

const agentRoutes: FastifyPluginAsync = async (fastify) => {
  // Register auth plugin
  await fastify.register(authPlugin);

  // --------------------------------------------------------------------------
  // REGISTER TASK TOOL HANDLERS
  // --------------------------------------------------------------------------
  const taskHandlers = createTaskToolHandlers({ prisma: fastify.prisma });
  registerTaskToolHandlers(taskHandlers);

  fastify.log.info('Task tool handlers registered');

  // --------------------------------------------------------------------------
  // REGISTER CALENDAR TOOL HANDLERS
  // --------------------------------------------------------------------------
  const calendarHandlers = createCalendarToolHandlers({ prisma: fastify.prisma });
  registerCalendarToolHandlers(calendarHandlers);

  fastify.log.info('Calendar tool handlers registered');

  // --------------------------------------------------------------------------
  // REGISTER MEAL TOOL HANDLERS
  // --------------------------------------------------------------------------
  const mealHandlers = createMealToolHandlers({ prisma: fastify.prisma });
  registerMealToolHandlers(mealHandlers);

  fastify.log.info('Meal tool handlers registered');

  // --------------------------------------------------------------------------
  // REGISTER SHOPPING TOOL HANDLERS
  // --------------------------------------------------------------------------
  const shoppingHandlers = createShoppingToolHandlers({ prisma: fastify.prisma });
  registerShoppingToolHandlers(shoppingHandlers);

  fastify.log.info('Shopping tool handlers registered');

  // --------------------------------------------------------------------------
  // REGISTER PREFS (MEMORY) TOOL HANDLERS
  // --------------------------------------------------------------------------
  const prefsHandlers = createPrefsToolHandlers({ prisma: fastify.prisma });
  registerPrefsToolHandlers(prefsHandlers);

  fastify.log.info('Prefs tool handlers registered');

  // --------------------------------------------------------------------------
  // REGISTER TASKS AGENT EXECUTOR
  // --------------------------------------------------------------------------
  registerAgentExecutor('tasks', async (message, context) => {
    // Create a tool executor that uses the MCP registry
    const toolExecutor = async (
      toolName: string,
      input: Record<string, unknown>
    ): Promise<ToolResult> => {
      const toolContext: ToolContext = {
        requestId: context.requestId,
        userId: context.userId,
        familyId: context.familyId,
        familyMemberId: context.familyMemberId,
        roles: context.roles ?? ['member'],
        timezone: context.timezone,
        logger: context.logger,
      };

      return toolRegistry.invoke(toolName, input, toolContext);
    };

    return executeTasksAgent(message, context, toolExecutor);
  });

  fastify.log.info('TasksAgent executor registered');

  // --------------------------------------------------------------------------
  // REGISTER CALENDAR AGENT EXECUTOR
  // --------------------------------------------------------------------------
  registerAgentExecutor('calendar', async (message, context) => {
    // Create a tool executor that uses the MCP registry
    const toolExecutor = async (
      toolName: string,
      input: Record<string, unknown>
    ): Promise<ToolResult> => {
      const toolContext: ToolContext = {
        requestId: context.requestId,
        userId: context.userId,
        familyId: context.familyId,
        familyMemberId: context.familyMemberId,
        roles: context.roles ?? ['member'],
        timezone: context.timezone,
        logger: context.logger,
      };

      return toolRegistry.invoke(toolName, input, toolContext);
    };

    return executeCalendarAgent(message, context, toolExecutor);
  });

  fastify.log.info('CalendarAgent executor registered');

  // --------------------------------------------------------------------------
  // REGISTER MEALS AGENT EXECUTOR
  // --------------------------------------------------------------------------
  registerAgentExecutor('meals', async (message, context) => {
    // Create a tool executor that uses the MCP registry
    const toolExecutor = async (
      toolName: string,
      input: Record<string, unknown>
    ): Promise<ToolResult> => {
      const toolContext: ToolContext = {
        requestId: context.requestId,
        userId: context.userId,
        familyId: context.familyId,
        familyMemberId: context.familyMemberId,
        roles: context.roles ?? ['member'],
        timezone: context.timezone,
        logger: context.logger,
      };

      return toolRegistry.invoke(toolName, input, toolContext);
    };

    return executeMealsAgent(message, context, toolExecutor);
  });

  fastify.log.info('MealsAgent executor registered');

  // Helper to get user's family membership
  async function getUserFamilyMembership(userId: string) {
    const membership = await fastify.prisma.familyMember.findFirst({
      where: {
        profileId: userId,
        removedAt: null,
      },
      include: {
        family: true,
        profile: true,
      },
    });
    return membership;
  }

  // --------------------------------------------------------------------------
  // POST /agent/chat - Main agent conversation endpoint
  // --------------------------------------------------------------------------
  fastify.post<{
    Body: {
      message: string;
      conversationId?: string;
      domainHint?: string;
      confirmationToken?: string;
      confirmed?: boolean;
    };
  }>('/chat', { preHandler: [fastify.authenticate, rateLimits.agentChat] }, async (request, reply) => {
    const userId = request.user?.id;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Validate request body
    const parsed = chatRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const membership = await getUserFamilyMembership(userId);
    if (!membership) {
      return reply.status(404).send({ error: 'No family found. Please join or create a family first.' });
    }

    const requestId = randomUUID();
    const conversationId = parsed.data.conversationId ?? randomUUID();
    const logger = createRequestLogger(fastify.log, requestId);

    // Build agent run context
    const context: AgentRunContext = {
      requestId,
      userId,
      familyId: membership.familyId,
      familyMemberId: membership.id,
      roles: [membership.role],
      timezone: membership.profile.timezone ?? undefined,
      conversationId,
      logger,
    };

    // --------------------------------------------------------------------------
    // HANDLE CONFIRMATION FLOW
    // --------------------------------------------------------------------------
    if (parsed.data.confirmationToken && parsed.data.confirmed === true) {
      logger.info(
        {
          userId,
          familyId: membership.familyId,
          token: parsed.data.confirmationToken,
        },
        'Processing confirmation request'
      );

      // Create a tool executor for the confirmed action
      const toolExecutor = async (
        toolName: string,
        input: Record<string, unknown>
      ): Promise<ToolResult> => {
        const toolContext: ToolContext = {
          requestId: context.requestId,
          userId: context.userId,
          familyId: context.familyId,
          familyMemberId: context.familyMemberId,
          roles: context.roles ?? ['member'],
          timezone: context.timezone,
          logger: context.logger,
        };
        return toolRegistry.invoke(toolName, input, toolContext);
      };

      // Peek at the pending action to determine which agent's confirmed handler to use
      const pendingResult = pendingActionStore.get(
        parsed.data.confirmationToken,
        context.userId,
        context.familyId
      );

      // Determine domain from pending action tool name
      let domain: 'tasks' | 'calendar' | 'meals' = 'tasks';
      let executeConfirmedFn = executeTasksConfirmedAction;

      if (pendingResult.found) {
        const toolName = pendingResult.action.toolCall.toolName;
        if (toolName.startsWith('calendar.')) {
          domain = 'calendar';
          executeConfirmedFn = executeCalendarConfirmedAction;
        } else if (toolName.startsWith('meals.') || toolName.startsWith('shopping.')) {
          domain = 'meals';
          executeConfirmedFn = executeMealsConfirmedAction;
        }
      }

      // Execute the confirmed action using the appropriate agent
      const result = await executeConfirmedFn(
        parsed.data.confirmationToken,
        context,
        toolExecutor
      );

      return {
        text: result.text,
        actions: result.actions,
        payload: result.payload,
        domain,
        conversationId,
        requestId,
        requiresConfirmation: result.requiresConfirmation,
        pendingAction: result.pendingAction,
      };
    }

    // --------------------------------------------------------------------------
    // REGULAR CHAT FLOW
    // --------------------------------------------------------------------------
    // At this point, message should be defined (validated by schema refine)
    const message = parsed.data.message ?? '';
    
    logger.info(
      {
        userId,
        familyId: membership.familyId,
        message: message.substring(0, 100),
      },
      'Agent chat request received'
    );

    // Build agent request
    const agentRequest: AgentRequest = {
      message,
      conversationId,
      domainHint: parsed.data.domainHint as AgentRequest['domainHint'],
    };

    // Orchestrate the request
    const response = await orchestrate(agentRequest, context);

    return response;
  });

  // --------------------------------------------------------------------------
  // POST /mcp/invoke - Direct tool invocation endpoint
  // --------------------------------------------------------------------------
  fastify.post<{
    Body: { toolName: string; input: Record<string, unknown> };
  }>('/mcp/invoke', { preHandler: [fastify.authenticate, rateLimits.mcpInvoke] }, async (request, reply) => {
    const userId = request.user?.id;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Validate request body
    const parsed = mcpInvokeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const membership = await getUserFamilyMembership(userId);
    if (!membership) {
      return reply.status(404).send({ error: 'No family found. Please join or create a family first.' });
    }

    const requestId = randomUUID();
    const logger = createRequestLogger(fastify.log, requestId);

    logger.info(
      {
        userId,
        familyId: membership.familyId,
        toolName: parsed.data.toolName,
      },
      'MCP tool invocation request received'
    );

    // Build tool context
    const toolContext: ToolContext = {
      requestId,
      userId,
      familyId: membership.familyId,
      familyMemberId: membership.id,
      roles: [membership.role],
      timezone: membership.profile.timezone ?? undefined,
      logger,
    };

    // Invoke the tool
    const result = await toolRegistry.invoke(
      parsed.data.toolName,
      parsed.data.input,
      toolContext
    );

    return {
      toolName: parsed.data.toolName,
      requestId,
      result,
    };
  });

  // --------------------------------------------------------------------------
  // GET /mcp/tools - List available tools
  // --------------------------------------------------------------------------
  fastify.get('/mcp/tools', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user?.id;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const tools = toolRegistry.getAllTools();

    return { tools };
  });
};

export default agentRoutes;
