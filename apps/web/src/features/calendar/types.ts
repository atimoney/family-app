export type CalendarEventMetadata = {
  tags: string[];
  notes: string | null;
  color: string | null;
  customJson?: Record<string, unknown>;
};

export type CalendarInfo = {
  id: string;
  summary: string;
  timeZone: string | null;
  primary: boolean;
  backgroundColor: string | null;
  isSelected: boolean;
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
