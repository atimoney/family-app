import type {
  AuthError,
  AuthResponse,
  UserResponse,
  AuthTokenResponsePassword,
} from '@supabase/supabase-js';

import { paths } from 'src/routes/paths';

import { supabase } from 'src/lib/supabase';
import { buildRedirectUrl } from 'src/config/env';

// ----------------------------------------------------------------------

export type SignInParams = {
  email: string;
  password: string;
};

export type SignUpParams = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

export type ResetPasswordParams = {
  email: string;
};

export type UpdatePasswordParams = {
  password: string;
};

/** **************************************
 * Sign in with email/password
 *************************************** */
export const signInWithPassword = async ({
  email,
  password,
}: SignInParams): Promise<AuthTokenResponsePassword> => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error(error);
    throw error;
  }

  return { data, error };
};

/** **************************************
 * Sign in with Google OAuth
 *************************************** */
export const signInWithGoogle = async (returnTo?: string): Promise<void> => {
  // Build callback URL with returnTo parameter
  const callbackUrl = new URL(paths.auth.supabase.callback, window.location.origin);
  if (returnTo) {
    callbackUrl.searchParams.set('returnTo', returnTo);
  }

  console.log('[Auth] OAuth redirectTo:', callbackUrl.toString());

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error) {
    console.error(error);
    throw error;
  }
};

/** **************************************
 * Sign up
 *************************************** */
export const signUp = async ({
  email,
  password,
  firstName,
  lastName,
}: SignUpParams): Promise<AuthResponse> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: buildRedirectUrl(paths.family.root),
      data: { display_name: `${firstName} ${lastName}` },
    },
  });

  if (error) {
    console.error(error);
    throw error;
  }

  if (!data?.user?.identities?.length) {
    throw new Error('This user already exists');
  }

  return { data, error };
};

/** **************************************
 * Sign out
 *************************************** */
export const signOut = async (): Promise<{ error: AuthError | null }> => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error(error);
    throw error;
  }

  return { error };
};

/** **************************************
 * Reset password
 *************************************** */
export const resetPassword = async ({
  email,
}: ResetPasswordParams): Promise<{ data: {}; error: null } | { data: null; error: AuthError }> => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: buildRedirectUrl(paths.auth.supabase.updatePassword),
  });

  if (error) {
    console.error(error);
    throw error;
  }

  return { data, error };
};

/** **************************************
 * Update password
 *************************************** */
export const updatePassword = async ({
  password,
}: UpdatePasswordParams): Promise<UserResponse> => {
  const { data, error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error(error);
    throw error;
  }

  return { data, error };
};
