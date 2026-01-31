import { z } from 'zod';

// Recurrence frequency enum
export const recurrenceFrequencySchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);

// Recurrence rule schema for Google Calendar RRULE
export const recurrenceRuleSchema = z.object({
  frequency: recurrenceFrequencySchema,
  interval: z.number().int().positive().optional(), // e.g., every 2 weeks
  count: z.number().int().positive().optional(), // number of occurrences
  until: z.string().datetime().optional(), // end date
  byDay: z.array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])).optional(), // for weekly
  byMonthDay: z.array(z.number().int().min(1).max(31)).optional(), // for monthly
  byMonth: z.array(z.number().int().min(1).max(12)).optional(), // for yearly
}).nullable().optional();

// Reminder method enum
export const reminderMethodSchema = z.enum(['email', 'popup']);

// Single reminder schema
export const eventReminderSchema = z.object({
  method: reminderMethodSchema,
  minutes: z.number().int().min(0).max(40320), // max ~4 weeks in minutes
});

// Reminders array schema
export const remindersSchema = z.array(eventReminderSchema).max(5).nullable().optional();

// E2: Family member assignments schema
export const familyAssignmentsSchema = z.object({
  primaryFamilyMemberId: z.string().nullable().optional(),
  participantFamilyMemberIds: z.array(z.string()).nullable().optional(),
  cookMemberId: z.string().nullable().optional(),
  assignedToMemberId: z.string().nullable().optional(),
}).nullable().optional();

// ============================================================================
// E1: EVENT METADATA SCHEMAS
// ============================================================================

// E1: Event category - flexible string to support user-defined categories
// Transform to lowercase for consistency
export const eventCategorySchema = z.string().transform(val => val.toLowerCase());

// E1: Event audience enum
export const eventAudienceSchema = z.enum(['family', 'adults', 'kids']);

// Category metadata - generic schema to allow any user-defined fields
export const categoryMetadataSchema = z.record(z.any()).nullable().optional();

// Event audit info schema - tracks who made changes and when
export const eventAuditInfoSchema = z.object({
  modifiedBy: z.string().nullable(),
  modifiedByName: z.string().nullable(),
  modifiedAt: z.string(),
  editSource: z.enum(['user', 'dashboard', 'system', 'sync']),
  isDashboardMode: z.boolean(),
  changeNote: z.string().nullable().optional(),
}).nullable().optional();

export const extraDataSchema = z.object({
  tags: z.array(z.string()).default([]),
  category: eventCategorySchema.nullable().optional().default(null),
  audience: eventAudienceSchema.nullable().optional().default('family'),
  notes: z.string().nullable().default(null),
  color: z.string().nullable().optional().default(null),
  metadata: categoryMetadataSchema.default({}),
  familyAssignments: familyAssignmentsSchema,
  // Audit tracking
  createdAudit: eventAuditInfoSchema,
  lastModifiedAudit: eventAuditInfoSchema,
});

export const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  start: z.string().datetime({ message: 'Invalid start date' }),
  end: z.string().datetime({ message: 'Invalid end date' }),
  allDay: z.boolean().optional().default(false),
  calendarId: z.string().optional(),
  description: z.string().max(8000).nullable().optional(),
  location: z.string().max(1000).nullable().optional(),
  color: z.string().nullable().optional(),
  recurrence: recurrenceRuleSchema,
  reminders: remindersSchema,
  extraData: extraDataSchema.optional(),
});

export const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  allDay: z.boolean().optional(),
  calendarId: z.string().optional(),
  // sourceCalendarId is the calendar the event is currently in (required for moves)
  sourceCalendarId: z.string().optional(),
  description: z.string().max(8000).nullable().optional(),
  location: z.string().max(1000).nullable().optional(),
  color: z.string().nullable().optional(),
  recurrence: recurrenceRuleSchema,
  reminders: remindersSchema,
  extraData: extraDataSchema.optional(),
});

export const updateMetadataSchema = z.object({
  extraData: extraDataSchema,
});

export type RecurrenceFrequency = z.infer<typeof recurrenceFrequencySchema>;
export type RecurrenceRule = z.infer<typeof recurrenceRuleSchema>;
export type ReminderMethod = z.infer<typeof reminderMethodSchema>;
export type EventReminder = z.infer<typeof eventReminderSchema>;
export type FamilyAssignments = z.infer<typeof familyAssignmentsSchema>;
export type EventCategory = z.infer<typeof eventCategorySchema>;
export type EventAudience = z.infer<typeof eventAudienceSchema>;
export type CategoryMetadata = z.infer<typeof categoryMetadataSchema>;
export type ExtraData = z.infer<typeof extraDataSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type UpdateMetadataInput = z.infer<typeof updateMetadataSchema>;
