import type {
  CalendarEventApi,
  CalendarEventMetadata,
  CalendarEventsQuery,
  CalendarInfo,
  SyncResponse,
  SyncStatus,
  RecurrenceRule,
  EventReminder,
} from './types';

import { getSession } from 'src/lib/supabase';
import { apiClient } from 'src/lib/api-client';

// ----------------------------------------------------------------------

async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

// ----------------------------------------------------------------------
// CALENDAR EVENTS (from local cache)
// ----------------------------------------------------------------------

export async function getCalendarEvents(
  query: CalendarEventsQuery = {}
): Promise<CalendarEventApi[]> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();

  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.tags?.length) params.set('tags', query.tags.join(','));
  if (query.calendarIds?.length) params.set('calendarIds', query.calendarIds.join(','));

  const suffix = params.toString() ? `?${params.toString()}` : '';

  // Fetch from local cache (synced events)
  return apiClient.get<CalendarEventApi[]>(`/events${suffix}`, { headers });
}

export async function getCalendarEvent(eventId: string): Promise<CalendarEventApi> {
  const headers = await getAuthHeaders();
  return apiClient.get<CalendarEventApi>(`/events/${eventId}`, { headers });
}

// ----------------------------------------------------------------------
// CALENDARS
// ----------------------------------------------------------------------

export async function getCalendars(): Promise<CalendarInfo[]> {
  const headers = await getAuthHeaders();
  return apiClient.get<CalendarInfo[]>('/v1/calendar/calendars', { headers });
}

export async function getSelectedCalendars(): Promise<CalendarInfo[]> {
  const calendars = await getCalendars();
  return calendars.filter((c) => c.isSelected);
}

export async function updateCalendarSelection(calendarIds: string[]): Promise<{ ok: boolean }> {
  const headers = await getAuthHeaders();
  return apiClient.put<{ ok: boolean }>(
    '/v1/calendar/calendars/selection',
    { calendarIds },
    { headers }
  );
}

// ----------------------------------------------------------------------
// EVENT MUTATIONS (via Google Calendar API)
// ----------------------------------------------------------------------

export type CreateEventInput = {
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  calendarId?: string;
  description?: string | null;
  location?: string | null;
  color?: string | null;
  recurrence?: RecurrenceRule | null;
  reminders?: EventReminder[] | null;
};

type GoogleCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  calendarId: string;
  description?: string | null;
  location?: string | null;
};

export async function createCalendarEvent(event: CreateEventInput): Promise<GoogleCalendarEvent> {
  const headers = await getAuthHeaders();
  return apiClient.post<GoogleCalendarEvent>('/v1/calendar/events', event, {
    headers,
  });
}

export async function updateCalendarEvent(
  eventId: string,
  event: Partial<CreateEventInput> & { calendarId?: string }
): Promise<GoogleCalendarEvent> {
  const headers = await getAuthHeaders();
  return apiClient.patch<GoogleCalendarEvent>(`/v1/calendar/events/${eventId}`, event, {
    headers,
  });
}

export async function deleteCalendarEvent(
  eventId: string,
  calendarId?: string
): Promise<{ ok: boolean }> {
  const headers = await getAuthHeaders();
  const params = calendarId ? `?calendarId=${encodeURIComponent(calendarId)}` : '';
  return apiClient.delete<{ ok: boolean }>(`/v1/calendar/events/${eventId}${params}`, {
    headers,
  });
}

// ----------------------------------------------------------------------
// EVENT METADATA
// ----------------------------------------------------------------------

export async function updateCalendarEventMetadata(
  eventId: string,
  metadata: Partial<CalendarEventMetadata>
): Promise<CalendarEventMetadata> {
  const headers = await getAuthHeaders();
  return apiClient.patch<CalendarEventMetadata>(`/events/${eventId}/metadata`, metadata, {
    headers,
  });
}

// ----------------------------------------------------------------------
// SYNC
// ----------------------------------------------------------------------

export async function syncCalendar(options?: {
  force?: boolean;
  calendarId?: string;
}): Promise<SyncResponse> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();

  if (options?.force) params.set('force', 'true');
  if (options?.calendarId) params.set('calendarId', options.calendarId);

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return apiClient.post<SyncResponse>(`/integrations/google/sync${suffix}`, {}, { headers });
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const headers = await getAuthHeaders();
  return apiClient.get<SyncStatus>('/integrations/google/sync/status', { headers });
}

export async function clearSyncState(calendarId?: string): Promise<{ status: string }> {
  const headers = await getAuthHeaders();
  const params = calendarId ? `?calendarId=${encodeURIComponent(calendarId)}` : '';
  return apiClient.delete<{ status: string }>(`/integrations/google/sync${params}`, { headers });
}
