import { z } from 'zod';

export const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  start: z.string().datetime({ message: 'Invalid start date' }),
  end: z.string().datetime({ message: 'Invalid end date' }),
  allDay: z.boolean().optional().default(false),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
