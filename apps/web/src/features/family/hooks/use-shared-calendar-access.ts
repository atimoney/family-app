import { useState, useEffect, useCallback } from 'react';

import { checkSharedCalendarAccess, type SharedCalendarAccess } from '../api';

// ----------------------------------------------------------------------

type UseSharedCalendarAccessReturn = {
  /** Whether the user has access to the family shared calendar */
  hasAccess: boolean;
  /** The family's shared calendar ID (null if none set) */
  sharedCalendarId: string | null;
  /** The calendar name (null if no access or none set) */
  calendarName: string | null;
  /** Whether there's a shared calendar configured for the family */
  hasSharedCalendar: boolean;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Refresh the access status */
  refresh: () => Promise<void>;
};

export function useSharedCalendarAccess(familyId: string | null): UseSharedCalendarAccessReturn {
  const [data, setData] = useState<SharedCalendarAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAccess = useCallback(async () => {
    if (!familyId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await checkSharedCalendarAccess(familyId);
      setData(result);
    } catch (err) {
      console.error('Failed to check shared calendar access:', err);
      setError(err instanceof Error ? err : new Error('Failed to check shared calendar access'));
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    fetchAccess();
  }, [fetchAccess]);

  return {
    hasAccess: data?.hasAccess ?? false,
    sharedCalendarId: data?.sharedCalendarId ?? null,
    calendarName: data?.calendarName ?? null,
    hasSharedCalendar: !!data?.sharedCalendarId,
    loading,
    error,
    refresh: fetchAccess,
  };
}
