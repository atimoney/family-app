import { z } from 'zod';

// ----------------------------------------------------------------------
// CORE TYPES
// ----------------------------------------------------------------------

/**
 * Domain that an agent can handle.
 */
export type AgentDomain = 'tasks' | 'calendar' | 'meals' | 'lists' | 'unknown';

/**
 * Intent routing result from the router.
 */
export type IntentRoute = {
  domain: AgentDomain;
  confidence: number; // 0-1
  reasons: string[];
};

/**
 * A single tool invocation requested by an agent.
 */
export type ToolCall = {
  toolName: string;
  input: Record<string, unknown>;
};

/**
 * Result from executing a tool.
 */
export type ToolResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  executionMs?: number;
};

/**
 * An action that was executed during agent processing.
 */
export type AgentAction = {
  tool: string;
  input: Record<string, unknown>;
  result: ToolResult;
};

/**
 * Incoming request to the agent system.
 */
export type AgentRequest = {
  /** The user's natural language message */
  message: string;
  /** Optional conversation ID for context continuity */
  conversationId?: string;
  /** Optional hint to route to a specific domain */
  domainHint?: AgentDomain;
  /** Confirmation token for a pending action */
  confirmationToken?: string;
  /** Explicit confirmation flag (must be true to execute) */
  confirmed?: boolean;
};

/**
 * Pending action awaiting confirmation.
 */
export type PendingActionInfo = {
  /** Confirmation token to send back */
  token: string;
  /** Human-readable description of the action */
  description: string;
  /** The tool that will be called */
  toolName: string;
  /** Preview of the input (sanitized) */
  inputPreview: Record<string, unknown>;
  /** When the token expires */
  expiresAt: string;
  /** Whether this is a destructive action */
  isDestructive: boolean;
};

/**
 * Response from the agent system.
 */
export type AgentResponse = {
  /** Natural language response to the user */
  text: string;
  /** Actions that were executed */
  actions: AgentAction[];
  /** Structured payload for UI rendering (optional) */
  payload?: Record<string, unknown>;
  /** The domain that handled the request */
  domain: AgentDomain;
  /** Conversation ID for context continuity */
  conversationId: string;
  /** Request ID for tracing */
  requestId: string;
  /** Whether this response requires user confirmation before proceeding */
  requiresConfirmation?: boolean;
  /** Details about the pending action (if requiresConfirmation is true) */
  pendingAction?: PendingActionInfo;
};

/**
 * Context available during an agent run.
 */
export type AgentRunContext = {
  /** Unique request ID for tracing */
  requestId: string;
  /** User ID from auth */
  userId: string;
  /** Family ID the user belongs to */
  familyId: string;
  /** Family member ID for assignment operations */
  familyMemberId: string;
  /** User's timezone (e.g., 'America/New_York') */
  timezone?: string;
  /** Conversation ID for context continuity */
  conversationId: string;
  /** Structured logger */
  logger: AgentLogger;
};

/**
 * Minimal structured logger interface.
 */
export type AgentLogger = {
  info: (obj: Record<string, unknown>, msg?: string) => void;
  warn: (obj: Record<string, unknown>, msg?: string) => void;
  error: (obj: Record<string, unknown>, msg?: string) => void;
  debug: (obj: Record<string, unknown>, msg?: string) => void;
};

// ----------------------------------------------------------------------
// ZOD SCHEMAS
// ----------------------------------------------------------------------

export const agentDomainSchema = z.enum(['tasks', 'calendar', 'meals', 'lists', 'unknown']);

export const agentRequestSchema = z.object({
  message: z.string().min(1, 'Message is required').max(4000),
  conversationId: z.string().optional(),
  domainHint: agentDomainSchema.optional(),
  confirmationToken: z.string().regex(/^pa_[a-f0-9]{32}$/, 'Invalid confirmation token format').optional(),
  confirmed: z.boolean().optional(),
});

export const toolCallSchema = z.object({
  toolName: z.string(),
  input: z.record(z.unknown()),
});

export const toolResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  executionMs: z.number().optional(),
});

export const agentActionSchema = z.object({
  tool: z.string(),
  input: z.record(z.unknown()),
  result: toolResultSchema,
});

export const pendingActionInfoSchema = z.object({
  token: z.string(),
  description: z.string(),
  toolName: z.string(),
  inputPreview: z.record(z.unknown()),
  expiresAt: z.string(),
  isDestructive: z.boolean(),
});

export const agentResponseSchema = z.object({
  text: z.string(),
  actions: z.array(agentActionSchema),
  payload: z.record(z.unknown()).optional(),
  domain: agentDomainSchema,
  conversationId: z.string(),
  requestId: z.string(),
  requiresConfirmation: z.boolean().optional(),
  pendingAction: pendingActionInfoSchema.optional(),
});
