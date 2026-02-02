import { getSession } from './supabase';

// ----------------------------------------------------------------------

/**
 * Get authorization headers for authenticated API requests.
 * Throws if user is not authenticated.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

/**
 * Try to get auth headers, return empty object if not authenticated.
 * Useful for endpoints that work with or without authentication.
 */
export async function tryGetAuthHeaders(): Promise<Record<string, string>> {
  try {
    return await getAuthHeaders();
  } catch {
    return {};
  }
}
