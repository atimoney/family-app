import { getSession } from 'src/lib/supabase';
import { apiClient } from 'src/lib/api-client';

// ----------------------------------------------------------------------

async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

// ----------------------------------------------------------------------

export type GoogleConnectionStatus = {
  connected: boolean;
  email?: string;
  connectedAt?: string;
};

export type GoogleOAuthUrl = {
  url: string;
};

// ----------------------------------------------------------------------

export async function getGoogleConnectionStatus(): Promise<GoogleConnectionStatus> {
  const headers = await getAuthHeaders();
  return apiClient.get<GoogleConnectionStatus>('/v1/calendar/oauth/status', { headers });
}

export async function getGoogleOAuthUrl(): Promise<GoogleOAuthUrl> {
  const headers = await getAuthHeaders();
  return apiClient.get<GoogleOAuthUrl>('/v1/calendar/oauth/url', { headers });
}
