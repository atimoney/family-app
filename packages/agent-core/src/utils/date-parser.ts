// ----------------------------------------------------------------------
// DATE/TIME PARSING UTILITIES
// ----------------------------------------------------------------------

/**
 * Result from parsing a date/time expression.
 */
export type DateTimeParseResult = {
  /** ISO datetime string (UTC) */
  datetime: string | null;
  /** Whether the parsing was confident/unambiguous */
  confident: boolean;
  /** Human-readable parsed representation */
  parsed: string | null;
  /** The timezone used for interpretation (IANA timezone or 'UTC') */
  timezone: string;
};

/**
 * Attempt to parse natural language date/time expressions.
 * Returns ISO string if confident, null if ambiguous.
 */
export function parseDateTime(
  text: string,
  referenceDate: Date = new Date(),
  timezone?: string
): DateTimeParseResult {
  const lower = text.toLowerCase().trim();
  const resolvedTimezone = timezone ?? 'UTC';

  // Always work in UTC to avoid server timezone issues
  // Get current UTC date parts
  const now = referenceDate;
  const nowUtcYear = now.getUTCFullYear();
  const nowUtcMonth = now.getUTCMonth();
  const nowUtcDay = now.getUTCDate();
  const nowUtcDayOfWeek = now.getUTCDay();

  // Create "today at midnight UTC"
  const todayUtc = new Date(Date.UTC(nowUtcYear, nowUtcMonth, nowUtcDay, 0, 0, 0, 0));

  // Helper to create a UTC date
  const createUtcDate = (year: number, month: number, day: number, hours = 0, minutes = 0): Date => {
    return new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));
  };

  // Patterns for relative dates
  const patterns: Array<{
    pattern: RegExp;
    handler: (match: RegExpMatchArray) => { date: Date; confident: boolean };
  }> = [
    // "today" with optional time
    {
      pattern: /^today(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/i,
      handler: (match) => {
        if (match[1]) {
          let hours = parseInt(match[1], 10);
          const minutes = match[2] ? parseInt(match[2], 10) : 0;
          const ampm = match[3]?.toLowerCase();
          if (ampm === 'pm' && hours < 12) hours += 12;
          if (ampm === 'am' && hours === 12) hours = 0;
          const date = createUtcDate(nowUtcYear, nowUtcMonth, nowUtcDay, hours, minutes);
          return { date, confident: true };
        } else {
          // End of day
          const date = createUtcDate(nowUtcYear, nowUtcMonth, nowUtcDay, 23, 59);
          return { date, confident: true };
        }
      },
    },
    // "tomorrow" with optional time
    {
      pattern: /^tomorrow(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/i,
      handler: (match) => {
        const tomorrowDate = new Date(todayUtc.getTime() + 24 * 60 * 60 * 1000);
        if (match[1]) {
          let hours = parseInt(match[1], 10);
          const minutes = match[2] ? parseInt(match[2], 10) : 0;
          const ampm = match[3]?.toLowerCase();
          if (ampm === 'pm' && hours < 12) hours += 12;
          if (ampm === 'am' && hours === 12) hours = 0;
          const date = createUtcDate(tomorrowDate.getUTCFullYear(), tomorrowDate.getUTCMonth(), tomorrowDate.getUTCDate(), hours, minutes);
          return { date, confident: true };
        } else {
          const date = createUtcDate(tomorrowDate.getUTCFullYear(), tomorrowDate.getUTCMonth(), tomorrowDate.getUTCDate(), 23, 59);
          return { date, confident: true };
        }
      },
    },
    // "in X days/hours/minutes"
    {
      pattern: /^in\s+(\d+)\s+(day|days|hour|hours|minute|minutes)$/i,
      handler: (match) => {
        const amount = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        let date: Date;
        if (unit.startsWith('day')) {
          const futureDate = new Date(todayUtc.getTime() + amount * 24 * 60 * 60 * 1000);
          date = createUtcDate(futureDate.getUTCFullYear(), futureDate.getUTCMonth(), futureDate.getUTCDate(), 23, 59);
        } else if (unit.startsWith('hour')) {
          date = new Date(now.getTime() + amount * 60 * 60 * 1000);
        } else {
          date = new Date(now.getTime() + amount * 60 * 1000);
        }
        return { date, confident: true };
      },
    },
    // Day of week with time (e.g., "saturday 10am", "next monday at 3pm")
    {
      pattern: /^(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/i,
      handler: (match) => {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDay = dayNames.indexOf(match[1].toLowerCase());
        let daysToAdd = targetDay - nowUtcDayOfWeek;
        if (daysToAdd <= 0) daysToAdd += 7; // Next week if today or past
        
        const targetDate = new Date(todayUtc.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        
        // Handle time if provided
        if (match[2]) {
          let hours = parseInt(match[2], 10);
          const minutes = match[3] ? parseInt(match[3], 10) : 0;
          const ampm = match[4]?.toLowerCase();
          if (ampm === 'pm' && hours < 12) hours += 12;
          if (ampm === 'am' && hours === 12) hours = 0;
          // If no am/pm specified and hour is 1-7, assume pm for reasonable defaults
          if (!ampm && hours >= 1 && hours <= 7) hours += 12;
          const date = createUtcDate(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), hours, minutes);
          return { date, confident: true };
        }
        
        const date = createUtcDate(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59);
        return { date, confident: true };
      },
    },
    // "next week" - ambiguous, could mean Monday or 7 days
    {
      pattern: /^next\s+week$/i,
      handler: () => {
        const date = new Date(todayUtc.getTime() + 7 * 24 * 60 * 60 * 1000);
        return { date, confident: false }; // Ambiguous - which day?
      },
    },
    // ISO datetime
    {
      pattern: /^(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?)$/,
      handler: (match) => {
        const date = new Date(match[1]);
        return { date, confident: !isNaN(date.getTime()) };
      },
    },
  ];

  for (const { pattern, handler } of patterns) {
    const match = lower.match(pattern);
    if (match) {
      const { date, confident } = handler(match);
      if (!isNaN(date.getTime())) {
        return {
          datetime: date.toISOString(),
          confident,
          parsed: date.toLocaleString(),
          timezone: resolvedTimezone,
        };
      }
    }
  }

  return { datetime: null, confident: false, parsed: null, timezone: resolvedTimezone };
}

/**
 * Result from extracting date/time from a message.
 */
export type DateTimeExtractResult = {
  /** ISO datetime string (UTC) */
  datetime: string | null;
  /** Whether the parsing was confident/unambiguous */
  confident: boolean;
  /** The extracted text that was parsed */
  extracted: string | null;
  /** The timezone used for interpretation (IANA timezone or 'UTC') */
  timezone: string;
};

/**
 * Extract potential date/time from a message.
 */
export function extractDateTimeFromMessage(
  message: string,
  referenceDate: Date = new Date(),
  timezone?: string
): DateTimeExtractResult {
  const resolvedTimezone = timezone ?? 'UTC';
  // Common patterns to look for in the message (ordered from most specific to least)
  const datePatterns = [
    // Day of week with time (e.g., "saturday 10am", "next saturday at 10am")
    /(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)/i,
    // Explicit preposition patterns
    /(?:due|by|on|at|for)\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i,
    /(?:due|by|on|at|for)\s+next\s+(week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i,
    /(?:due|by|on|at|for)\s+in\s+(\d+)\s+(day|days|hour|hours)/i,
    // Bare patterns (no preposition required)
    /(tomorrow|today)(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i,
    /next\s+(week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i,
    // Just day name without preposition
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  ];

  for (const pattern of datePatterns) {
    const match = message.match(pattern);
    if (match) {
      // Extract the date portion and parse it
      const extracted = match[0].replace(/^(?:due|by|on|at|for)\s+/i, '');
      const result = parseDateTime(extracted, referenceDate, timezone);
      if (result.datetime) {
        return { ...result, extracted };
      }
    }
  }

  return { datetime: null, confident: false, extracted: null, timezone: resolvedTimezone };
}

/**
 * Result from parsing a date range.
 */
export type DateRangeParseResult = {
  /** Start of range as ISO datetime (UTC) */
  from: string | null;
  /** End of range as ISO datetime (UTC) */
  to: string | null;
  /** The timezone used for interpretation (IANA timezone or 'UTC') */
  timezone: string;
};

/**
 * Parse a date range from a message (e.g., "this week", "next month", "between Mon and Fri").
 */
export function parseDateRange(
  message: string,
  referenceDate: Date = new Date(),
  timezone?: string
): DateRangeParseResult {
  const lower = message.toLowerCase();
  const now = referenceDate;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const resolvedTimezone = timezone ?? 'UTC';

  // "today"
  if (/\btoday\b/.test(lower)) {
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    return {
      from: today.toISOString(),
      to: endOfDay.toISOString(),
      timezone: resolvedTimezone,
    };
  }

  // "tomorrow"
  if (/\btomorrow\b/.test(lower)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfTomorrow = new Date(tomorrow);
    endOfTomorrow.setHours(23, 59, 59, 999);
    return {
      from: tomorrow.toISOString(),
      to: endOfTomorrow.toISOString(),
      timezone: resolvedTimezone,
    };
  }

  // "this week"
  if (/this\s+week/.test(lower)) {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return {
      from: startOfWeek.toISOString(),
      to: endOfWeek.toISOString(),
      timezone: resolvedTimezone,
    };
  }

  // "next week"
  if (/next\s+week/.test(lower)) {
    const startOfNextWeek = new Date(today);
    startOfNextWeek.setDate(today.getDate() + (7 - today.getDay()));
    const endOfNextWeek = new Date(startOfNextWeek);
    endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
    endOfNextWeek.setHours(23, 59, 59, 999);
    return {
      from: startOfNextWeek.toISOString(),
      to: endOfNextWeek.toISOString(),
      timezone: resolvedTimezone,
    };
  }

  // "this month"
  if (/this\s+month/.test(lower)) {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    return {
      from: startOfMonth.toISOString(),
      to: endOfMonth.toISOString(),
      timezone: resolvedTimezone,
    };
  }

  // Default: no range specified, return nulls
  return { from: null, to: null, timezone: resolvedTimezone };
}
