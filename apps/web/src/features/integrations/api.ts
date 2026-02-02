import { apiClient } from 'src/lib/api-client';
import { getAuthHeaders } from 'src/lib/auth-helpers';

// ----------------------------------------------------------------------
// GOOGLE OAUTH STATUS
// ----------------------------------------------------------------------

export type GoogleConnectionStatus = {
  connected: boolean;
  email?: string;
  connectedAt?: string;
};

export type GoogleOAuthUrl = {
  url: string;
};

export async function getGoogleConnectionStatus(): Promise<GoogleConnectionStatus> {
  const headers = await getAuthHeaders();
  return apiClient.get<GoogleConnectionStatus>('/v1/calendar/oauth/status', { headers });
}

export async function getGoogleOAuthUrl(): Promise<GoogleOAuthUrl> {
  const headers = await getAuthHeaders();
  return apiClient.get<GoogleOAuthUrl>('/v1/calendar/oauth/url', { headers });
}

// ----------------------------------------------------------------------
// CALENDARS
// ----------------------------------------------------------------------

export type GoogleCalendar = {
  id: string;
  summary: string;
  timeZone: string | null;
  primary: boolean;
  backgroundColor: string | null;
  isSelected: boolean;
};

export async function getGoogleCalendars(): Promise<GoogleCalendar[]> {
  const headers = await getAuthHeaders();
  return apiClient.get<GoogleCalendar[]>('/v1/calendar/calendars', { headers });
}

export async function updateCalendarSelection(calendarIds: string[]): Promise<{ ok: boolean }> {
  const headers = await getAuthHeaders();
  return apiClient.put<{ ok: boolean }>(
    '/v1/calendar/calendars/selection',
    { calendarIds },
    { headers }
  );
}

// ----------------------------------------------------------------------
// SYNC
// ----------------------------------------------------------------------

export type SyncResponse = {
  status: string;
  synced: number;
  created: number;
  updated: number;
  deleted: number;
  failed: number;
  fullSync: boolean;
  calendarsProcessed: number;
};

export type SyncStatus = {
  calendars: Array<{
    calendarId: string;
    summary: string;
    hasSyncToken: boolean;
    lastSyncedAt: string | null;
    eventCount: number;
  }>;
};

export async function syncGoogleCalendar(options?: {
  force?: boolean;
  calendarId?: string;
}): Promise<SyncResponse> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();

  if (options?.force) params.set('force', 'true');
  if (options?.calendarId) params.set('calendarId', options.calendarId);

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return apiClient.post<SyncResponse>(`/integrations/google/sync${suffix}`, {}, { headers });
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const headers = await getAuthHeaders();
  return apiClient.get<SyncStatus>('/integrations/google/sync/status', { headers });
}

export async function clearSyncState(calendarId?: string): Promise<{ status: string }> {
  const headers = await getAuthHeaders();
  const params = calendarId ? `?calendarId=${encodeURIComponent(calendarId)}` : '';
  return apiClient.delete<{ status: string }>(`/integrations/google/sync${params}`, { headers });
}
