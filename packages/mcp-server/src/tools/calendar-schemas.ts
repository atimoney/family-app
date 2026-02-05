import { z } from 'zod';

// ----------------------------------------------------------------------
// CALENDAR EVENT SCHEMA
// ----------------------------------------------------------------------

/**
 * Calendar event output schema.
 */
export const calendarEventSchema = z.object({
  id: z.string(),
  familyId: z.string(),
  title: z.string(),
  startAt: z.string(), // ISO datetime
  endAt: z.string(), // ISO datetime
  location: z.string().nullable(),
  notes: z.string().nullable(),
  allDay: z.boolean(),
  createdByUserId: z.string(),
  attendees: z.array(
    z.object({
      userId: z.string(),
      displayName: z.string().nullable(),
      status: z.enum(['pending', 'accepted', 'declined']),
    })
  ).optional(),
  createdAt: z.string(), // ISO datetime
  updatedAt: z.string(), // ISO datetime
});

export type CalendarEventOutput = z.infer<typeof calendarEventSchema>;

// ----------------------------------------------------------------------
// CALENDAR.SEARCH
// ----------------------------------------------------------------------

export const calendarSearchInputSchema = z.object({
  /** Text query to match against event title/notes */
  query: z.string().max(200).optional(),
  /** Start of date range (ISO datetime) */
  from: z.string().datetime().optional(),
  /** End of date range (ISO datetime) */
  to: z.string().datetime().optional(),
  /** Filter by attendee user ID */
  attendeeUserId: z.string().optional(),
  /** Maximum results to return (default 20) */
  limit: z.number().int().min(1).max(100).default(20),
});

export type CalendarSearchInput = z.infer<typeof calendarSearchInputSchema>;

export const calendarSearchOutputSchema = z.object({
  events: z.array(calendarEventSchema),
  total: z.number(),
});

export type CalendarSearchOutput = z.infer<typeof calendarSearchOutputSchema>;

// ----------------------------------------------------------------------
// CALENDAR.CREATE
// ----------------------------------------------------------------------

export const calendarCreateInputSchema = z.object({
  /** Event title */
  title: z.string().min(1).max(500),
  /** Event start time (ISO datetime) */
  startAt: z.string().datetime(),
  /** Event end time (ISO datetime) */
  endAt: z.string().datetime(),
  /** Location (optional) */
  location: z.string().max(500).optional(),
  /** Notes/description (optional) */
  notes: z.string().max(2000).optional(),
  /** Whether this is an all-day event */
  allDay: z.boolean().default(false),
  /** User IDs to add as attendees */
  attendeeUserIds: z.array(z.string()).optional(),
});

export type CalendarCreateInput = z.infer<typeof calendarCreateInputSchema>;

export const calendarCreateOutputSchema = z.object({
  event: calendarEventSchema,
});

export type CalendarCreateOutput = z.infer<typeof calendarCreateOutputSchema>;

// ----------------------------------------------------------------------
// CALENDAR.UPDATE
// ----------------------------------------------------------------------

export const calendarUpdatePatchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  location: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  allDay: z.boolean().optional(),
});

export type CalendarUpdatePatch = z.infer<typeof calendarUpdatePatchSchema>;

export const calendarUpdateInputSchema = z.object({
  /** Event ID to update */
  eventId: z.string(),
  /** Fields to update */
  patch: calendarUpdatePatchSchema,
});

export type CalendarUpdateInput = z.infer<typeof calendarUpdateInputSchema>;

export const calendarUpdateOutputSchema = z.object({
  event: calendarEventSchema,
});

export type CalendarUpdateOutput = z.infer<typeof calendarUpdateOutputSchema>;

// ----------------------------------------------------------------------
// CALENDAR.BATCH_UPDATE
// ----------------------------------------------------------------------

export const calendarBatchUpdatePatchSchema = z.object({
  /** Convert to/from all-day event */
  allDay: z.boolean().optional(),
  /** New title for all events */
  title: z.string().min(1).max(500).optional(),
  /** New location for all events */
  location: z.string().max(500).nullable().optional(),
});

export type CalendarBatchUpdatePatch = z.infer<typeof calendarBatchUpdatePatchSchema>;

export const calendarBatchUpdateInputSchema = z.object({
  /** Event IDs to update */
  eventIds: z.array(z.string()).min(1).max(50),
  /** Fields to update on all events */
  patch: calendarBatchUpdatePatchSchema,
});

export type CalendarBatchUpdateInput = z.infer<typeof calendarBatchUpdateInputSchema>;

export const calendarBatchUpdateOutputSchema = z.object({
  /** Number of events successfully updated */
  updated: z.number(),
  /** Event IDs that failed to update */
  failed: z.array(z.string()),
  /** Details of updated events */
  updatedEvents: z.array(z.object({
    id: z.string(),
    title: z.string(),
  })).optional(),
});

export type CalendarBatchUpdateOutput = z.infer<typeof calendarBatchUpdateOutputSchema>;

// ----------------------------------------------------------------------
// VALIDATION HELPERS
// ----------------------------------------------------------------------

/**
 * Validate that endAt is after startAt.
 */
export function validateDateRange(startAt: string, endAt: string): boolean {
  return new Date(endAt) > new Date(startAt);
}
