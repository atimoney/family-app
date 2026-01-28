import { z } from 'zod';

const isoDateSchema = z.string().datetime({ message: 'Invalid date' });

const tagsSchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => String(entry).split(','))
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}, z.array(z.string()).optional());

const calendarIdsSchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value.map((id) => String(id).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  return [];
}, z.array(z.string()).optional());

export const getEventsQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  tags: tagsSchema.optional(),
  calendarIds: calendarIdsSchema.optional(),
});

// E2: Family member assignments schema
export const familyAssignmentsSchema = z.object({
  primaryFamilyMemberId: z.string().nullable().optional(),
  participantFamilyMemberIds: z.array(z.string()).optional().default([]),
  cookMemberId: z.string().nullable().optional(),
  assignedToMemberId: z.string().nullable().optional(),
}).nullable().optional();

// E1: Event category enum
export const eventCategorySchema = z.enum([
  'Meal',
  'School',
  'Sport',
  'Activity',
  'Chore',
  'Appointment',
  'Work',
  'Travel',
  'Home',
  'Admin',
]);

// E1: Event audience enum
export const eventAudienceSchema = z.enum(['family', 'adults', 'kids']);

export const getEventsResponseSchema = z.array(
  z.object({
    id: z.string(),
    googleEventId: z.string(),
    calendarId: z.string(),
    startsAt: isoDateSchema,
    endsAt: isoDateSchema,
    title: z.string(),
    description: z.string().nullable(),
    location: z.string().nullable(),
    allDay: z.boolean(),
    status: z.string().nullable().optional(),
    calendarColor: z.string().nullable(),
    calendarSummary: z.string().nullable(),
    metadata: z
      .object({
        tags: z.array(z.string()),
        notes: z.string().nullable().optional(),
        color: z.string().nullable().optional(),
        // E1: New metadata fields
        category: eventCategorySchema.nullable().optional(),
        audience: eventAudienceSchema.nullable().optional(),
        categoryMetadata: z.record(z.any()).nullable().optional(),
        customJson: z.record(z.any()).optional(),
        familyAssignments: familyAssignmentsSchema,
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
  // E1: New metadata fields
  category: eventCategorySchema.nullable().optional(),
  audience: eventAudienceSchema.nullable().optional().default('family'),
  categoryMetadata: z.record(z.any()).nullable().optional().default({}),
  customJson: z.record(z.any()).optional().default({}),
  familyAssignments: familyAssignmentsSchema,
});

export const eventMetadataResponseSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  tags: z.array(z.string()),
  notes: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  // E1: New metadata fields
  category: eventCategorySchema.nullable().optional(),
  audience: eventAudienceSchema.nullable().optional(),
  categoryMetadata: z.record(z.any()).nullable().optional(),
  customJson: z.record(z.any()),
  familyAssignments: familyAssignmentsSchema,
});
