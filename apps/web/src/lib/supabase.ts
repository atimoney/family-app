import type { Session, SupabaseClient, AuthChangeEvent } from '@supabase/supabase-js';

import { createClient } from '@supabase/supabase-js';

import { CONFIG } from 'src/global-config';
import { paths } from 'src/routes/paths';
import { env, validateSupabaseEnv } from 'src/config/env';

// ----------------------------------------------------------------------

const isSupabase = CONFIG.auth.method === 'supabase';

// Validate env vars when Supabase auth is enabled
if (isSupabase) {
  validateSupabaseEnv();
}

/**
 * Supabase client singleton.
 * Only initialized when CONFIG.auth.method === 'supabase'.
 */
export const supabase: SupabaseClient = isSupabase
  ? createClient(env.supabase.url, env.supabase.anonKey)
  : ({} as SupabaseClient);

// ----------------------------------------------------------------------
// Auth Helpers
// ----------------------------------------------------------------------

/**
 * Get the current session (if any).
 */
export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Error getting session:', error);
    return null;
  }

  return data.session;
}

/**
 * Subscribe to auth state changes.
 *
 * @param callback - Called with event type and session on auth state change
 * @returns Unsubscribe function
 *
 * @example
 * const unsubscribe = onAuthStateChange((event, session) => {
 *   if (event === 'SIGNED_IN') console.log('User signed in:', session?.user);
 *   if (event === 'SIGNED_OUT') console.log('User signed out');
 * });
 * // Later: unsubscribe();
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(callback);

  return () => subscription.unsubscribe();
}

/**
 * Sign in with Google OAuth.
 * Redirects the user to Google for authentication, then back to the callback page.
 *
 * @param returnTo - Optional path to redirect to after sign-in callback (defaults to /family)
 */
export async function signInWithGoogle(returnTo?: string): Promise<void> {
  // Build callback URL with returnTo parameter
  const callbackUrl = new URL(paths.auth.supabase.callback, window.location.origin);
  if (returnTo) {
    callbackUrl.searchParams.set('returnTo', returnTo);
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}
