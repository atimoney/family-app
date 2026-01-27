import type {
  CalendarEventApi,
  CalendarEventItem,
  CalendarEventMetadata,
  CalendarEventsQuery,
} from '../types';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { getCalendarEvents, updateCalendarEventMetadata } from '../api';

const normalizeMetadata = (metadata: CalendarEventMetadata | null | undefined) =>
  metadata ?? { tags: [], notes: null, color: null, customJson: {} };

export function mapApiEventToCalendarEvent(event: CalendarEventApi): CalendarEventItem {
  const metadata = normalizeMetadata(event.metadata);
  const color = metadata.color ?? undefined;

  return {
    id: event.id,
    title: event.title,
    start: event.startsAt,
    end: event.endsAt,
    allDay: false,
    backgroundColor: color ?? undefined,
    borderColor: color ?? undefined,
    extendedProps: {
      googleEventId: event.googleEventId,
      status: event.status ?? null,
      metadata,
    },
  };
}

export type UseCalendarEventsState = {
  events: CalendarEventItem[];
  rawEvents: CalendarEventApi[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

const EMPTY_QUERY: CalendarEventsQuery = {};

export function useCalendarEvents(query: CalendarEventsQuery = EMPTY_QUERY): UseCalendarEventsState {
  const [rawEvents, setRawEvents] = useState<CalendarEventApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Memoize the query to prevent infinite loops from new object references
  const stableQuery = useMemo(
    () => ({ from: query.from, to: query.to, tags: query.tags }),
    [query.from, query.to, query.tags]
  );

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCalendarEvents(stableQuery);
      setRawEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load events'));
    } finally {
      setLoading(false);
    }
  }, [stableQuery]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const events = useMemo(() => rawEvents.map(mapApiEventToCalendarEvent), [rawEvents]);

  return {
    events,
    rawEvents,
    loading,
    error,
    refresh,
  };
}

export type UseUpdateEventMetadataState = {
  updateMetadata: (eventId: string, metadata: CalendarEventMetadata) => Promise<CalendarEventMetadata>;
  loading: boolean;
  error: Error | null;
};

export function useUpdateEventMetadata(): UseUpdateEventMetadataState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateMetadata = useCallback(async (eventId: string, metadata: CalendarEventMetadata) => {
    try {
      setLoading(true);
      setError(null);
      return await updateCalendarEventMetadata(eventId, metadata);
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error('Failed to update metadata');
      setError(nextError);
      throw nextError;
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateMetadata, loading, error };
}
