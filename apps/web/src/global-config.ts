import { paths } from 'src/routes/paths';

import { env } from 'src/config/env';

import packageJson from '../package.json';

// ----------------------------------------------------------------------

export type ConfigValue = {
  appName: string;
  appVersion: string;
  appUrl: string;
  serverUrl: string;
  assetsDir: string;
  auth: {
    method: 'supabase';
    skip: boolean;
    redirectPath: string;
  };
  supabase: { url: string; key: string };
};

// ----------------------------------------------------------------------

export const CONFIG: ConfigValue = {
  appName: 'Family Hub',
  appVersion: packageJson.version,
  appUrl: env.app.url,
  serverUrl: import.meta.env.VITE_SERVER_URL ?? '',
  assetsDir: import.meta.env.VITE_ASSETS_DIR ?? '',
  auth: {
    method: 'supabase',
    skip: false,
    redirectPath: env.app.authRedirectPath || paths.family.root,
  },
  supabase: {
    url: env.supabase.url,
    key: env.supabase.anonKey,
  },
};
