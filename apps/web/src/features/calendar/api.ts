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

  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.tags?.length) params.set('tags', query.tags.join(','));

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return apiClient.get<CalendarEventApi[]>(`/events${suffix}`, { headers });
}

export async function updateCalendarEventMetadata(
  eventId: string,
  metadata: CalendarEventMetadata
): Promise<CalendarEventMetadata> {
  const headers = await getAuthHeaders();
  return apiClient.patch<CalendarEventMetadata>(`/events/${eventId}/metadata`, metadata, {
    headers,
  });
}
