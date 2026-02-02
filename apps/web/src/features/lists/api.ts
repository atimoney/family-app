import type {
  ListDTO,
  ListsQuery,
  ListItemDTO,
  ListWithItems,
  ListItemsQuery,
  CreateListInput,
  UpdateListInput,
  CreateListItemInput,
  UpdateListItemInput,
  UserListPreferencesDTO,
  UserListPreferencesInput,
} from './types';

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
// LISTS CRUD
// ----------------------------------------------------------------------

/**
 * Get all lists for the current family.
 */
export async function getLists(query: ListsQuery = {}): Promise<ListDTO[]> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();

  if (query.navVisibility) params.set('navVisibility', query.navVisibility);
  if (query.templateKey) params.set('templateKey', query.templateKey);

  const suffix = params.toString() ? `?${params.toString()}` : '';

  return apiClient.get<ListDTO[]>(`/api/lists${suffix}`, { headers });
}

/**
 * Get a single list by ID.
 * @param includeItems - If true, includes all items in the response
 */
export async function getList(listId: string, includeItems = false): Promise<ListWithItems> {
  const headers = await getAuthHeaders();
  const suffix = includeItems ? '?includeItems=true' : '';

  return apiClient.get<ListWithItems>(`/api/lists/${listId}${suffix}`, { headers });
}

/**
 * Create a new list.
 */
export async function createList(input: CreateListInput): Promise<ListDTO> {
  const headers = await getAuthHeaders();
  return apiClient.post<ListDTO>('/api/lists', input, { headers });
}

/**
 * Update an existing list.
 */
export async function updateList(listId: string, input: UpdateListInput): Promise<ListDTO> {
  const headers = await getAuthHeaders();
  return apiClient.patch<ListDTO>(`/api/lists/${listId}`, input, { headers });
}

/**
 * Delete a list (cascades to items and preferences).
 */
export async function deleteList(listId: string): Promise<void> {
  const headers = await getAuthHeaders();
  return apiClient.delete<void>(`/api/lists/${listId}`, { headers });
}

// ----------------------------------------------------------------------
// LIST ITEMS CRUD
// ----------------------------------------------------------------------

/**
 * Get items for a list.
 */
export async function getListItems(listId: string, query: ListItemsQuery = {}): Promise<ListItemDTO[]> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();

  if (query.status) {
    const statusArr = Array.isArray(query.status) ? query.status : [query.status];
    statusArr.forEach((s) => params.append('status', s));
  }
  if (query.includeArchived) params.set('includeArchived', 'true');

  const suffix = params.toString() ? `?${params.toString()}` : '';

  return apiClient.get<ListItemDTO[]>(`/api/lists/${listId}/items${suffix}`, { headers });
}

/**
 * Create a new item in a list.
 */
export async function createListItem(listId: string, input: CreateListItemInput): Promise<ListItemDTO> {
  const headers = await getAuthHeaders();
  return apiClient.post<ListItemDTO>(`/api/lists/${listId}/items`, input, { headers });
}

/**
 * Update an existing list item.
 */
export async function updateListItem(itemId: string, input: UpdateListItemInput): Promise<ListItemDTO> {
  const headers = await getAuthHeaders();
  return apiClient.patch<ListItemDTO>(`/api/items/${itemId}`, input, { headers });
}

/**
 * Delete a list item.
 */
export async function deleteListItem(itemId: string): Promise<void> {
  const headers = await getAuthHeaders();
  return apiClient.delete<void>(`/api/items/${itemId}`, { headers });
}

// ----------------------------------------------------------------------
// USER LIST PREFERENCES
// ----------------------------------------------------------------------

/**
 * Get user's preferences for a list.
 */
export async function getListPreferences(listId: string): Promise<UserListPreferencesDTO> {
  const headers = await getAuthHeaders();
  return apiClient.get<UserListPreferencesDTO>(`/api/lists/${listId}/preferences`, { headers });
}

/**
 * Upsert user's preferences for a list.
 */
export async function upsertListPreferences(
  listId: string,
  input: UserListPreferencesInput
): Promise<UserListPreferencesDTO> {
  const headers = await getAuthHeaders();
  return apiClient.put<UserListPreferencesDTO>(`/api/lists/${listId}/preferences`, input, { headers });
}

// ----------------------------------------------------------------------
// GENERATE SHOPPING LIST
// ----------------------------------------------------------------------

export interface GenerateShoppingInput {
  weekStart: string; // YYYY-MM-DD
  targetListId: string;
}

export interface GenerateShoppingResult {
  itemsCreated: number;
  message: string;
}

/**
 * Generate shopping list items from meal plan.
 */
export async function generateShopping(
  mealPlanListId: string,
  input: GenerateShoppingInput
): Promise<GenerateShoppingResult> {
  const headers = await getAuthHeaders();
  return apiClient.post<GenerateShoppingResult>(
    `/api/lists/${mealPlanListId}/generate-shopping`,
    input,
    { headers }
  );
}

// ----------------------------------------------------------------------
// CONVENIENCE EXPORTS
// ----------------------------------------------------------------------

export const listApi = {
  // Lists
  getLists,
  getList,
  createList,
  updateList,
  deleteList,
  // Items
  getItems: getListItems,
  createItem: createListItem,
  updateItem: updateListItem,
  deleteItem: deleteListItem,
  // Preferences
  getPreferences: getListPreferences,
  upsertPreferences: upsertListPreferences,
  // Generate
  generateShopping,
};
