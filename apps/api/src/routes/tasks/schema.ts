import { z } from 'zod';

export const taskStatusSchema = z.enum(['todo', 'doing', 'done']);

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  assigneeId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  status: taskStatusSchema.optional().default('todo'),
});

export const updateTaskSchema = z.object({
  status: taskStatusSchema.optional(),
  completed: z.boolean().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
