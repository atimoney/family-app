/**
 * E2: Family member assignments for calendar events.
 * All fields are optional to ensure backward compatibility.
 */
export type EventFamilyAssignments = {
  /** Primary family member responsible for this event */
  primaryFamilyMemberId?: string | null;
  /** Family members participating in this event */
  participantFamilyMemberIds?: string[];
  /** For Meal category: who is cooking */
  cookMemberId?: string | null;
  /** For Chore category: who is assigned to do it */
  assignedToMemberId?: string | null;
};

export type CalendarEventMetadata = {
  tags: string[];
  notes: string | null;
  color: string | null;
  customJson?: Record<string, unknown>;
  familyAssignments?: EventFamilyAssignments | null;
};

export type CalendarInfo = {
  id: string;
  summary: string;
  timeZone: string | null;
  primary: boolean;
  backgroundColor: string | null;
  isSelected: boolean;
};

// Recurrence rule type
export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  interval?: number;
  count?: number;
  until?: string;
  byDay?: string[];
  byMonthDay?: number[];
  byMonth?: number[];
};

// Reminder type
export type ReminderMethod = 'email' | 'popup';

export type EventReminder = {
  method: ReminderMethod;
  minutes: number;
};

// Response from /events endpoint (local cache)
export type CalendarEventApi = {
  id: string;
  googleEventId: string;
  calendarId: string;
  startsAt: string;
  endsAt: string;
  title: string;
  description: string | null;
  location: string | null;
  allDay: boolean;
  status?: string | null;
  calendarColor: string | null;
  calendarSummary: string | null;
  recurrence?: RecurrenceRule | null;
  reminders?: EventReminder[] | null;
  metadata: CalendarEventMetadata | null;
};

// UI representation for FullCalendar
export type CalendarEventItem = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  calendarId?: string;
  description?: string | null;
  location?: string | null;
  color?: string; // FullCalendar doesn't support null, use undefined instead
  recurrence?: RecurrenceRule | null;
  reminders?: EventReminder[] | null;
  familyAssignments?: EventFamilyAssignments | null;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps?: {
    googleEventId: string;
    description?: string | null;
    location?: string | null;
    status?: string | null;
    calendarSummary?: string | null;
    metadata?: CalendarEventMetadata | null;
  };
};

export type CalendarEventsQuery = {
  from?: string;
  to?: string;
  tags?: string[];
  calendarIds?: string[];
};

// Sync status types
export type SyncStatus = {
  calendars: Array<{
    calendarId: string;
    summary: string;
    hasSyncToken: boolean;
    lastSyncedAt: string | null;
    eventCount: number;
  }>;
};

export type SyncResponse = {
  status: string;
  synced: number;
  created: number;
  updated: number;
  deleted: number;
  failed: number;
  fullSync: boolean;
  calendarsProcessed: number;
};
