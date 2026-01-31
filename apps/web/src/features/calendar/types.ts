/**
 * E2: Family member assignments for calendar events.
 * All fields are optional to ensure backward compatibility.
 */
export type EventFamilyAssignments = {
  /** Primary family member responsible for this event */
  primaryFamilyMemberId?: string | null;
  /** Family members participating in this event */
  participantFamilyMemberIds?: string[];
  /** Who is cooking (for meal-related events) */
  cookMemberId?: string | null;
  /** Who is assigned to do it */
  assignedToMemberId?: string | null;
};

// ============================================================================
// EVENT AUDIT TRACKING
// ============================================================================

/**
 * Source of an event modification - helps track where changes came from
 */
export type EventEditSource = 'user' | 'dashboard' | 'system' | 'sync';

/**
 * Audit information for tracking who made changes and when.
 * Used for both creation and updates of calendar events.
 */
export type EventAuditInfo = {
  /** ID of the user who made the change (profile ID) */
  modifiedBy: string | null;
  /** Display name of the user at time of change */
  modifiedByName: string | null;
  /** Timestamp of when the change was made */
  modifiedAt: string;
  /** Source of the modification */
  editSource: EventEditSource;
  /** Whether this was made in dashboard mode (shared device) */
  isDashboardMode: boolean;
  /** Optional note about the change */
  changeNote?: string | null;
};

/**
 * Full audit trail entry for event history
 */
export type EventAuditEntry = EventAuditInfo & {
  /** Type of change made */
  action: 'created' | 'updated' | 'deleted';
  /** Previous values (for updates) */
  previousValues?: Record<string, unknown>;
};

// ============================================================================
// E1: EVENT METADATA - CATEGORIES, AUDIENCE & CATEGORY-SPECIFIC DATA
// ============================================================================

/** E1: Event category enum */
export type EventCategory =
  | 'School'
  | 'Sport'
  | 'Activity'
  | 'Social'
  | 'Appointment'
  | 'Work'
  | 'Travel'
  | 'Home'
  | 'Admin';

/** E1: Event audience enum */
export type EventAudience = 'family' | 'adults' | 'kids';

/** Category metadata - generic type for user-defined category fields */
export type CategoryMetadata = Record<string, unknown>;

export type CalendarEventMetadata = {
  tags: string[];
  notes: string | null;
  color: string | null;
  // E1: New metadata fields
  category?: EventCategory | null;
  audience?: EventAudience | null;
  categoryMetadata?: CategoryMetadata | null;
  customJson?: Record<string, unknown>;
  familyAssignments?: EventFamilyAssignments | null;
  // Audit tracking
  createdAudit?: EventAuditInfo | null;
  lastModifiedAudit?: EventAuditInfo | null;
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
  googleEventColor?: string | null; // Google event's own color (from colorId)
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
  googleEventColor?: string | null; // Google event's own color (from colorId)
  recurrence?: RecurrenceRule | null;
  reminders?: EventReminder[] | null;
  familyAssignments?: EventFamilyAssignments | null;
  // E1: Event metadata fields
  category?: EventCategory | null;
  audience?: EventAudience | null;
  tags?: string[];
  categoryMetadata?: CategoryMetadata | null;
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
