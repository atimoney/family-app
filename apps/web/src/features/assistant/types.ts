// ----------------------------------------------------------------------
// AGENT CORE TYPES (copied from packages/agent-core for web app usage)
// ----------------------------------------------------------------------

/** Domain that an agent can handle. */
export type AgentDomain = 'tasks' | 'calendar' | 'meals' | 'lists' | 'unknown';

/** Result from executing a tool. */
export type ToolResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  executionMs?: number;
};

/** An action that was executed during agent processing. */
export type AgentAction = {
  tool: string;
  input: Record<string, unknown>;
  result: ToolResult;
};

/** Pending action awaiting confirmation. */
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

/** Incoming request to the agent system. */
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
  /** User's timezone (e.g., 'America/New_York') */
  timezone?: string;
};

/** Response from the agent system. */
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

// ----------------------------------------------------------------------
// CHAT MESSAGE TYPES
// ----------------------------------------------------------------------

/** Message roles in the conversation */
export type MessageRole = 'user' | 'assistant' | 'system';

/** Message status for optimistic updates and error handling */
export type MessageStatus = 'sending' | 'sent' | 'error';

/**
 * A single chat message in the assistant conversation.
 */
export type ChatMessage = {
  /** Unique message ID */
  id: string;
  /** Who sent the message */
  role: MessageRole;
  /** Message text content */
  content: string;
  /** ISO timestamp */
  timestamp: string;
  /** For UI state (sending, sent, error) */
  status: MessageStatus;

  // Optional fields for assistant messages
  /** Domain that handled the request */
  domain?: AgentDomain;
  /** Executed tool actions */
  actions?: AgentAction[];
  /** Structured data payload */
  payload?: Record<string, unknown>;

  // Confirmation-specific fields
  /** Whether this message requires user confirmation */
  requiresConfirmation?: boolean;
  /** Details about the pending action */
  pendingAction?: PendingActionInfo;

  // Error information
  /** Error message if status is 'error' */
  error?: string;
};

/**
 * Conversation state for the assistant.
 */
export type Conversation = {
  /** UUID for conversation continuity with backend */
  id: string;
  /** All messages in chronological order */
  messages: ChatMessage[];
  /** When conversation started */
  createdAt: string;
  /** Last activity */
  updatedAt: string;
};

// ----------------------------------------------------------------------
// QUICK ACTIONS
// ----------------------------------------------------------------------

/**
 * A quick action chip that users can click to send a predefined prompt.
 */
export type QuickAction = {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Prompt text to send */
  prompt: string;
  /** Optional icon name (Iconify) */
  icon?: string;
};

/**
 * Default quick actions shown above the composer.
 */
export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'create-task',
    label: 'Create task',
    prompt: 'Create a new task',
    icon: 'solar:bill-list-bold',
  },
  {
    id: 'list-tasks',
    label: 'List tasks',
    prompt: 'Show my pending tasks',
    icon: 'solar:list-bold',
  },
  {
    id: 'today',
    label: "What's on today?",
    prompt: "What's on the calendar today?",
    icon: 'solar:calendar-date-bold',
  },
  {
    id: 'plan-meals',
    label: 'Plan meals',
    prompt: 'Help me plan meals for this week',
    icon: 'solar:tea-cup-bold',
  },
];
