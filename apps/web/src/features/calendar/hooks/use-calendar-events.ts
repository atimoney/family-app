import type { CreateEventInput } from '../api';
import type {
  SyncResponse,
  CalendarEventApi,
  CalendarEventItem,
  CalendarEventsQuery,
  CalendarEventMetadata,
} from '../types';

import { useMemo, useState, useEffect, useCallback } from 'react';

import {
  syncCalendar,
  getCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
  updateCalendarEventMetadata,
} from '../api';

// ----------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------

const normalizeMetadata = (metadata: CalendarEventMetadata | null | undefined): CalendarEventMetadata =>
  metadata ?? { 
    tags: [], 
    notes: null, 
    color: null, 
    category: null,
    audience: 'family',
    categoryMetadata: {},
    customJson: {} 
  };

export function mapApiEventToCalendarEvent(event: CalendarEventApi): CalendarEventItem {
  const metadata = normalizeMetadata(event.metadata);
  // Use metadata color override, or calendar color as fallback
  const color = metadata.color ?? event.calendarColor ?? undefined;

  return {
    id: event.id,
    title: event.title,
    start: event.startsAt,
    end: event.endsAt,
    allDay: event.allDay,
    calendarId: event.calendarId,
    backgroundColor: color ?? undefined,
    borderColor: color ?? undefined,
    textColor: color ? '#ffffff' : undefined,
    googleEventColor: event.googleEventColor ?? null, // Google event's own color
    familyAssignments: metadata.familyAssignments ?? null,
    // E1: Map category, audience, tags, and categoryMetadata
    category: metadata.category ?? null,
    audience: metadata.audience ?? 'family',
    tags: metadata.tags ?? [],
    categoryMetadata: metadata.categoryMetadata ?? null,
    extendedProps: {
      googleEventId: event.googleEventId,
      description: event.description,
      location: event.location,
      status: event.status ?? null,
      calendarSummary: event.calendarSummary,
      metadata,
    },
  };
}

// ----------------------------------------------------------------------
// MAIN HOOK: useCalendarEvents
// ----------------------------------------------------------------------

export type UseCalendarEventsState = {
  events: CalendarEventItem[];
  rawEvents: CalendarEventApi[];
  loading: boolean;
  syncing: boolean;
  error: Error | null;
  lastSynced: Date | null;
  refresh: () => Promise<void>;
  sync: (options?: { force?: boolean }) => Promise<SyncResponse>;
};

const EMPTY_QUERY: CalendarEventsQuery = {};

export function useCalendarEvents(
  query: CalendarEventsQuery = EMPTY_QUERY
): UseCalendarEventsState {
  const [rawEvents, setRawEvents] = useState<CalendarEventApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // Memoize the query to prevent infinite loops from new object references
  const stableQuery = useMemo(
    () => ({
      from: query.from,
      to: query.to,
      tags: query.tags,
      calendarIds: query.calendarIds,
    }),
    [query.from, query.to, query.tags, query.calendarIds]
  );

  // Fetch events from local cache
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

  // Sync events from Google Calendar
  const sync = useCallback(
    async (options?: { force?: boolean }): Promise<SyncResponse> => {
      try {
        setSyncing(true);
        setError(null);
        const result = await syncCalendar(options);
        setLastSynced(new Date());
        // Refresh local events after sync
        await refresh();
        return result;
      } catch (err) {
        const syncError = err instanceof Error ? err : new Error('Sync failed');
        setError(syncError);
        throw syncError;
      } finally {
        setSyncing(false);
      }
    },
    [refresh]
  );

  // Initial load - fetch from cache, then sync in background
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      // First, load from cache
      await refresh();

      // Then sync in background (don't await, don't block UI)
      if (mounted) {
        sync().catch((err) => {
          console.warn('Background sync failed:', err);
        });
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
    // Only run on mount and query change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableQuery]);

  const events = useMemo(() => rawEvents.map(mapApiEventToCalendarEvent), [rawEvents]);

  return {
    events,
    rawEvents,
    loading,
    syncing,
    error,
    lastSynced,
    refresh,
    sync,
  };
}

// ----------------------------------------------------------------------
// HOOK: useUpdateEventMetadata
// ----------------------------------------------------------------------

export type UseUpdateEventMetadataState = {
  updateMetadata: (
    eventId: string,
    metadata: Partial<CalendarEventMetadata>
  ) => Promise<CalendarEventMetadata>;
  loading: boolean;
  error: Error | null;
};

export function useUpdateEventMetadata(): UseUpdateEventMetadataState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateMetadata = useCallback(
    async (eventId: string, metadata: Partial<CalendarEventMetadata>) => {
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
    },
    []
  );

  return { updateMetadata, loading, error };
}

// ----------------------------------------------------------------------
// HOOK: useCalendarMutations
// ----------------------------------------------------------------------

export type UseCalendarMutationsState = {
  createEvent: (event: CreateEventInput) => Promise<void>;
  updateEvent: (eventId: string, event: Partial<CreateEventInput> & { calendarId?: string; sourceCalendarId?: string; updateScope?: 'instance' | 'all' }) => Promise<void>;
  deleteEvent: (eventId: string, calendarId?: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
};

export function useCalendarMutations(
  onSuccess?: () => Promise<void>
): UseCalendarMutationsState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleCreate = useCallback(
    async (event: CreateEventInput) => {
      try {
        setLoading(true);
        setError(null);
        await createCalendarEvent(event);
        // Sync to get the new event in local cache
        await syncCalendar();
        await onSuccess?.();
      } catch (err) {
        const nextError = err instanceof Error ? err : new Error('Failed to create event');
        setError(nextError);
        throw nextError;
      } finally {
        setLoading(false);
      }
    },
    [onSuccess]
  );

  const handleUpdate = useCallback(
    async (eventId: string, event: Partial<CreateEventInput> & { calendarId?: string; sourceCalendarId?: string; updateScope?: 'instance' | 'all' }) => {
      try {
        setLoading(true);
        setError(null);
        await updateCalendarEvent(eventId, event);
        // Sync to get updated event in local cache
        await syncCalendar();
        await onSuccess?.();
      } catch (err) {
        const nextError = err instanceof Error ? err : new Error('Failed to update event');
        setError(nextError);
        throw nextError;
      } finally {
        setLoading(false);
      }
    },
    [onSuccess]
  );

  const handleDelete = useCallback(
    async (eventId: string, calendarId?: string) => {
      try {
        setLoading(true);
        setError(null);
        await deleteCalendarEvent(eventId, calendarId);
        // Sync to remove event from local cache
        await syncCalendar();
        await onSuccess?.();
      } catch (err) {
        const nextError = err instanceof Error ? err : new Error('Failed to delete event');
        setError(nextError);
        throw nextError;
      } finally {
        setLoading(false);
      }
    },
    [onSuccess]
  );

  return {
    createEvent: handleCreate,
    updateEvent: handleUpdate,
    deleteEvent: handleDelete,
    loading,
    error,
  };
}
