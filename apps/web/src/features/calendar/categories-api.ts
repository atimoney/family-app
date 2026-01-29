import type {
  EventCategoryConfig,
  CreateCategoryInput,
  UpdateCategoryInput,
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

// ----------------------------------------------------------------------
// EVENT CATEGORIES API
// ----------------------------------------------------------------------

/**
 * Get all event categories for a family
 */
export async function getEventCategories(familyId: string): Promise<EventCategoryConfig[]> {
  const headers = await getAuthHeaders();
  return apiClient.get<EventCategoryConfig[]>(`/api/families/${familyId}/categories`, { headers });
}

/**
 * Create a new event category
 */
export async function createEventCategory(
  familyId: string,
  data: CreateCategoryInput
): Promise<EventCategoryConfig> {
  const headers = await getAuthHeaders();
  return apiClient.post<EventCategoryConfig>(`/api/families/${familyId}/categories`, data, { headers });
}

/**
 * Update an existing event category
 */
export async function updateEventCategory(
  familyId: string,
  categoryId: string,
  data: UpdateCategoryInput
): Promise<EventCategoryConfig> {
  const headers = await getAuthHeaders();
  return apiClient.patch<EventCategoryConfig>(
    `/api/families/${familyId}/categories/${categoryId}`,
    data,
    { headers }
  );
}

/**
 * Delete an event category
 */
export async function deleteEventCategory(
  familyId: string,
  categoryId: string
): Promise<{ success: boolean }> {
  const headers = await getAuthHeaders();
  return apiClient.delete<{ success: boolean }>(
    `/api/families/${familyId}/categories/${categoryId}`,
    { headers }
  );
}

/**
 * Reorder event categories
 */
export async function reorderEventCategories(
  familyId: string,
  categoryIds: string[]
): Promise<EventCategoryConfig[]> {
  const headers = await getAuthHeaders();
  return apiClient.post<EventCategoryConfig[]>(
    `/api/families/${familyId}/categories/reorder`,
    { categoryIds },
    { headers }
  );
}
