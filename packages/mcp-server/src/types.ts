import { z } from 'zod';

// ----------------------------------------------------------------------
// TOOL CONTEXT
// ----------------------------------------------------------------------

/**
 * Context provided to every tool invocation.
 */
export type ToolContext = {
  /** Unique request ID for tracing */
  requestId: string;
  /** Authenticated user ID */
  userId: string;
  /** Family ID the user belongs to */
  familyId: string;
  /** Family member ID for assignment operations */
  familyMemberId: string;
  /** User's roles/permissions */
  roles: string[];
  /** User's timezone */
  timezone?: string;
  /** Structured logger */
  logger: ToolLogger;
};

/**
 * Minimal structured logger interface for tools.
 */
export type ToolLogger = {
  info: (obj: Record<string, unknown>, msg?: string) => void;
  warn: (obj: Record<string, unknown>, msg?: string) => void;
  error: (obj: Record<string, unknown>, msg?: string) => void;
  debug: (obj: Record<string, unknown>, msg?: string) => void;
};

// ----------------------------------------------------------------------
// TOOL RESULT
// ----------------------------------------------------------------------

/**
 * Result from executing a tool.
 */
export type ToolResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  executionMs?: number;
};

export const toolResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  executionMs: z.number().optional(),
});

// ----------------------------------------------------------------------
// TOOL DEFINITION
// ----------------------------------------------------------------------

/**
 * Definition for a tool in the registry.
 */
export type ToolDefinition<TInput = unknown, TOutput = unknown> = {
  /** Unique tool name (namespaced, e.g., 'system.ping', 'tasks.create') */
  name: string;
  /** Human-readable description */
  description: string;
  /** Zod schema for input validation */
  inputSchema: z.ZodType<TInput>;
  /** Zod schema for output validation */
  outputSchema: z.ZodType<TOutput>;
  /** The tool execution function */
  execute: (input: TInput, context: ToolContext) => Promise<ToolResult<TOutput>>;
};

// ----------------------------------------------------------------------
// TOOL INVOKE REQUEST/RESPONSE
// ----------------------------------------------------------------------

/**
 * Request to invoke a tool.
 */
export type ToolInvokeRequest = {
  toolName: string;
  input: Record<string, unknown>;
};

export const toolInvokeRequestSchema = z.object({
  toolName: z.string().min(1),
  input: z.record(z.unknown()),
});

/**
 * Response from invoking a tool.
 */
export type ToolInvokeResponse = {
  toolName: string;
  requestId: string;
  result: ToolResult;
};

export const toolInvokeResponseSchema = z.object({
  toolName: z.string(),
  requestId: z.string(),
  result: toolResultSchema,
});
