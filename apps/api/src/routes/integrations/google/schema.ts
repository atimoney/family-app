import { z } from 'zod';

export const connectBodySchema = z.object({
  code: z.string().min(1, 'Auth code is required'),
  calendarId: z.string().optional(),
});

export const connectResponseSchema = z.object({
  status: z.literal('connected'),
  expiresAt: z.number(),
});

export const syncResponseSchema = z.object({
  status: z.literal('ready'),
  accessTokenExpiresAt: z.number(),
  synced: z.number(),
  created: z.number(),
  updated: z.number(),
  deleted: z.number(),
  failed: z.number(),
  fullSync: z.boolean(),
  nextSyncToken: z.string().optional(),
});
