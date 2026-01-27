import { z } from 'zod';

export const extraDataSchema = z.object({
  tags: z.array(z.string()).default([]),
  category: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  color: z.string().nullable().optional().default(null),
});

export const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  start: z.string().datetime({ message: 'Invalid start date' }),
  end: z.string().datetime({ message: 'Invalid end date' }),
  allDay: z.boolean().optional().default(false),
  calendarId: z.string().optional(),
  extraData: extraDataSchema.optional(),
});

export const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  allDay: z.boolean().optional(),
  calendarId: z.string().optional(),
  extraData: extraDataSchema.optional(),
});

export const updateMetadataSchema = z.object({
  extraData: extraDataSchema,
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type UpdateMetadataInput = z.infer<typeof updateMetadataSchema>;
