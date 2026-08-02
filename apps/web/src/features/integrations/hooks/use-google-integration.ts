import { useState, useEffect, useCallback } from 'react';

import {
  getGoogleOAuthUrl,
  type SyncResponse,
  syncGoogleCalendar,
  getGoogleConnectionStatus,
  type GoogleConnectionStatus,
} from '../api';

// ----------------------------------------------------------------------

type UseGoogleIntegrationReturn = {
  status: GoogleConnectionStatus | null;
  loading: boolean;
  syncing: boolean;
  error: Error | null;
  connect: () => Promise<void>;
  refresh: () => Promise<void>;
  sync: (options?: { force?: boolean; calendarId?: string }) => Promise<SyncResponse | null>;
};

export function useGoogleIntegration(): UseGoogleIntegrationReturn {
  const [status, setStatus] = useState<GoogleConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getGoogleConnectionStatus();
      setStatus(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch status'));
    } finally {
      setLoading(false);
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      const response = await getGoogleOAuthUrl();
      if (response?.url) {
        // Redirect to Google OAuth
        window.location.href = response.url;
      } else {
        setError(new Error('No OAuth URL returned'));
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get OAuth URL'));
    }
  }, []);

  const sync = useCallback(
    async (options?: { force?: boolean; calendarId?: string }): Promise<SyncResponse | null> => {
      try {
        setSyncing(true);
        setError(null);
        const result = await syncGoogleCalendar(options);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to sync calendar'));
        return null;
      } finally {
        setSyncing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    loading,
    syncing,
    error,
    connect,
    refresh: fetchStatus,
    sync,
  };
}
