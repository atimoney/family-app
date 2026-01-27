import { useState, useEffect, useCallback } from 'react';

import { getGoogleOAuthUrl, getGoogleConnectionStatus, type GoogleConnectionStatus } from '../api';

// ----------------------------------------------------------------------

type UseGoogleIntegrationReturn = {
  status: GoogleConnectionStatus | null;
  loading: boolean;
  error: Error | null;
  connect: () => Promise<void>;
  refresh: () => Promise<void>;
};

export function useGoogleIntegration(): UseGoogleIntegrationReturn {
  const [status, setStatus] = useState<GoogleConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
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
      const { url } = await getGoogleOAuthUrl();
      // Redirect to Google OAuth
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get OAuth URL'));
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    connect,
    refresh: fetchStatus,
  };
}
