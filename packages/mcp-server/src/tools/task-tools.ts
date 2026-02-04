import { defineTool } from '../registry.js';
import type { ToolContext, ToolResult } from '../types.js';
import {
  tasksListInputSchema,
  tasksListOutputSchema,
  tasksCreateInputSchema,
  tasksCreateOutputSchema,
  tasksCompleteInputSchema,
  tasksCompleteOutputSchema,
  tasksAssignInputSchema,
  tasksAssignOutputSchema,
  type TasksListInput,
  type TasksListOutput,
  type TasksCreateInput,
  type TasksCreateOutput,
  type TasksCompleteInput,
  type TasksCompleteOutput,
  type TasksAssignInput,
  type TasksAssignOutput,
} from './task-schemas.js';

// ----------------------------------------------------------------------
// TASK TOOL HANDLER TYPE
// ----------------------------------------------------------------------

/**
 * Handler function for task tools.
 * Injected by the API layer with Prisma access.
 */
export type TaskToolHandler<TInput, TOutput> = (
  input: TInput,
  context: ToolContext
) => Promise<ToolResult<TOutput>>;

/**
 * Registry of task tool handlers.
 * These are injected by the API layer.
 */
export const taskToolHandlers: {
  list?: TaskToolHandler<TasksListInput, TasksListOutput>;
  create?: TaskToolHandler<TasksCreateInput, TasksCreateOutput>;
  complete?: TaskToolHandler<TasksCompleteInput, TasksCompleteOutput>;
  assign?: TaskToolHandler<TasksAssignInput, TasksAssignOutput>;
} = {};

/**
 * Register task tool handlers (called by API layer).
 */
export function registerTaskToolHandlers(handlers: {
  list: TaskToolHandler<TasksListInput, TasksListOutput>;
  create: TaskToolHandler<TasksCreateInput, TasksCreateOutput>;
  complete: TaskToolHandler<TasksCompleteInput, TasksCompleteOutput>;
  assign: TaskToolHandler<TasksAssignInput, TasksAssignOutput>;
}): void {
  taskToolHandlers.list = handlers.list;
  taskToolHandlers.create = handlers.create;
  taskToolHandlers.complete = handlers.complete;
  taskToolHandlers.assign = handlers.assign;
}

// ----------------------------------------------------------------------
// TOOL DEFINITIONS
// ----------------------------------------------------------------------

export const tasksListTool = defineTool({
  name: 'tasks.list',
  description:
    'List tasks for the family. Filter by status (open=todo+doing, done) or assignee.',
  inputSchema: tasksListInputSchema,
  outputSchema: tasksListOutputSchema,
  execute: async (input, context) => {
    if (!taskToolHandlers.list) {
      return { success: false, error: 'Task list handler not registered' };
    }
    // Apply defaults
    const parsedInput: TasksListInput = {
      ...input,
      limit: input.limit ?? 50,
    };
    return taskToolHandlers.list(parsedInput, context);
  },
});

export const tasksCreateTool = defineTool({
  name: 'tasks.create',
  description:
    'Create a new task. Requires title. Optionally set due date (ISO datetime), assignee, notes, and priority.',
  inputSchema: tasksCreateInputSchema,
  outputSchema: tasksCreateOutputSchema,
  execute: async (input, context) => {
    if (!taskToolHandlers.create) {
      return { success: false, error: 'Task create handler not registered' };
    }
    // Apply defaults
    const parsedInput: TasksCreateInput = {
      ...input,
      priority: input.priority ?? 'medium',
    };
    return taskToolHandlers.create(parsedInput, context);
  },
});

export const tasksCompleteTool = defineTool({
  name: 'tasks.complete',
  description: 'Mark a task as complete (done).',
  inputSchema: tasksCompleteInputSchema,
  outputSchema: tasksCompleteOutputSchema,
  execute: async (input, context) => {
    if (!taskToolHandlers.complete) {
      return { success: false, error: 'Task complete handler not registered' };
    }
    return taskToolHandlers.complete(input, context);
  },
});

export const tasksAssignTool = defineTool({
  name: 'tasks.assign',
  description:
    'Assign a task to a family member. Pass null to unassign.',
  inputSchema: tasksAssignInputSchema,
  outputSchema: tasksAssignOutputSchema,
  execute: async (input, context) => {
    if (!taskToolHandlers.assign) {
      return { success: false, error: 'Task assign handler not registered' };
    }
    return taskToolHandlers.assign(input, context);
  },
});
