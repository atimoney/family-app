/**
 * Environment configuration with runtime validation.
 *
 * Required env vars will throw helpful errors if missing when Supabase auth is enabled.
 * Optional env vars have sensible defaults.
 */

// ----------------------------------------------------------------------

type EnvConfig = {
  // Supabase (required when auth.method === 'supabase')
  supabase: {
    url: string;
    anonKey: string;
  };
  // App URLs
  app: {
    url: string;
    authRedirectPath: string;
  };
};

// ----------------------------------------------------------------------

/**
 * Get an environment variable with optional fallback.
 * Does NOT throw - use validateSupabaseEnv() for validation.
 */
function getEnv(key: string, fallback: string = ''): string {
  return import.meta.env[key] ?? fallback;
}

/**
 * Validate that required Supabase env vars are present.
 * Call this when initializing Supabase client.
 *
 * @throws Error with helpful message listing missing vars
 */
export function validateSupabaseEnv(): void {
  const missing: string[] = [];

  if (!getEnv('VITE_SUPABASE_URL')) {
    missing.push('VITE_SUPABASE_URL');
  }
  if (!getEnv('VITE_SUPABASE_ANON_KEY')) {
    missing.push('VITE_SUPABASE_ANON_KEY');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required Supabase environment variables:\n` +
        `  ${missing.join('\n  ')}\n\n` +
        `Create a .env.local file in apps/web with:\n` +
        `  VITE_SUPABASE_URL=https://your-project.supabase.co\n` +
        `  VITE_SUPABASE_ANON_KEY=your-anon-key\n\n` +
        `Get these values from: https://supabase.com/dashboard/project/_/settings/api`
    );
  }
}

/**
 * Check if Supabase env vars are configured (without throwing).
 * Useful for conditional initialization.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(getEnv('VITE_SUPABASE_URL') && getEnv('VITE_SUPABASE_ANON_KEY'));
}

// ----------------------------------------------------------------------

/**
 * Typed, validated environment configuration.
 *
 * Usage:
 *   import { env } from 'src/config/env';
 *   const client = createClient(env.supabase.url, env.supabase.anonKey);
 */
export const env: EnvConfig = {
  supabase: {
    url: getEnv('VITE_SUPABASE_URL'),
    anonKey: getEnv('VITE_SUPABASE_ANON_KEY'),
  },
  app: {
    url: getEnv('VITE_APP_URL', typeof window !== 'undefined' ? window.location.origin : ''),
    authRedirectPath: getEnv('VITE_AUTH_REDIRECT_PATH', '/family'),
  },
};

// ----------------------------------------------------------------------

/**
 * Build a full redirect URL for OAuth callbacks.
 *
 * @param path - The path to redirect to after auth (e.g., '/family')
 * @returns Full URL like 'https://app.example.com/family'
 */
export function buildRedirectUrl(path?: string): string {
  const base = env.app.url || (typeof window !== 'undefined' ? window.location.origin : '');
  const redirectPath = path ?? env.app.authRedirectPath;
  return `${base}${redirectPath}`;
}
