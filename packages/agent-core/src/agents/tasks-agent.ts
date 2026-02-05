import type { AgentRunContext, AgentAction, ToolResult, ToolCall, PendingActionInfo } from '../types.js';
import { extractDateTimeFromMessage } from '../utils/date-parser.js';
import {
  pendingActionStore,
  isWriteTool,
  isDestructiveTool,
  CONFIDENCE_THRESHOLD,
} from '../confirmation.js';

// ----------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------

export type TasksAgentResult = {
  text: string;
  actions: AgentAction[];
  payload?: Record<string, unknown>;
  /** If true, response requires user confirmation */
  requiresConfirmation?: boolean;
  /** Details about pending action */
  pendingAction?: PendingActionInfo;
};

/**
 * Parsed intent from user message.
 */
type TaskIntent =
  | { type: 'create'; title: string; dueAt: string | null; assignee: string | null; notes: string | null; priority: string | null; needsClarification: 'date' | null; confidence: number }
  | { type: 'list'; status: 'open' | 'done' | null; assignee: string | null; confidence: number }
  | { type: 'complete'; taskTitle: string | null; taskId: string | null; confidence: number }
  | { type: 'assign'; taskTitle: string | null; taskId: string | null; assignee: string | null; confidence: number }
  | { type: 'unclear'; confidence: number };

/**
 * Tool executor function injected by the API layer.
 */
export type ToolExecutor = (
  toolName: string,
  input: Record<string, unknown>
) => Promise<ToolResult>;

/**
 * Loaded preferences for the tasks agent.
 */
type TasksPreferences = {
  defaultAssignee?: string;
  defaultDueTime?: string; // HH:mm format
  defaultReminderOffset?: number; // minutes
  defaultPriority?: 'low' | 'medium' | 'high' | 'urgent';
};

// Preference keys for tasks domain
const TASKS_PREF_KEYS = {
  DEFAULT_ASSIGNEE: 'tasks.defaultAssignee',
  DEFAULT_DUE_TIME: 'tasks.defaultDueTime',
  DEFAULT_REMINDER_OFFSET: 'tasks.defaultReminderOffset',
  DEFAULT_PRIORITY: 'tasks.defaultPriority',
};

// ----------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------

/**
 * Load tasks-related preferences using the prefs.getBulk tool.
 */
async function loadTasksPreferences(
  toolExecutor: ToolExecutor
): Promise<TasksPreferences> {
  const prefs: TasksPreferences = {};

  try {
    const result = await toolExecutor('prefs.getBulk', {
      requests: [
        { scope: 'family', key: TASKS_PREF_KEYS.DEFAULT_ASSIGNEE },
        { scope: 'family', key: TASKS_PREF_KEYS.DEFAULT_DUE_TIME },
        { scope: 'family', key: TASKS_PREF_KEYS.DEFAULT_REMINDER_OFFSET },
        { scope: 'family', key: TASKS_PREF_KEYS.DEFAULT_PRIORITY },
      ],
    });

    if (result.success && result.data) {
      const data = result.data as { results: Record<string, unknown> };
      const r = data.results;

      if (typeof r[TASKS_PREF_KEYS.DEFAULT_ASSIGNEE] === 'string') {
        prefs.defaultAssignee = r[TASKS_PREF_KEYS.DEFAULT_ASSIGNEE] as string;
      }
      if (typeof r[TASKS_PREF_KEYS.DEFAULT_DUE_TIME] === 'string') {
        prefs.defaultDueTime = r[TASKS_PREF_KEYS.DEFAULT_DUE_TIME] as string;
      }
      if (typeof r[TASKS_PREF_KEYS.DEFAULT_REMINDER_OFFSET] === 'number') {
        prefs.defaultReminderOffset = r[TASKS_PREF_KEYS.DEFAULT_REMINDER_OFFSET] as number;
      }
      if (typeof r[TASKS_PREF_KEYS.DEFAULT_PRIORITY] === 'string') {
        const p = r[TASKS_PREF_KEYS.DEFAULT_PRIORITY] as string;
        if (['low', 'medium', 'high', 'urgent'].includes(p)) {
          prefs.defaultPriority = p as TasksPreferences['defaultPriority'];
        }
      }
    }
  } catch (err) {
    // Preferences are optional, continue without them
  }

  return prefs;
}

/**
 * Parse user message into a structured task intent.
 * This is a deterministic rule-based parser.
 */
function parseTaskIntent(message: string, context: AgentRunContext): TaskIntent {
  const lower = message.toLowerCase();

  // CREATE patterns - ordered by specificity (more specific = higher confidence)
  const createPatterns: Array<{ pattern: RegExp; confidence: number }> = [
    { pattern: /^(?:create|add|new|make)\s+(?:a\s+)?task[:\s]+(.+)$/i, confidence: 0.95 },
    { pattern: /^task[:\s]+(.+)$/i, confidence: 0.90 },
    { pattern: /^(?:remind|reminder)[:\s]+(.+)$/i, confidence: 0.85 },
    { pattern: /^(?:i need to|need to|gotta|have to)\s+(.+)$/i, confidence: 0.75 },
  ];

  for (const { pattern, confidence } of createPatterns) {
    const match = message.match(pattern);
    if (match) {
      const remainder = match[1].trim();
      return parseCreateIntent(remainder, context, confidence);
    }
  }

  // LIST patterns
  if (/(?:show|list|what|get|find|see)\s+(?:my\s+)?(?:all\s+)?(?:open\s+)?tasks?/i.test(lower)) {
    let status: 'open' | 'done' | null = null;
    if (/done|completed|finished/i.test(lower)) {
      status = 'done';
    } else if (/open|pending|active|todo/i.test(lower)) {
      status = 'open';
    }

    // Check for assignee filter
    let assignee: string | null = null;
    const assignedMatch = lower.match(/assigned\s+to\s+(\w+)/i);
    if (assignedMatch) {
      assignee = assignedMatch[1];
    } else if (/\bmy\b/i.test(lower)) {
      assignee = 'me'; // Will be resolved to current user
    }

    // List is read-only, high confidence
    return { type: 'list', status, assignee, confidence: 0.95 };
  }

  // COMPLETE patterns
  const completePatterns: Array<{ pattern: RegExp; confidence: number }> = [
    { pattern: /^(?:complete|done|finish|mark\s+(?:as\s+)?done)[:\s]+(.+)$/i, confidence: 0.90 },
    { pattern: /^(?:i\s+)?(?:finished|completed|done\s+with)[:\s]+(.+)$/i, confidence: 0.85 },
  ];

  for (const { pattern, confidence } of completePatterns) {
    const match = message.match(pattern);
    if (match) {
      return { type: 'complete', taskTitle: match[1].trim(), taskId: null, confidence };
    }
  }

  // ASSIGN patterns
  const assignPatterns: Array<{ pattern: RegExp; confidence: number }> = [
    { pattern: /^assign\s+["']?(.+?)["']?\s+to\s+(\w+)$/i, confidence: 0.90 },
    { pattern: /^give\s+["']?(.+?)["']?\s+to\s+(\w+)$/i, confidence: 0.80 },
  ];

  for (const { pattern, confidence } of assignPatterns) {
    const match = message.match(pattern);
    if (match) {
      return { type: 'assign', taskTitle: match[1].trim(), taskId: null, assignee: match[2], confidence };
    }
  }

  // If message contains task-related keywords but no clear action
  if (/task|todo|remind/i.test(lower)) {
    // Default to create if it looks like a task description
    if (lower.length > 5 && !/\?$/.test(lower)) {
      // Lower confidence for implicit creates
      return parseCreateIntent(message, context, 0.65);
    }
  }

  return { type: 'unclear', confidence: 0.0 };
}

/**
 * Parse a create intent from the remainder of the message.
 */
function parseCreateIntent(remainder: string, context: AgentRunContext, baseConfidence: number): TaskIntent {
  // Extract due date
  const dateResult = extractDateTimeFromMessage(remainder, new Date(), context.timezone);

  // Extract title (remove date portion)
  let title = remainder;
  if (dateResult.extracted) {
    // Remove date-related phrases
    title = title.replace(new RegExp(`(?:due|by|on|at|for)?\\s*${escapeRegex(dateResult.extracted)}`, 'i'), '').trim();
  }

  // Clean up common phrases
  title = title
    .replace(/\s+due\s*$/i, '')
    .replace(/\s+by\s*$/i, '')
    .replace(/\s+for\s*$/i, '')
    .trim();

  // Extract priority
  let priority: string | null = null;
  const priorityMatch = title.match(/\b(urgent|high\s+priority|low\s+priority)\b/i);
  if (priorityMatch) {
    const p = priorityMatch[1].toLowerCase();
    if (p === 'urgent') priority = 'urgent';
    else if (p === 'high priority') priority = 'high';
    else if (p === 'low priority') priority = 'low';
    title = title.replace(priorityMatch[0], '').trim();
  }

  // Extract potential assignee (e.g., "for Eddy", "assign to Mom")
  let assignee: string | null = null;
  const assigneeMatch = title.match(/(?:for|assign\s+to|to)\s+([A-Z][a-z]+)(?:\s|$)/);
  if (assigneeMatch) {
    assignee = assigneeMatch[1];
    // Don't remove from title yet - might be part of the task description
  }

  // Calculate final confidence
  let confidence = baseConfidence;

  // Reduce confidence if date parsing was uncertain
  if (dateResult.extracted && !dateResult.confident) {
    confidence *= 0.8;
  }

  // Reduce confidence if title is very short or generic
  if (title.length < 5) {
    confidence *= 0.7;
  }

  // Reduce confidence if title has question marks
  if (title.includes('?')) {
    confidence *= 0.5;
  }

  // If date was found but not confident, ask for clarification
  const needsClarification = dateResult.extracted && !dateResult.confident ? 'date' as const : null;

  return {
    type: 'create',
    title: title || remainder, // Fall back to original if parsing removed everything
    dueAt: dateResult.confident ? dateResult.datetime : null,
    assignee,
    notes: null,
    priority,
    needsClarification,
    confidence,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ----------------------------------------------------------------------
// TASKS AGENT EXECUTOR
// ----------------------------------------------------------------------

/**
 * Execute a confirmed pending action.
 * Called when user provides confirmationToken + confirmed: true.
 */
export async function executeConfirmedAction(
  confirmationToken: string,
  context: AgentRunContext,
  toolExecutor: ToolExecutor
): Promise<TasksAgentResult> {
  // Consume (get and delete) the pending action
  const result = pendingActionStore.consume(
    confirmationToken,
    context.userId,
    context.familyId
  );

  if (!result.found) {
    // Log the actual reason for debugging, but return generic message to client
    // to prevent token enumeration attacks
    context.logger.warn(
      { token: confirmationToken, reason: result.reason },
      'TasksAgent: confirmation validation failed'
    );

    return {
      text: '❌ This confirmation is invalid or has expired. Please try your request again.',
      actions: [],
      payload: { error: 'invalid_confirmation' },
    };
  }

  const { action: pendingAction } = result;

  context.logger.info(
    {
      token: confirmationToken,
      toolName: pendingAction.toolCall.toolName,
      originalRequestId: pendingAction.requestId,
    },
    'TasksAgent: executing confirmed action'
  );

  // Execute the tool
  const toolResult = await toolExecutor(
    pendingAction.toolCall.toolName,
    pendingAction.toolCall.input
  );

  const agentAction: AgentAction = {
    tool: pendingAction.toolCall.toolName,
    input: pendingAction.toolCall.input,
    result: toolResult,
  };

  if (toolResult.success) {
    // Format success message based on tool
    const toolName = pendingAction.toolCall.toolName;

    if (toolName === 'tasks.create' && toolResult.data) {
      const task = (toolResult.data as { task: { title: string; dueAt?: string | null } }).task;
      const dueStr = task.dueAt
        ? ` Due: ${new Date(task.dueAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
        : '';
      return {
        text: `✅ Created task: "${task.title}"${dueStr}`,
        actions: [agentAction],
        payload: { task },
      };
    }

    if (toolName === 'tasks.complete') {
      return {
        text: `✅ Task marked as complete.`,
        actions: [agentAction],
        payload: { success: true },
      };
    }

    // Generic success
    return {
      text: `✅ Action completed successfully.`,
      actions: [agentAction],
      payload: toolResult.data as Record<string, unknown> | undefined,
    };
  } else {
    return {
      text: `❌ Sorry, the action failed. ${toolResult.error || 'Please try again.'}`,
      actions: [agentAction],
      payload: { error: toolResult.error },
    };
  }
}

/**
 * Execute the TasksAgent.
 *
 * Flow:
 * 1. Parse user message into intent
 * 2. If clarification needed, ask user
 * 3. Generate tool call(s)
 * 4. Execute via MCP registry
 * 5. Format response
 */
export async function executeTasksAgent(
  message: string,
  context: AgentRunContext,
  toolExecutor: ToolExecutor
): Promise<TasksAgentResult> {
  const intent = parseTaskIntent(message, context);

  context.logger.debug({ intent, message }, 'TasksAgent: parsed intent');

  switch (intent.type) {
    case 'create':
      return handleCreateIntent(intent, context, toolExecutor);
    case 'list':
      return handleListIntent(intent, context, toolExecutor);
    case 'complete':
      return handleCompleteIntent(intent, context, toolExecutor);
    case 'assign':
      return handleAssignIntent(intent, context, toolExecutor);
    case 'unclear':
    default:
      return {
        text: "I'm not sure what you'd like me to do. I can help you:\n" +
          "- Create a task: \"Create a task: buy groceries tomorrow\"\n" +
          "- List tasks: \"Show my tasks\" or \"What tasks are due today?\"\n" +
          "- Complete a task: \"Mark done: buy groceries\"\n" +
          "- Assign a task: \"Assign groceries to Mom\"\n\n" +
          "What would you like to do?",
        actions: [],
        payload: { needsInput: true },
      };
  }
}

// ----------------------------------------------------------------------
// INTENT HANDLERS
// ----------------------------------------------------------------------

/**
 * Check if confirmation is required for this action.
 * Write operations require confirmation if:
 * - Confidence is below threshold, OR
 * - Action is destructive
 */
function requiresConfirmation(
  toolName: string,
  confidence: number,
  isDestructive: boolean
): boolean {
  // Read operations never need confirmation
  if (!isWriteTool(toolName)) {
    return false;
  }

  // Destructive actions always need confirmation
  if (isDestructive) {
    return true;
  }

  // Low confidence needs confirmation
  if (confidence < CONFIDENCE_THRESHOLD) {
    return true;
  }

  return false;
}

/**
 * Create a pending action and return confirmation result.
 */
function createPendingConfirmation(
  toolName: string,
  input: Record<string, unknown>,
  description: string,
  context: AgentRunContext,
  isDestructive: boolean
): TasksAgentResult {
  const toolCall: ToolCall = { toolName, input };
  
  const pendingAction = pendingActionStore.create({
    userId: context.userId,
    familyId: context.familyId,
    requestId: context.requestId,
    conversationId: context.conversationId,
    toolCall,
    description,
    isDestructive,
    ttlMs: 5 * 60 * 1000, // 5 minutes
  });

  const pendingActionInfo: PendingActionInfo = {
    token: pendingAction.token,
    description: pendingAction.description,
    toolName: pendingAction.toolCall.toolName,
    inputPreview: pendingAction.toolCall.input,
    expiresAt: new Date(pendingAction.createdAt.getTime() + pendingAction.ttlMs).toISOString(),
    isDestructive: pendingAction.isDestructive,
  };

  return {
    text: description + '\n\nPlease confirm to proceed, or say "cancel" to abort.',
    actions: [],
    payload: { confirmationRequired: true },
    requiresConfirmation: true,
    pendingAction: pendingActionInfo,
  };
}

async function handleCreateIntent(
  intent: Extract<TaskIntent, { type: 'create' }>,
  context: AgentRunContext,
  toolExecutor: ToolExecutor
): Promise<TasksAgentResult> {
  // If clarification needed, ask user
  if (intent.needsClarification === 'date') {
    return {
      text: `I'd like to create the task "${intent.title}", but I'm not sure about the exact due date. ` +
        `Could you specify when it's due? For example:\n` +
        `- "tomorrow at 5pm"\n` +
        `- "next Monday"\n` +
        `- "in 3 days"`,
      actions: [],
      payload: {
        pendingTask: {
          title: intent.title,
          assignee: intent.assignee,
          priority: intent.priority,
        },
        awaitingInput: 'dueDate',
      },
    };
  }

  // Load preferences to apply defaults
  const prefs = await loadTasksPreferences(toolExecutor);

  context.logger.debug(
    { prefs, requestId: context.requestId },
    'TasksAgent loaded preferences'
  );

  // Build the tool input, applying preference defaults
  const priority = intent.priority ?? prefs.defaultPriority ?? 'medium';
  const input: Record<string, unknown> = {
    title: intent.title,
    priority,
  };

  // Apply due date with default time if needed
  if (intent.dueAt) {
    let dueAt = intent.dueAt;
    // If due date has no time component and we have a default time preference
    if (prefs.defaultDueTime && !intent.dueAt.includes('T')) {
      dueAt = `${intent.dueAt}T${prefs.defaultDueTime}:00`;
    }
    input.dueAt = dueAt;
  }

  if (intent.notes) {
    input.notes = intent.notes;
  }

  // Apply default assignee if not specified
  if (intent.assignee) {
    input.assignedTo = intent.assignee;
  } else if (prefs.defaultAssignee) {
    input.assignedTo = prefs.defaultAssignee;
  }

  // Check if confirmation is required
  const toolName = 'tasks.create';
  const needsConfirmation = requiresConfirmation(toolName, intent.confidence, false);

  if (needsConfirmation) {
    const dueStr = input.dueAt
      ? ` due ${new Date(input.dueAt as string).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
      : '';
    const description = `I'll create a task: "${intent.title}"${dueStr} with ${priority} priority.`;

    context.logger.info(
      { toolName, confidence: intent.confidence, title: intent.title },
      'TasksAgent: requesting confirmation for create'
    );

    return createPendingConfirmation(toolName, input, description, context, false);
  }

  // Execute the tool directly (high confidence, non-destructive)
  const result = await toolExecutor(toolName, input);

  const action: AgentAction = {
    tool: toolName,
    input,
    result,
  };

  if (result.success && result.data) {
    const task = (result.data as { task: { id: string; title: string; dueAt?: string | null } }).task;
    const dueStr = task.dueAt
      ? ` Due: ${new Date(task.dueAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
      : '';

    return {
      text: `✅ Created task: "${task.title}"${dueStr}`,
      actions: [action],
      payload: { task },
    };
  } else {
    return {
      text: `❌ Sorry, I couldn't create the task. ${result.error || 'Please try again.'}`,
      actions: [action],
      payload: { error: result.error },
    };
  }
}

async function handleListIntent(
  intent: Extract<TaskIntent, { type: 'list' }>,
  context: AgentRunContext,
  toolExecutor: ToolExecutor
): Promise<TasksAgentResult> {
  const input: Record<string, unknown> = {};

  if (intent.status) {
    input.status = intent.status;
  }

  if (intent.assignee === 'me') {
    input.assignedToUserId = context.familyMemberId;
  }

  const result = await toolExecutor('tasks.list', input);

  const action: AgentAction = {
    tool: 'tasks.list',
    input,
    result,
  };

  if (result.success && result.data) {
    const data = result.data as { items: Array<{ id: string; title: string; status: string; dueAt?: string | null; assignedToName?: string | null }>; total: number };

    if (data.items.length === 0) {
      const filterDesc = intent.status === 'done' ? 'completed ' : intent.status === 'open' ? 'open ' : '';
      return {
        text: `No ${filterDesc}tasks found.`,
        actions: [action],
        payload: { tasks: [] },
      };
    }

    const taskLines = data.items.slice(0, 10).map((t, i) => {
      const status = t.status === 'done' ? '✓' : '○';
      const due = t.dueAt
        ? ` (due ${new Date(t.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
        : '';
      const assignee = t.assignedToName ? ` → ${t.assignedToName}` : '';
      return `${status} ${t.title}${due}${assignee}`;
    });

    const moreText = data.total > 10 ? `\n\n...and ${data.total - 10} more tasks.` : '';

    return {
      text: `📋 Tasks (${data.total}):\n\n${taskLines.join('\n')}${moreText}`,
      actions: [action],
      payload: { tasks: data.items, total: data.total },
    };
  } else {
    return {
      text: `❌ Sorry, I couldn't retrieve your tasks. ${result.error || 'Please try again.'}`,
      actions: [action],
      payload: { error: result.error },
    };
  }
}

async function handleCompleteIntent(
  intent: Extract<TaskIntent, { type: 'complete' }>,
  context: AgentRunContext,
  toolExecutor: ToolExecutor
): Promise<TasksAgentResult> {
  // First, we need to find the task by title
  // For now, we'll search and ask for confirmation if ambiguous

  const searchResult = await toolExecutor('tasks.list', { status: 'open' });

  if (!searchResult.success) {
    return {
      text: `❌ Sorry, I couldn't search for tasks. ${searchResult.error || 'Please try again.'}`,
      actions: [],
      payload: { error: searchResult.error },
    };
  }

  const data = searchResult.data as { items: Array<{ id: string; title: string }> };
  const matchingTasks = data.items.filter((t) =>
    t.title.toLowerCase().includes((intent.taskTitle || '').toLowerCase())
  );

  if (matchingTasks.length === 0) {
    return {
      text: `I couldn't find a task matching "${intent.taskTitle}". Would you like to see your open tasks?`,
      actions: [],
      payload: { notFound: true },
    };
  }

  if (matchingTasks.length > 1) {
    const taskList = matchingTasks.slice(0, 5).map((t) => `- "${t.title}"`).join('\n');
    return {
      text: `I found multiple tasks matching "${intent.taskTitle}":\n${taskList}\n\nPlease be more specific about which one to complete.`,
      actions: [],
      payload: { ambiguous: true, matches: matchingTasks },
    };
  }

  // Found exactly one task - check if confirmation required
  const task = matchingTasks[0];
  const toolName = 'tasks.complete';
  const input = { taskId: task.id };
  const needsConfirmation = requiresConfirmation(toolName, intent.confidence, false);

  if (needsConfirmation) {
    const description = `I'll mark "${task.title}" as complete.`;

    context.logger.info(
      { toolName, confidence: intent.confidence, taskTitle: task.title },
      'TasksAgent: requesting confirmation for complete'
    );

    return createPendingConfirmation(toolName, input, description, context, false);
  }

  // Execute directly
  const result = await toolExecutor(toolName, input);

  const action: AgentAction = {
    tool: toolName,
    input,
    result,
  };

  if (result.success) {
    return {
      text: `✅ Done! Marked "${task.title}" as complete.`,
      actions: [action],
      payload: { task },
    };
  } else {
    return {
      text: `❌ Sorry, I couldn't complete the task. ${result.error || 'Please try again.'}`,
      actions: [action],
      payload: { error: result.error },
    };
  }
}

async function handleAssignIntent(
  intent: Extract<TaskIntent, { type: 'assign' }>,
  context: AgentRunContext,
  toolExecutor: ToolExecutor
): Promise<TasksAgentResult> {
  // Similar to complete - find task first
  // For MVP, we don't resolve names to member IDs

  return {
    text: `Assigning tasks to family members by name is coming soon! ` +
      `For now, please use the task board to assign tasks.`,
    actions: [],
    payload: { notImplemented: true },
  };
}
