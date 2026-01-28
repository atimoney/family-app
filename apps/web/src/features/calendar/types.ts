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

export type CalendarEventApi = {
  id: string;
  googleEventId: string;
  startsAt: string;
  endsAt: string;
  title: string;
  status?: string | null;
  metadata: CalendarEventMetadata | null;
};

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
    status?: string | null;
    metadata?: CalendarEventMetadata | null;
  };
};

export type CalendarEventsQuery = {
  from?: string;
  to?: string;
  tags?: string[];
};
