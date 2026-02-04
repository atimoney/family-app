// ----------------------------------------------------------------------

/**
 * API base URL from environment variable.
 *
 * IMPORTANT: This is baked at build time. A new deployment is required
 * when changing the API URL.
 *
 * - Production: Set VITE_API_BASE_URL in GitHub Actions environment variables
 * - Local dev: Set in .env.local (e.g., VITE_API_BASE_URL=http://localhost:3001)
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

/**
 * Validates that VITE_API_BASE_URL is configured.
 * Called once on module load.
 */
function validateApiConfig(): void {
  if (!API_BASE_URL) {
    const errorMessage =
      '[API Client] VITE_API_BASE_URL is not set!\n\n' +
      'For local development:\n' +
      '  Create apps/web/.env.local with:\n' +
      '  VITE_API_BASE_URL=http://localhost:3001\n\n' +
      'For production/staging:\n' +
      '  Set VITE_API_BASE_URL in GitHub Actions environment variables\n' +
      '  (e.g., https://your-api.azurecontainerapps.io)\n\n' +
      'Note: Vite env vars are baked at build time - requires redeploy after changes.';

    if (import.meta.env.DEV) {
      // In development, throw an error to fail fast
      throw new Error(errorMessage);
    } else {
      // In production, log an error but don't crash the app
      // This helps diagnose deployment issues
      console.error(errorMessage);
    }
  }
}

// Validate on module load
validateApiConfig();

/**
 * Log the resolved API base URL once on startup (for diagnostics).
 * Does not expose sensitive data - just the base URL.
 */
if (typeof window !== 'undefined') {
  console.info(`[API Client] Base URL: ${API_BASE_URL || '(not configured - using relative paths)'}`);
}

// ----------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ----------------------------------------------------------------------

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  // Build full URL using the API base URL
  // new URL() handles trailing slashes and leading slashes correctly
  const url = API_BASE_URL ? new URL(endpoint, API_BASE_URL).toString() : endpoint;

  const config: RequestInit = {
    ...rest,
    headers: {
      ...headers,
    },
  };

  if (body) {
    config.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
    config.body = JSON.stringify(body);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }

    throw new ApiError(
      (errorData as { message?: string })?.message || `HTTP ${response.status}`,
      response.status,
      errorData
    );
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

// ----------------------------------------------------------------------

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};

// ----------------------------------------------------------------------

/**
 * API endpoint definitions (Minimals pattern).
 * Centralizes endpoint paths for easier maintenance.
 */
export const endpoints = {
  // Profile
  profile: '/api/profile',
  // Family
  family: {
    root: '/api/family',
    members: '/api/family/members',
    invites: '/api/family/invites',
    categories: (familyId: string) => `/api/families/${familyId}/categories`,
  },
  // Calendar
  calendar: {
    events: '/events',
    calendars: '/v1/calendar/calendars',
    selection: '/v1/calendar/calendars/selection',
    sync: '/v1/calendar/sync',
    oauth: {
      status: '/v1/calendar/oauth/status',
      url: '/v1/calendar/oauth/url',
    },
  },
  // Tasks
  tasks: {
    root: '/v1/tasks',
    byId: (id: string) => `/v1/tasks/${id}`,
    bulkUpdate: '/v1/tasks/bulk-update',
    templates: '/v1/tasks/templates',
  },
  // Lists
  lists: {
    root: '/api/lists',
    byId: (id: string) => `/api/lists/${id}`,
    items: (listId: string) => `/api/lists/${listId}/items`,
    itemById: (listId: string, itemId: string) => `/api/lists/${listId}/items/${itemId}`,
    preferences: (listId: string) => `/api/lists/${listId}/preferences`,
    generate: (listId: string) => `/api/lists/${listId}/generate`,
  },
};
