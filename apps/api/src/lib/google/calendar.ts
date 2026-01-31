import { google, calendar_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { RecurrenceRule, EventReminder, FamilyAssignments, EventCategory, EventAudience, CategoryMetadata } from '../../routes/calendar/schema.js';

// E2: Current schema version for family metadata in extendedProperties
export const FAMILY_SCHEMA_VERSION = '2';

// E1: Source identifier for family-app created events
export const FAMILY_SOURCE = 'family-app';

export function getCalendarClient(auth: OAuth2Client) {
  return google.calendar({ version: 'v3', auth });
}

export async function listCalendars(auth: OAuth2Client) {
  const calendar = getCalendarClient(auth);
  const response = await calendar.calendarList.list();
  return response.data.items ?? [];
}

export async function listEvents(options: {
  auth: OAuth2Client;
  calendarId: string;
  timeMin: string;
  timeMax: string;
}) {
  const calendar = getCalendarClient(options.auth);
  const allEvents: calendar_v3.Schema$Event[] = [];
  let pageToken: string | undefined;

  do {
    const response = await calendar.events.list({
      calendarId: options.calendarId,
      timeMin: options.timeMin,
      timeMax: options.timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500,
      pageToken,
    });

    allEvents.push(...(response.data.items ?? []));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return allEvents;
}

/**
 * Convert a RecurrenceRule object to a Google Calendar RRULE string
 * https://developers.google.com/calendar/api/concepts/events-calendars#recurring_events
 */
export function buildRRule(rule: RecurrenceRule): string {
  if (!rule) return '';
  
  const parts: string[] = [`FREQ=${rule.frequency}`];
  
  if (rule.interval && rule.interval > 1) {
    parts.push(`INTERVAL=${rule.interval}`);
  }
  
  if (rule.count) {
    parts.push(`COUNT=${rule.count}`);
  } else if (rule.until) {
    // Google Calendar expects UNTIL in UTC format without separators
    const untilDate = new Date(rule.until).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    parts.push(`UNTIL=${untilDate}`);
  }
  
  if (rule.byDay && rule.byDay.length > 0) {
    parts.push(`BYDAY=${rule.byDay.join(',')}`);
  }
  
  if (rule.byMonthDay && rule.byMonthDay.length > 0) {
    parts.push(`BYMONTHDAY=${rule.byMonthDay.join(',')}`);
  }
  
  if (rule.byMonth && rule.byMonth.length > 0) {
    parts.push(`BYMONTH=${rule.byMonth.join(',')}`);
  }
  
  return `RRULE:${parts.join(';')}`;
}

/**
 * Internal RecurrenceRule type (non-nullable) for parseRRule return
 */
type RecurrenceRuleData = {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval?: number;
  count?: number;
  until?: string;
  byDay?: ('MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU')[];
  byMonthDay?: number[];
  byMonth?: number[];
};

/**
 * Parse a Google Calendar RRULE string into a RecurrenceRule object
 */
export function parseRRule(rruleString: string): RecurrenceRuleData | null {
  if (!rruleString || !rruleString.startsWith('RRULE:')) return null;
  
  const rule = rruleString.replace('RRULE:', '');
  const parts = rule.split(';');
  const result: Partial<RecurrenceRuleData> = {};
  
  for (const part of parts) {
    const [key, value] = part.split('=');
    switch (key) {
      case 'FREQ':
        result.frequency = value as RecurrenceRuleData['frequency'];
        break;
      case 'INTERVAL':
        result.interval = parseInt(value, 10);
        break;
      case 'COUNT':
        result.count = parseInt(value, 10);
        break;
      case 'UNTIL': {
        // Convert YYYYMMDDTHHMMSSZ to ISO string
        const year = value.slice(0, 4);
        const month = value.slice(4, 6);
        const day = value.slice(6, 8);
        const hour = value.slice(9, 11) || '00';
        const minute = value.slice(11, 13) || '00';
        const second = value.slice(13, 15) || '00';
        result.until = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
        break;
      }
      case 'BYDAY':
        result.byDay = value.split(',') as RecurrenceRuleData['byDay'];
        break;
      case 'BYMONTHDAY':
        result.byMonthDay = value.split(',').map((v) => parseInt(v, 10));
        break;
      case 'BYMONTH':
        result.byMonth = value.split(',').map((v) => parseInt(v, 10));
        break;
    }
  }
  
  return result.frequency ? (result as RecurrenceRuleData) : null;
}

/**
 * Convert EventReminder array to Google Calendar reminder format
 */
export function buildGoogleReminders(reminders: EventReminder[] | null | undefined): calendar_v3.Schema$Event['reminders'] | undefined {
  if (!reminders || reminders.length === 0) {
    return undefined;
  }
  
  return {
    useDefault: false,
    overrides: reminders.map((r) => ({
      method: r.method,
      minutes: r.minutes,
    })),
  };
}

/**
 * Parse Google Calendar reminders into EventReminder array
 */
export function parseGoogleReminders(reminders: calendar_v3.Schema$Event['reminders'] | undefined): EventReminder[] | null {
  if (!reminders || reminders.useDefault || !reminders.overrides) {
    return null;
  }
  
  return reminders.overrides.map((r: calendar_v3.Schema$EventReminder) => ({
    method: (r.method as 'email' | 'popup') || 'popup',
    minutes: r.minutes || 0,
  }));
}

// ============================================================================
// E2: FAMILY MEMBER ASSIGNMENT HELPERS
// E1: EVENT METADATA HELPERS (CATEGORIES, AUDIENCE, TAGS)
// ============================================================================

/**
 * E1: Extended properties options including E1 metadata fields
 */
export type ExtendedPropertiesInput = {
  familyAssignments?: FamilyAssignments | null;
  // E1 fields
  category?: EventCategory | string | null;
  audience?: EventAudience | string | null;
  tags?: string[] | null;
  metadata?: CategoryMetadata | null;
  eventId?: string | null;
};

/**
 * Build extendedProperties.private object for Google Calendar event
 * Stores family member assignments and E1 metadata in a format that can be synced back
 */
export function buildFamilyExtendedProperties(
  familyAssignments: FamilyAssignments | null | undefined,
  e1Options?: {
    category?: EventCategory | string | null;
    audience?: EventAudience | string | null;
    tags?: string[] | null;
    metadata?: CategoryMetadata | null;
    eventId?: string | null;
  }
): Record<string, string> | undefined {
  const props: Record<string, string> = {
    familySchemaVersion: FAMILY_SCHEMA_VERSION,
    familySource: FAMILY_SOURCE,
  };

  // E2: Family assignments
  if (familyAssignments) {
    if (familyAssignments.primaryFamilyMemberId) {
      props.familyPrimaryMemberId = familyAssignments.primaryFamilyMemberId;
    }

    if (familyAssignments.participantFamilyMemberIds && familyAssignments.participantFamilyMemberIds.length > 0) {
      // Store as JSON array string for safe round-trip
      props.familyParticipantMemberIds = JSON.stringify(familyAssignments.participantFamilyMemberIds);
    }

    if (familyAssignments.cookMemberId) {
      props.familyCookMemberId = familyAssignments.cookMemberId;
    }

    if (familyAssignments.assignedToMemberId) {
      props.familyAssignedToMemberId = familyAssignments.assignedToMemberId;
    }
  }

  // E1: Category, audience, tags, and metadata
  if (e1Options) {
    if (e1Options.category) {
      props.familyCategory = e1Options.category;
    }

    if (e1Options.audience) {
      props.familyAudience = e1Options.audience;
    }

    if (e1Options.tags && e1Options.tags.length > 0) {
      // Store tags as JSON array for safe round-trip
      props.familyTags = JSON.stringify(e1Options.tags);
    }

    if (e1Options.metadata && Object.keys(e1Options.metadata).length > 0) {
      // Store category-specific metadata as JSON
      props.familyMetadata = JSON.stringify(e1Options.metadata);
    }

    if (e1Options.eventId) {
      props.familyEventId = e1Options.eventId;
    }
  }

  // Only return if we have actual data beyond schema version and source
  return Object.keys(props).length > 2 ? props : undefined;
}

/**
 * E1: Parsed extended properties result including E1 metadata
 */
export type ParsedExtendedProperties = {
  familyAssignments: FamilyAssignments | null;
  // E1 fields
  category: string | null;
  audience: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  eventId: string | null;
  source: string | null;
  schemaVersion: string | null;
};

/**
 * Parse extendedProperties.private from Google Calendar event
 * Extracts family member assignments and E1 metadata, handling missing/malformed data gracefully
 */
export function parseFamilyExtendedProperties(
  extendedProperties: calendar_v3.Schema$Event['extendedProperties'] | null | undefined
): FamilyAssignments | null {
  const parsed = parseAllExtendedProperties(extendedProperties);
  return parsed.familyAssignments;
}

/**
 * Parse all extended properties including E1 metadata
 */
export function parseAllExtendedProperties(
  extendedProperties: calendar_v3.Schema$Event['extendedProperties'] | null | undefined
): ParsedExtendedProperties {
  const result: ParsedExtendedProperties = {
    familyAssignments: null,
    category: null,
    audience: null,
    tags: [],
    metadata: {},
    eventId: null,
    source: null,
    schemaVersion: null,
  };

  const privateProps = extendedProperties?.private;
  if (!privateProps) {
    return result;
  }

  // Store schema version and source
  result.schemaVersion = privateProps.familySchemaVersion ?? null;
  result.source = privateProps.familySource ?? null;

  // E2: Parse family assignments
  const familyAssignments: FamilyAssignments = {};

  if (privateProps.familyPrimaryMemberId) {
    familyAssignments.primaryFamilyMemberId = privateProps.familyPrimaryMemberId;
  }

  if (privateProps.familyParticipantMemberIds) {
    try {
      const parsed = JSON.parse(privateProps.familyParticipantMemberIds);
      if (Array.isArray(parsed)) {
        familyAssignments.participantFamilyMemberIds = parsed.filter((id): id is string => typeof id === 'string');
      }
    } catch {
      // Malformed JSON - skip this field
    }
  }

  if (privateProps.familyCookMemberId) {
    familyAssignments.cookMemberId = privateProps.familyCookMemberId;
  }

  if (privateProps.familyAssignedToMemberId) {
    familyAssignments.assignedToMemberId = privateProps.familyAssignedToMemberId;
  }

  // Check if we have any family assignment data
  const hasFamilyData = familyAssignments.primaryFamilyMemberId ||
    (familyAssignments.participantFamilyMemberIds && familyAssignments.participantFamilyMemberIds.length > 0) ||
    familyAssignments.cookMemberId ||
    familyAssignments.assignedToMemberId;

  if (hasFamilyData) {
    result.familyAssignments = familyAssignments;
  }

  // E1: Parse category, audience, tags, and metadata
  if (privateProps.familyCategory) {
    result.category = privateProps.familyCategory;
  }

  if (privateProps.familyAudience) {
    result.audience = privateProps.familyAudience;
  }

  if (privateProps.familyTags) {
    try {
      const parsed = JSON.parse(privateProps.familyTags);
      if (Array.isArray(parsed)) {
        result.tags = parsed.filter((tag): tag is string => typeof tag === 'string');
      }
    } catch {
      // Malformed JSON - skip this field
    }
  }

  if (privateProps.familyMetadata) {
    try {
      const parsed = JSON.parse(privateProps.familyMetadata);
      if (typeof parsed === 'object' && parsed !== null) {
        result.metadata = parsed;
      }
    } catch {
      // Malformed JSON - skip this field
    }
  }

  if (privateProps.familyEventId) {
    result.eventId = privateProps.familyEventId;
  }

  return result;
}

/**
 * Merge existing extendedProperties with new family data and E1 metadata
 * Preserves any existing private properties while adding/updating family fields
 */
export function mergeExtendedProperties(
  existing: calendar_v3.Schema$Event['extendedProperties'] | null | undefined,
  familyAssignments: FamilyAssignments | null | undefined,
  e1Options?: {
    category?: EventCategory | string | null;
    audience?: EventAudience | string | null;
    tags?: string[] | null;
    metadata?: CategoryMetadata | null;
    eventId?: string | null;
  }
): calendar_v3.Schema$Event['extendedProperties'] | undefined {
  const familyProps = buildFamilyExtendedProperties(familyAssignments, e1Options);
  
  if (!familyProps && !existing?.private) {
    return undefined;
  }

  return {
    ...existing,
    private: {
      ...existing?.private,
      ...familyProps,
    },
  };
}

export async function createEvent(options: {
  auth: OAuth2Client;
  calendarId: string;
  event: calendar_v3.Schema$Event;
  recurrence?: RecurrenceRule | null;
  reminders?: EventReminder[] | null;
  familyAssignments?: FamilyAssignments | null;
  // E1 fields
  category?: EventCategory | string | null;
  audience?: EventAudience | string | null;
  tags?: string[] | null;
  categoryMetadata?: CategoryMetadata | null;
  eventId?: string | null;
}) {
  const calendar = getCalendarClient(options.auth);
  
  const requestBody: calendar_v3.Schema$Event = {
    ...options.event,
  };
  
  // Add recurrence if provided
  if (options.recurrence) {
    requestBody.recurrence = [buildRRule(options.recurrence)];
  }
  
  // Add reminders if provided
  const googleReminders = buildGoogleReminders(options.reminders);
  if (googleReminders) {
    requestBody.reminders = googleReminders;
  }

  // E2: Add family member assignments to extendedProperties.private
  // E1: Add category, audience, tags, and metadata to extendedProperties.private
  const hasE1Data = options.category || options.audience || options.tags?.length || options.categoryMetadata;
  
  // Debug logging for E1 troubleshooting
  console.log('[E1 CREATE DEBUG]', {
    hasE1Data,
    category: options.category,
    audience: options.audience,
    tags: options.tags,
    hasFamilyAssignments: !!options.familyAssignments,
  });
  
  if (options.familyAssignments || hasE1Data) {
    requestBody.extendedProperties = mergeExtendedProperties(
      options.event.extendedProperties,
      options.familyAssignments,
      hasE1Data ? {
        category: options.category,
        audience: options.audience,
        tags: options.tags,
        metadata: options.categoryMetadata,
        eventId: options.eventId,
      } : undefined
    );
    
    // Debug: log the final extendedProperties
    console.log('[E1 CREATE DEBUG] extendedProperties:', JSON.stringify(requestBody.extendedProperties, null, 2));
  }
  
  const response = await calendar.events.insert({
    calendarId: options.calendarId,
    requestBody,
  });
  return response.data;
}

export async function updateEvent(options: {
  auth: OAuth2Client;
  calendarId: string;
  eventId: string;
  event: calendar_v3.Schema$Event;
  recurrence?: RecurrenceRule | null;
  reminders?: EventReminder[] | null;
  familyAssignments?: FamilyAssignments | null;
  // E1 fields
  category?: EventCategory | string | null;
  audience?: EventAudience | string | null;
  tags?: string[] | null;
  categoryMetadata?: CategoryMetadata | null;
  internalEventId?: string | null;
}) {
  const calendar = getCalendarClient(options.auth);
  
  const requestBody: calendar_v3.Schema$Event = {
    ...options.event,
  };
  
  // Add recurrence if provided (or clear it)
  if (options.recurrence !== undefined) {
    requestBody.recurrence = options.recurrence ? [buildRRule(options.recurrence)] : [];
  }
  
  // Add reminders if provided
  const googleReminders = buildGoogleReminders(options.reminders);
  if (googleReminders) {
    requestBody.reminders = googleReminders;
  }

  // E2: Add family member assignments to extendedProperties.private
  // E1: Add category, audience, tags, and metadata to extendedProperties.private
  const hasE1Data = options.category !== undefined || options.audience !== undefined || 
                     options.tags !== undefined || options.categoryMetadata !== undefined;
  if (options.familyAssignments !== undefined || hasE1Data) {
    requestBody.extendedProperties = mergeExtendedProperties(
      options.event.extendedProperties,
      options.familyAssignments,
      hasE1Data ? {
        category: options.category,
        audience: options.audience,
        tags: options.tags,
        metadata: options.categoryMetadata,
        eventId: options.internalEventId,
      } : undefined
    );
  }
  
  const response = await calendar.events.patch({
    calendarId: options.calendarId,
    eventId: options.eventId,
    requestBody,
  });
  return response.data;
}

export async function deleteEvent(options: {
  auth: OAuth2Client;
  calendarId: string;
  eventId: string;
}) {
  const calendar = getCalendarClient(options.auth);
  await calendar.events.delete({
    calendarId: options.calendarId,
    eventId: options.eventId,
  });
}

/**
 * Move an event from one calendar to another using Google Calendar's move API
 * https://developers.google.com/calendar/api/v3/reference/events/move
 */
export async function moveEvent(options: {
  auth: OAuth2Client;
  sourceCalendarId: string;
  destinationCalendarId: string;
  eventId: string;
}) {
  const calendar = getCalendarClient(options.auth);
  const response = await calendar.events.move({
    calendarId: options.sourceCalendarId,
    eventId: options.eventId,
    destination: options.destinationCalendarId,
  });
  return response.data;
}
