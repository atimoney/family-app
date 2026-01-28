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

// ============================================================================
// E1: EVENT METADATA - CATEGORIES, AUDIENCE & CATEGORY-SPECIFIC DATA
// ============================================================================

/** E1: Event category enum */
export type EventCategory =
  | 'Meal'
  | 'School'
  | 'Sport'
  | 'Activity'
  | 'Chore'
  | 'Appointment'
  | 'Work'
  | 'Travel'
  | 'Home'
  | 'Admin';

/** E1: Event audience enum */
export type EventAudience = 'family' | 'adults' | 'kids';

/** E1: Meal category metadata */
export type MealMetadata = {
  mealType?: 'breakfast' | 'lunch' | 'dinner' | null;
  kidFriendly?: boolean;
  recipeRef?: string | null;
};

/** E1: School category metadata */
export type SchoolMetadata = {
  schoolName?: string | null;
};

/** E1: Sport category metadata */
export type SportMetadata = {
  sportName?: string | null;
  teamName?: string | null;
  homeAway?: 'home' | 'away' | null;
  arrivalBufferMins?: number | null;
};

/** E1: Chore category metadata */
export type ChoreMetadata = {
  rewardPoints?: number | null;
  completionRequired?: boolean;
};

/** E1: Appointment category metadata */
export type AppointmentMetadata = {
  appointmentType?: string | null;
  providerName?: string | null;
  transportRequired?: boolean;
};

/** E1: Travel category metadata */
export type TravelMetadata = {
  tripName?: string | null;
  mode?: 'flight' | 'car' | 'train' | 'other' | null;
  bookingRef?: string | null;
};

/** E1: Home category metadata */
export type HomeMetadata = {
  tradeType?: string | null;
  contractorName?: string | null;
  urgency?: 'low' | 'med' | 'high' | null;
};

/** E1: Admin category metadata */
export type AdminMetadata = {
  status?: 'pending' | 'done' | null;
  dueDate?: string | null;
  referenceLink?: string | null;
};

/** E1: Union type for all category-specific metadata */
export type CategoryMetadata =
  | MealMetadata
  | SchoolMetadata
  | SportMetadata
  | ChoreMetadata
  | AppointmentMetadata
  | TravelMetadata
  | HomeMetadata
  | AdminMetadata
  | Record<string, unknown>;

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
