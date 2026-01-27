import type { CalendarEventApi, CalendarEventMetadata, CalendarEventsQuery } from './types';

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

export async function getCalendarEvents(
  query: CalendarEventsQuery = {}
): Promise<CalendarEventApi[]> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();

  if (query.from) params.set('timeMin', query.from);
  if (query.to) params.set('timeMax', query.to);

  const suffix = params.toString() ? `?${params.toString()}` : '';
  
  // Fetch directly from Google Calendar API
  const response = await apiClient.get<GoogleCalendarEvent[]>(`/v1/calendar/events${suffix}`, { headers });
  
  // Transform to CalendarEventApi format
  return response.map((event) => ({
    id: event.id,
    googleEventId: event.id,
    startsAt: event.start,
    endsAt: event.end,
    title: event.title,
    status: null,
    metadata: event.extraData ? {
      tags: event.extraData.tags ?? [],
      notes: event.extraData.notes ?? null,
      color: event.extraData.color ?? null,
      customJson: {},
    } : null,
  }));
}

type GoogleCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  calendarId: string;
  extraData?: {
    tags?: string[];
    category?: string | null;
    notes?: string | null;
    color?: string | null;
  };
};

export async function updateCalendarEventMetadata(
  eventId: string,
  metadata: CalendarEventMetadata
): Promise<CalendarEventMetadata> {
  const headers = await getAuthHeaders();
  return apiClient.patch<CalendarEventMetadata>(`/events/${eventId}/metadata`, metadata, {
    headers,
  });
}
