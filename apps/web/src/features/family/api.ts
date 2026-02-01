import type {
  Family,
  Profile,
  FamilyRole,
  FamilyMember,
  FamilyInvite,
  InviteValidation,
  FamilyWithMembers,
} from '@family/shared';

import { getSession } from 'src/lib/supabase';
import { apiClient } from 'src/lib/api-client';

// ----------------------------------------------------------------------
// Auth helpers
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

// Try to get auth headers, return empty if not authenticated
async function tryGetAuthHeaders(): Promise<Record<string, string>> {
  try {
    return await getAuthHeaders();
  } catch {
    return {};
  }
}

// ----------------------------------------------------------------------
// PROFILE API
// ----------------------------------------------------------------------

export async function getProfile(): Promise<Profile> {
  const headers = await getAuthHeaders();
  return apiClient.get<Profile>('/api/profile', { headers });
}

export async function updateProfile(data: {
  displayName?: string;
  avatarUrl?: string | null;
  timezone?: string | null;
}): Promise<Profile> {
  const headers = await getAuthHeaders();
  return apiClient.patch<Profile>('/api/profile', data, { headers });
}

// ----------------------------------------------------------------------
// FAMILY API
// ----------------------------------------------------------------------

export async function getFamily(): Promise<{ family: FamilyWithMembers | null }> {
  const headers = await getAuthHeaders();
  return apiClient.get<{ family: FamilyWithMembers | null }>('/api/family', { headers });
}

export async function createFamily(name: string): Promise<FamilyWithMembers> {
  const headers = await getAuthHeaders();
  return apiClient.post<FamilyWithMembers>('/api/families', { name }, { headers });
}

export async function updateFamily(familyId: string, name: string): Promise<Family> {
  const headers = await getAuthHeaders();
  return apiClient.patch<Family>(`/api/families/${familyId}`, { name }, { headers });
}

export async function deleteFamily(familyId: string): Promise<{ success: boolean }> {
  const headers = await getAuthHeaders();
  return apiClient.delete<{ success: boolean }>(`/api/families/${familyId}`, { headers });
}

export async function leaveFamily(familyId: string): Promise<{ success: boolean }> {
  const headers = await getAuthHeaders();
  return apiClient.post<{ success: boolean }>(`/api/families/${familyId}/leave`, {}, { headers });
}

export async function transferOwnership(
  familyId: string,
  newOwnerId: string
): Promise<{ success: boolean }> {
  const headers = await getAuthHeaders();
  return apiClient.post<{ success: boolean }>(
    `/api/families/${familyId}/transfer`,
    { newOwnerId },
    { headers }
  );
}

// ----------------------------------------------------------------------
// MEMBER API
// ----------------------------------------------------------------------

export async function getFamilyMembers(familyId: string): Promise<FamilyMember[]> {
  const headers = await getAuthHeaders();
  return apiClient.get<FamilyMember[]>(`/api/families/${familyId}/members`, { headers });
}

export async function updateMember(
  familyId: string,
  memberId: string,
  data: {
    role?: Exclude<FamilyRole, 'owner'>;
    displayName?: string | null;
    color?: string | null;
  }
): Promise<FamilyMember> {
  const headers = await getAuthHeaders();
  return apiClient.patch<FamilyMember>(
    `/api/families/${familyId}/members/${memberId}`,
    data,
    { headers }
  );
}

export async function removeMember(
  familyId: string,
  memberId: string
): Promise<{ success: boolean }> {
  const headers = await getAuthHeaders();
  return apiClient.delete<{ success: boolean }>(
    `/api/families/${familyId}/members/${memberId}`,
    { headers }
  );
}

// ----------------------------------------------------------------------
// INVITE API
// ----------------------------------------------------------------------

export async function getFamilyInvites(familyId: string): Promise<FamilyInvite[]> {
  const headers = await getAuthHeaders();
  return apiClient.get<FamilyInvite[]>(`/api/families/${familyId}/invites`, { headers });
}

export async function createInvite(
  familyId: string,
  data: {
    email?: string | null;
    role?: Exclude<FamilyRole, 'owner'>;
    expiresInDays?: number;
  }
): Promise<FamilyInvite> {
  const headers = await getAuthHeaders();
  return apiClient.post<FamilyInvite>(`/api/families/${familyId}/invites`, data, { headers });
}

export async function revokeInvite(
  familyId: string,
  inviteId: string
): Promise<{ success: boolean }> {
  const headers = await getAuthHeaders();
  return apiClient.delete<{ success: boolean }>(
    `/api/families/${familyId}/invites/${inviteId}`,
    { headers }
  );
}

export async function validateInvite(token: string): Promise<InviteValidation> {
  const headers = await tryGetAuthHeaders();
  return apiClient.get<InviteValidation>(`/api/invites/${token}/validate`, { headers });
}

export async function acceptInvite(
  token: string
): Promise<{ success: boolean; familyId?: string }> {
  const headers = await getAuthHeaders();
  return apiClient.post<{ success: boolean; familyId?: string }>(
    `/api/invites/${token}/accept`,
    {},
    { headers }
  );
}

export async function declineInvite(token: string): Promise<{ success: boolean }> {
  const headers = await getAuthHeaders();
  return apiClient.post<{ success: boolean }>(`/api/invites/${token}/decline`, {}, { headers });
}

// ----------------------------------------------------------------------
// SHARED CALENDAR API
// ----------------------------------------------------------------------

export type SharedCalendarAccess = {
  hasAccess: boolean;
  sharedCalendarId: string | null;
  calendarName: string | null;
};

export async function setSharedCalendar(
  familyId: string,
  calendarId: string | null
): Promise<{ success: boolean; sharedCalendarId: string | null }> {
  const headers = await getAuthHeaders();
  return apiClient.put<{ success: boolean; sharedCalendarId: string | null }>(
    `/api/families/${familyId}/shared-calendar`,
    { calendarId },
    { headers }
  );
}

export async function checkSharedCalendarAccess(
  familyId: string
): Promise<SharedCalendarAccess> {
  const headers = await getAuthHeaders();
  return apiClient.get<SharedCalendarAccess>(
    `/api/families/${familyId}/shared-calendar/access`,
    { headers }
  );
}
