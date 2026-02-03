import { z } from 'zod';

import { taskPrioritySchema } from '../tasks/schema.js';

// ----------------------------------------------------------------------

export const createTaskTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).nullable().optional(),
  priority: taskPrioritySchema.optional().default('medium'),
  labels: z.array(z.string().max(50)).max(20).optional().default([]),
  defaultAssigneeId: z.string().nullable().optional(),
  dueDaysFromNow: z.number().int().min(0).max(365).nullable().optional(),
  dueTimeOfDay: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)')
    .nullable()
    .optional(),
  icon: z.string().max(100).nullable().optional(),
  color: z.string().max(50).nullable().optional(),
  sortOrder: z.number().int().optional().default(0),
});

export const updateTaskTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  priority: taskPrioritySchema.optional(),
  labels: z.array(z.string().max(50)).max(20).optional(),
  defaultAssigneeId: z.string().nullable().optional(),
  dueDaysFromNow: z.number().int().min(0).max(365).nullable().optional(),
  dueTimeOfDay: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)')
    .nullable()
    .optional(),
  icon: z.string().max(100).nullable().optional(),
  color: z.string().max(50).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const taskTemplatesQuerySchema = z.object({
  search: z.string().max(200).optional(),
  includeDeleted: z.coerce.boolean().optional().default(false),
});

// Schema for creating a task from a template
export const createTaskFromTemplateSchema = z.object({
  // Allow overrides
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  assignedToUserId: z.string().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

// ----------------------------------------------------------------------

export type CreateTaskTemplateInput = z.infer<typeof createTaskTemplateSchema>;
export type UpdateTaskTemplateInput = z.infer<typeof updateTaskTemplateSchema>;
export type TaskTemplatesQueryInput = z.infer<typeof taskTemplatesQuerySchema>;
export type CreateTaskFromTemplateInput = z.infer<typeof createTaskFromTemplateSchema>;
