export type RetryOptions = {
  retries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
};

export type GoogleApiError = {
  code?: number;
  response?: { status?: number; data?: unknown };
};

export const defaultRetryOptions: RetryOptions = {
  retries: 2,
  baseDelayMs: 300,
  maxDelayMs: 2_000,
};

export function isRetryableGoogleError(error: GoogleApiError): boolean {
  const status = error.code ?? error.response?.status;
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export async function withRetry<T>(
  action: () => Promise<T>,
  options: RetryOptions = defaultRetryOptions
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await action();
    } catch (err) {
      attempt += 1;
      if (attempt > options.retries || !isRetryableGoogleError(err as GoogleApiError)) {
        throw err;
      }

      const baseDelay = options.baseDelayMs ?? 300;
      const maxDelay = options.maxDelayMs ?? 2_000;
      const delay = Math.min(maxDelay, baseDelay * 2 ** (attempt - 1));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export type ParsedEventTimes = {
  startsAt: Date | null;
  endsAt: Date | null;
  allDay: boolean;
  timeZone?: string;
};

export function parseEventTimes(input: {
  start?: { dateTime?: string | null; date?: string | null; timeZone?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null; timeZone?: string | null } | null;
}): ParsedEventTimes {
  const startDateTime = input.start?.dateTime ?? null;
  const endDateTime = input.end?.dateTime ?? null;
  const startDate = input.start?.date ?? null;
  const endDate = input.end?.date ?? null;
  const timeZone = input.start?.timeZone ?? input.end?.timeZone ?? undefined;

  if (startDate && endDate) {
    // All-day events use date-only strings; Google end date is exclusive.
    const startsAt = new Date(`${startDate}T00:00:00Z`);
    const endsAt = new Date(`${endDate}T00:00:00Z`);
    return { startsAt, endsAt, allDay: true, timeZone };
  }

  if (startDateTime && endDateTime) {
    return {
      startsAt: new Date(startDateTime),
      endsAt: new Date(endDateTime),
      allDay: false,
      timeZone,
    };
  }

  return { startsAt: null, endsAt: null, allDay: false, timeZone };
}
