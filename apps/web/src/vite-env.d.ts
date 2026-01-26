/// <reference types="vite/client" />

// ----------------------------------------------------------------------

interface ImportMetaEnv {
  // Server
  readonly VITE_SERVER_URL?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ASSETS_DIR?: string;

  // Supabase (required for Supabase auth)
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;

  // App URLs (optional)
  readonly VITE_APP_URL?: string;
  readonly VITE_AUTH_REDIRECT_PATH?: string;

  // Firebase (optional)
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APPID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;

  // AWS Amplify (optional)
  readonly VITE_AWS_AMPLIFY_USER_POOL_ID?: string;
  readonly VITE_AWS_AMPLIFY_USER_POOL_WEB_CLIENT_ID?: string;
  readonly VITE_AWS_AMPLIFY_REGION?: string;

  // Auth0 (optional)
  readonly VITE_AUTH0_DOMAIN?: string;
  readonly VITE_AUTH0_CLIENT_ID?: string;
  readonly VITE_AUTH0_CALLBACK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
