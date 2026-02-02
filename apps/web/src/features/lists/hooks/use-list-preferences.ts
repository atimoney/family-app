import type { UserListPreferencesDTO } from '../types';

import { useState, useEffect, useCallback } from 'react';

import { getListPreferences } from '../api';

// ----------------------------------------------------------------------

export type UseListPreferencesReturn = {
  preferences: UserListPreferencesDTO | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

export function useListPreferences(listId: string | null): UseListPreferencesReturn {
  const [preferences, setPreferences] = useState<UserListPreferencesDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!listId) {
      setPreferences(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getListPreferences(listId);
      setPreferences(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load list preferences'));
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    preferences,
    loading,
    error,
    refresh,
  };
}
