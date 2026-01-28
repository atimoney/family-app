import type { CalendarInfo } from '../types';

import { useState, useEffect, useCallback } from 'react';

import { getSelectedCalendars } from '../api';

export type UseCalendarsState = {
  calendars: CalendarInfo[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

export function useSelectedCalendars(): UseCalendarsState {
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSelectedCalendars();
      setCalendars(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load calendars'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    calendars,
    loading,
    error,
    refresh,
  };
}
