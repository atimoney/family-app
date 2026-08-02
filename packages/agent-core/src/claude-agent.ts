import Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { AgentAction, AgentLogger, ToolCall, ToolResult } from './types.js';

// ----------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------

/**
 * A tool exposed to the model. Mirrors the mcp-server ToolDefinition shape
 * structurally so registry definitions can be passed straight through.
 */
export type AgentToolSpec = {
  name: string;
  description: string;
  inputSchema: z.ZodType<unknown>;
  /**
   * When true the tool is not executed directly: the call is queued and
   * returned to the caller as a pending action requiring user confirmation.
   */
  requiresConfirmation: boolean;
};

export type RunAgentOptions = {
  client: Anthropic;
  model: string;
  maxTokens: number;
  systemPrompt: string;
  /** Prior conversation turns (text only), oldest first. */
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** The new user message. */
  message: string;
  tools: AgentToolSpec[];
  /** Executes a (non-confirmation) tool call against the registry. */
  executeTool: (toolName: string, input: Record<string, unknown>) => Promise<ToolResult>;
  logger: AgentLogger;
  /** Max model round-trips per request (default 8). */
  maxIterations?: number;
};

export type RunAgentResult = {
  /** Final natural-language reply. */
  text: string;
  /** Tools that were executed during the run. */
  actions: AgentAction[];
  /** Mutating tool calls queued for user confirmation (not executed). */
  queuedActions: ToolCall[];
  stopReason: string | null;
};

// ----------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------

const MAX_TOOL_RESULT_CHARS = 6000;

/** Anthropic tool names allow [a-zA-Z0-9_-] only; registry names use dots. */
function toApiName(name: string): string {
  return name.replace(/\./g, '__');
}

function buildApiTools(tools: AgentToolSpec[]): {
  apiTools: Anthropic.Tool[];
  nameMap: Map<string, AgentToolSpec>;
} {
  const nameMap = new Map<string, AgentToolSpec>();
  const apiTools: Anthropic.Tool[] = tools.map((tool) => {
    const apiName = toApiName(tool.name);
    nameMap.set(apiName, tool);
    const jsonSchema = zodToJsonSchema(tool.inputSchema, { $refStrategy: 'none' }) as Record<
      string,
      unknown
    >;
    delete jsonSchema.$schema;
    return {
      name: apiName,
      description: tool.requiresConfirmation
        ? `${tool.description} (Mutating action: it is queued for the user's confirmation rather than executed immediately.)`
        : tool.description,
      input_schema: jsonSchema as Anthropic.Tool.InputSchema,
    };
  });
  return { apiTools, nameMap };
}

function serializeToolResult(result: ToolResult): string {
  const body = JSON.stringify({ success: result.success, data: result.data, error: result.error });
  if (body.length <= MAX_TOOL_RESULT_CHARS) return body;
  return `${body.slice(0, MAX_TOOL_RESULT_CHARS)}... [truncated]`;
}

// ----------------------------------------------------------------------
// AGENT LOOP
// ----------------------------------------------------------------------

/**
 * Runs a native Claude tool-use loop: the model sees every registered tool
 * and decides which to call. Read-only tools execute immediately; mutating
 * tools are queued and surfaced as a pending action for the user to confirm.
 */
export async function runFamilyAgent(options: RunAgentOptions): Promise<RunAgentResult> {
  const {
    client,
    model,
    maxTokens,
    systemPrompt,
    history,
    message,
    tools,
    executeTool,
    logger,
    maxIterations = 8,
  } = options;

  const { apiTools, nameMap } = buildApiTools(tools);

  const messages: Anthropic.MessageParam[] = [
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: 'user' as const, content: message },
  ];

  const actions: AgentAction[] = [];
  const queuedActions: ToolCall[] = [];
  let finalText = '';
  let stopReason: string | null = null;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      tools: apiTools,
      messages,
    });

    stopReason = response.stop_reason;

    if (response.stop_reason === 'refusal') {
      logger.warn({ iteration }, 'Model refused the request');
      finalText = "Sorry, I can't help with that request.";
      break;
    }

    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (toolUseBlocks.length === 0) {
      finalText = textBlocks.map((block) => block.text).join('\n').trim();
      break;
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      const spec = nameMap.get(block.name);
      const input = (block.input ?? {}) as Record<string, unknown>;

      if (!spec) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: `Unknown tool "${block.name}"`,
          is_error: true,
        });
        continue;
      }

      if (spec.requiresConfirmation) {
        queuedActions.push({ toolName: spec.name, input });
        logger.info({ toolName: spec.name }, 'Mutating tool call queued for confirmation');
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content:
            'Queued for user confirmation - NOT executed yet. Do not claim this action has happened. ' +
            'Finish by telling the user exactly what will happen once they confirm.',
        });
        continue;
      }

      const result = await executeTool(spec.name, input);
      actions.push({ tool: spec.name, input, result });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: serializeToolResult(result),
        is_error: result.success ? undefined : true,
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  if (!finalText) {
    if (queuedActions.length > 0) {
      finalText = 'I have prepared the requested changes - please confirm to apply them.';
    } else {
      logger.warn({ stopReason }, 'Agent loop ended without final text');
      finalText = "Sorry, I wasn't able to complete that request. Please try rephrasing.";
    }
  }

  return { text: finalText, actions, queuedActions, stopReason };
}
