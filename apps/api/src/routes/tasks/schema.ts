import { z } from 'zod';

// ----------------------------------------------------------------------

export const taskStatusSchema = z.enum(['todo', 'doing', 'done']);
export const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

// Recurrence frequency enum
export const recurrenceFrequencySchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);

// Recurrence rule schema (RRULE-like)
export const recurrenceRuleSchema = z.object({
  frequency: recurrenceFrequencySchema,
  interval: z.number().int().min(1).max(99).optional().default(1), // every N days/weeks/etc
  count: z.number().int().min(1).max(365).optional(), // stop after N occurrences
  until: z.string().datetime().optional(), // stop at this date
  byDay: z.array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])).optional(), // for weekly
  byMonthDay: z.array(z.number().int().min(1).max(31)).optional(), // for monthly
});

// ----------------------------------------------------------------------

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).nullable().optional(),
  status: taskStatusSchema.optional().default('todo'),
  priority: taskPrioritySchema.optional().default('medium'),
  dueAt: z.string().datetime().nullable().optional(),
  assignedToUserId: z.string().nullable().optional(),
  labels: z.array(z.string().max(50)).max(20).optional().default([]),
  // Recurrence fields
  recurrence: recurrenceRuleSchema.nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  dueAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  assignedToUserId: z.string().nullable().optional(),
  labels: z.array(z.string().max(50)).max(20).optional(),
  sortOrder: z.number().int().optional(),
  // Recurrence - can update or remove
  recurrence: recurrenceRuleSchema.nullable().optional(),
});

export const tasksQuerySchema = z.object({
  status: z.union([taskStatusSchema, z.array(taskStatusSchema)]).optional(),
  assignedTo: z.string().optional(), // memberId or 'unassigned'
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  includeCompleted: z.coerce.boolean().optional().default(false),
  labels: z.string().optional(), // comma-separated
  search: z.string().max(200).optional(),
  includeRecurrenceParents: z.coerce.boolean().optional().default(false), // include recurring parent tasks
});

// ----------------------------------------------------------------------

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TasksQueryInput = z.infer<typeof tasksQuerySchema>;
export type RecurrenceRule = z.infer<typeof recurrenceRuleSchema>;
