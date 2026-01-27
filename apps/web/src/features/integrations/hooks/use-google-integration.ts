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
      console.log('Fetching Google connection status...');
      const result = await getGoogleConnectionStatus();
      console.log('Google connection status:', result);
      setStatus(result);
    } catch (err) {
      console.error('Failed to fetch Google status:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch status'));
    } finally {
      setLoading(false);
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      console.log('Getting OAuth URL...');
      const response = await getGoogleOAuthUrl();
      console.log('OAuth URL response:', response);
      if (response?.url) {
        // Redirect to Google OAuth
        window.location.href = response.url;
      } else {
        console.error('No URL in response:', response);
        setError(new Error('No OAuth URL returned'));
      }
    } catch (err) {
      console.error('Failed to get OAuth URL:', err);
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
