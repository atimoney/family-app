import { z } from 'zod';

const isoDateSchema = z.string().datetime({ message: 'Invalid date' });

const tagsSchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => String(entry).split(',')).map((tag) => tag.trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(',').map((tag) => tag.trim()).filter(Boolean);
  }

  return [];
}, z.array(z.string()).optional());

export const getEventsQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  tags: tagsSchema.optional(),
});

export const getEventsResponseSchema = z.array(
  z.object({
    id: z.string(),
    googleEventId: z.string(),
    startsAt: isoDateSchema,
    endsAt: isoDateSchema,
    title: z.string(),
    status: z.string().nullable().optional(),
    metadata: z
      .object({
        tags: z.array(z.string()),
        notes: z.string().nullable().optional(),
        color: z.string().nullable().optional(),
        customJson: z.record(z.any()).optional(),
      })
      .nullable(),
  })
);

export const eventMetadataParamsSchema = z.object({
  id: z.string().min(1),
});

export const eventMetadataBodySchema = z.object({
  tags: z.array(z.string()).optional().default([]),
  notes: z.string().nullable().optional().default(null),
  color: z.string().nullable().optional().default(null),
  customJson: z.record(z.any()).optional().default({}),
});

export const eventMetadataResponseSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  tags: z.array(z.string()),
  notes: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  customJson: z.record(z.any()),
});
