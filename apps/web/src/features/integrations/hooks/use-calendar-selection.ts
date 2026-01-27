import { useCallback, useEffect, useState } from 'react';

import {
  getGoogleCalendars,
  updateCalendarSelection,
  type GoogleCalendar,
} from '../api';

// ----------------------------------------------------------------------

type UseCalendarSelectionReturn = {
  calendars: GoogleCalendar[];
  loading: boolean;
  error: Error | null;
  toggleCalendar: (calendarId: string) => void;
  saveSelection: () => Promise<void>;
  refresh: () => Promise<void>;
  hasChanges: boolean;
};

export function useCalendarSelection(): UseCalendarSelectionReturn {
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [originalSelection, setOriginalSelection] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCalendars = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getGoogleCalendars();
      // Ensure isSelected is always a boolean to prevent uncontrolled->controlled warning
      const normalizedCalendars = result.map((cal) => ({
        ...cal,
        isSelected: Boolean(cal.isSelected),
      }));
      setCalendars(normalizedCalendars);
      setOriginalSelection(new Set(normalizedCalendars.filter((c) => c.isSelected).map((c) => c.id)));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch calendars'));
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleCalendar = useCallback((calendarId: string) => {
    setCalendars((prev) =>
      prev.map((cal) =>
        cal.id === calendarId ? { ...cal, isSelected: !cal.isSelected } : cal
      )
    );
  }, []);

  const saveSelection = useCallback(async () => {
    try {
      setLoading(true);
      const selectedIds = calendars.filter((c) => c.isSelected).map((c) => c.id);
      await updateCalendarSelection(selectedIds);
      setOriginalSelection(new Set(selectedIds));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to save selection'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [calendars]);

  const hasChanges = useCallback(() => {
    const currentSelection = new Set(calendars.filter((c) => c.isSelected).map((c) => c.id));
    if (currentSelection.size !== originalSelection.size) return true;
    for (const id of currentSelection) {
      if (!originalSelection.has(id)) return true;
    }
    return false;
  }, [calendars, originalSelection]);

  useEffect(() => {
    fetchCalendars();
  }, [fetchCalendars]);

  return {
    calendars,
    loading,
    error,
    toggleCalendar,
    saveSelection,
    refresh: fetchCalendars,
    hasChanges: hasChanges(),
  };
}
