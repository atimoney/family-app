import type { AgentRunContext, AgentAction, ToolResult } from '../types.js';
import { extractDateTimeFromMessage } from '../utils/date-parser.js';

// ----------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------

export type TasksAgentResult = {
  text: string;
  actions: AgentAction[];
  payload?: Record<string, unknown>;
};

/**
 * Parsed intent from user message.
 */
type TaskIntent =
  | { type: 'create'; title: string; dueAt: string | null; assignee: string | null; notes: string | null; priority: string | null; needsClarification: 'date' | null }
  | { type: 'list'; status: 'open' | 'done' | null; assignee: string | null }
  | { type: 'complete'; taskTitle: string | null; taskId: string | null }
  | { type: 'assign'; taskTitle: string | null; taskId: string | null; assignee: string | null }
  | { type: 'unclear' };

/**
 * Tool executor function injected by the API layer.
 */
export type ToolExecutor = (
  toolName: string,
  input: Record<string, unknown>
) => Promise<ToolResult>;

// ----------------------------------------------------------------------
// INTENT PARSING
// ----------------------------------------------------------------------

/**
 * Parse user message into a structured task intent.
 * This is a deterministic rule-based parser.
 */
function parseTaskIntent(message: string, context: AgentRunContext): TaskIntent {
  const lower = message.toLowerCase();

  // CREATE patterns
  const createPatterns = [
    /^(?:create|add|new|make)\s+(?:a\s+)?task[:\s]+(.+)$/i,
    /^task[:\s]+(.+)$/i,
    /^(?:remind|reminder)[:\s]+(.+)$/i,
    /^(?:i need to|need to|gotta|have to)\s+(.+)$/i,
  ];

  for (const pattern of createPatterns) {
    const match = message.match(pattern);
    if (match) {
      const remainder = match[1].trim();
      return parseCreateIntent(remainder, context);
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

    return { type: 'list', status, assignee };
  }

  // COMPLETE patterns
  const completePatterns = [
    /^(?:complete|done|finish|mark\s+(?:as\s+)?done)[:\s]+(.+)$/i,
    /^(?:i\s+)?(?:finished|completed|done\s+with)[:\s]+(.+)$/i,
  ];

  for (const pattern of completePatterns) {
    const match = message.match(pattern);
    if (match) {
      return { type: 'complete', taskTitle: match[1].trim(), taskId: null };
    }
  }

  // ASSIGN patterns
  const assignPatterns = [
    /^assign\s+["']?(.+?)["']?\s+to\s+(\w+)$/i,
    /^give\s+["']?(.+?)["']?\s+to\s+(\w+)$/i,
  ];

  for (const pattern of assignPatterns) {
    const match = message.match(pattern);
    if (match) {
      return { type: 'assign', taskTitle: match[1].trim(), taskId: null, assignee: match[2] };
    }
  }

  // If message contains task-related keywords but no clear action
  if (/task|todo|remind/i.test(lower)) {
    // Default to create if it looks like a task description
    if (lower.length > 5 && !/\?$/.test(lower)) {
      return parseCreateIntent(message, context);
    }
  }

  return { type: 'unclear' };
}

/**
 * Parse a create intent from the remainder of the message.
 */
function parseCreateIntent(remainder: string, context: AgentRunContext): TaskIntent {
  // Extract due date
  const dateResult = extractDateTimeFromMessage(remainder, new Date());

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
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ----------------------------------------------------------------------
// TASKS AGENT EXECUTOR
// ----------------------------------------------------------------------

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

  // Execute the tool
  const input: Record<string, unknown> = {
    title: intent.title,
    priority: intent.priority ?? 'medium',
  };

  if (intent.dueAt) {
    input.dueAt = intent.dueAt;
  }

  if (intent.notes) {
    input.notes = intent.notes;
  }

  // Note: assignee resolution would need family member lookup
  // For now, we don't resolve names to IDs in the agent

  const result = await toolExecutor('tasks.create', input);

  const action: AgentAction = {
    tool: 'tasks.create',
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

  // Complete the task
  const task = matchingTasks[0];
  const result = await toolExecutor('tasks.complete', { taskId: task.id });

  const action: AgentAction = {
    tool: 'tasks.complete',
    input: { taskId: task.id },
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
