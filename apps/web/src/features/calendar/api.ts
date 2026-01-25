import type { CalendarEvent } from '@family/shared';

import { apiClient } from 'src/lib/api-client';

// ----------------------------------------------------------------------

export type CreateCalendarEventInput = Omit<CalendarEvent, 'id'>;

// ----------------------------------------------------------------------

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  return apiClient.get<CalendarEvent[]>('/v1/calendar/events');
}

export async function createCalendarEvent(
  data: CreateCalendarEventInput
): Promise<CalendarEvent> {
  return apiClient.post<CalendarEvent>('/v1/calendar/events', data);
}
