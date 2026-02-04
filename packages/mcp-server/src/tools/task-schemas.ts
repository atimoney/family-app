import { z } from 'zod';

// ----------------------------------------------------------------------
// TASK TOOL SCHEMAS
// ----------------------------------------------------------------------

/**
 * Task status for filtering
 */
export const taskStatusSchema = z.enum(['todo', 'doing', 'done']);

/**
 * Task priority
 */
export const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

/**
 * Task object returned by tools
 */
export const taskSchema = z.object({
  id: z.string(),
  familyId: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  dueAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  assignedToUserId: z.string().nullable().optional(),
  assignedToName: z.string().nullable().optional(), // Populated for display
  createdByUserId: z.string(),
  labels: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TaskOutput = z.infer<typeof taskSchema>;

// ----------------------------------------------------------------------
// tasks.list
// ----------------------------------------------------------------------

export const tasksListInputSchema = z.object({
  status: z.enum(['open', 'done']).optional(),
  assignedToUserId: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export type TasksListInput = z.output<typeof tasksListInputSchema>;

export const tasksListOutputSchema = z.object({
  items: z.array(taskSchema),
  total: z.number(),
});

export type TasksListOutput = z.infer<typeof tasksListOutputSchema>;

// ----------------------------------------------------------------------
// tasks.create
// ----------------------------------------------------------------------

export const tasksCreateInputSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  dueAt: z.string().datetime().nullable().optional(),
  assignedToUserId: z.string().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  priority: taskPrioritySchema.default('medium'),
});

export type TasksCreateInput = z.output<typeof tasksCreateInputSchema>;

export const tasksCreateOutputSchema = z.object({
  task: taskSchema,
});

export type TasksCreateOutput = z.infer<typeof tasksCreateOutputSchema>;

// ----------------------------------------------------------------------
// tasks.complete
// ----------------------------------------------------------------------

export const tasksCompleteInputSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
});

export type TasksCompleteInput = z.infer<typeof tasksCompleteInputSchema>;

export const tasksCompleteOutputSchema = z.object({
  task: taskSchema,
});

export type TasksCompleteOutput = z.infer<typeof tasksCompleteOutputSchema>;

// ----------------------------------------------------------------------
// tasks.assign
// ----------------------------------------------------------------------

export const tasksAssignInputSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  assignedToUserId: z.string().nullable(), // null to unassign
});

export type TasksAssignInput = z.infer<typeof tasksAssignInputSchema>;

export const tasksAssignOutputSchema = z.object({
  task: taskSchema,
});

export type TasksAssignOutput = z.infer<typeof tasksAssignOutputSchema>;
