import { z } from 'zod';

export const syncResponseSchema = z.object({
  status: z.literal('ready'),
  synced: z.number(),
  created: z.number(),
  updated: z.number(),
  deleted: z.number(),
  failed: z.number(),
  fullSync: z.boolean(),
  calendarsProcessed: z.number(),
  nextSyncToken: z.string().optional(),
});

export const clearSyncResponseSchema = z.object({
  status: z.literal('cleared'),
  message: z.string(),
});

export const syncStatusResponseSchema = z.object({
  calendars: z.array(
    z.object({
      calendarId: z.string(),
      summary: z.string(),
      hasSyncToken: z.boolean(),
      lastSyncedAt: z.string().nullable(),
      eventCount: z.number(),
    })
  ),
});
