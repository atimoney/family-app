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
 * Get the timezone offset in minutes for a given timezone at a specific date.
 * Returns the offset to ADD to local time to get UTC (opposite of getTimezoneOffset).
 */
function getTimezoneOffsetMinutes(timezone: string, date: Date): number {
  if (timezone === 'UTC') return 0;
  
  try {
    // Get the time in the target timezone
    const localStr = date.toLocaleString('en-US', { timeZone: timezone });
    const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
    
    const localDate = new Date(localStr);
    const utcDate = new Date(utcStr);
    
    // Return offset in minutes (local - UTC)
    return Math.round((localDate.getTime() - utcDate.getTime()) / (60 * 1000));
  } catch {
    // If timezone is invalid, return 0 (UTC)
    return 0;
  }
}

/**
 * Convert a local time in a specific timezone to UTC.
 * @param localHours Hours in local timezone (0-23)
 * @param localMinutes Minutes in local timezone (0-59)
 * @param localDate The date in local timezone
 * @param timezone IANA timezone string
 * @returns Date object in UTC
 */
function localTimeToUtc(
  localYear: number,
  localMonth: number, 
  localDay: number,
  localHours: number,
  localMinutes: number,
  timezone: string
): Date {
  if (timezone === 'UTC') {
    return new Date(Date.UTC(localYear, localMonth, localDay, localHours, localMinutes, 0, 0));
  }
  
  // Create a date string in ISO format without timezone
  const isoString = `${localYear}-${String(localMonth + 1).padStart(2, '0')}-${String(localDay).padStart(2, '0')}T${String(localHours).padStart(2, '0')}:${String(localMinutes).padStart(2, '0')}:00`;
  
  // Use Intl.DateTimeFormat to get the UTC offset for this specific date/time in the timezone
  try {
    // Create a formatter that shows the offset
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'shortOffset',
    });
    
    // Parse the date as if it were UTC first
    const utcGuess = new Date(isoString + 'Z');
    
    // Get what that UTC time looks like in the target timezone
    const parts = formatter.formatToParts(utcGuess);
    const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || '';
    
    // Parse offset like "GMT+11" or "GMT-5" or "UTC"
    const offsetMatch = tzPart.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
    if (offsetMatch) {
      const sign = offsetMatch[1] === '+' ? 1 : -1;
      const hours = parseInt(offsetMatch[2], 10);
      const minutes = offsetMatch[3] ? parseInt(offsetMatch[3], 10) : 0;
      const offsetMinutes = sign * (hours * 60 + minutes);
      
      // Local time = UTC + offset, so UTC = Local - offset
      const utcMs = utcGuess.getTime() - offsetMinutes * 60 * 1000;
      return new Date(utcMs);
    }
    
    // Fallback: just return as UTC
    return utcGuess;
  } catch {
    // If anything fails, treat as UTC
    return new Date(Date.UTC(localYear, localMonth, localDay, localHours, localMinutes, 0, 0));
  }
}

/**
 * Get today's date in a specific timezone.
 */
function getTodayInTimezone(referenceDate: Date, timezone: string): { year: number; month: number; day: number; dayOfWeek: number } {
  if (timezone === 'UTC') {
    return {
      year: referenceDate.getUTCFullYear(),
      month: referenceDate.getUTCMonth(),
      day: referenceDate.getUTCDate(),
      dayOfWeek: referenceDate.getUTCDay(),
    };
  }
  
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    });
    
    const parts = formatter.formatToParts(referenceDate);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10) - 1;
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '1', 10);
    
    const weekdayStr = parts.find(p => p.type === 'weekday')?.value?.toLowerCase() || '';
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayOfWeek = dayNames.findIndex(d => weekdayStr.startsWith(d));
    
    return { year, month, day, dayOfWeek: dayOfWeek >= 0 ? dayOfWeek : 0 };
  } catch {
    // Fallback to UTC
    return {
      year: referenceDate.getUTCFullYear(),
      month: referenceDate.getUTCMonth(),
      day: referenceDate.getUTCDate(),
      dayOfWeek: referenceDate.getUTCDay(),
    };
  }
}

/**
 * Attempt to parse natural language date/time expressions.
 * Returns ISO string if confident, null if ambiguous.
 * Times are interpreted in the user's timezone and converted to UTC for storage.
 */
export function parseDateTime(
  text: string,
  referenceDate: Date = new Date(),
  timezone?: string
): DateTimeParseResult {
  const lower = text.toLowerCase().trim();
  const resolvedTimezone = timezone ?? 'UTC';

  // DEBUG: Log the timezone being used
  console.log('[DATE PARSER DEBUG] parseDateTime called:', { text, timezone, resolvedTimezone });

  // Get today's date in the user's timezone
  const today = getTodayInTimezone(referenceDate, resolvedTimezone);
  const { year: todayYear, month: todayMonth, day: todayDay, dayOfWeek: todayDayOfWeek } = today;

  console.log('[DATE PARSER DEBUG] today in timezone:', today);

  // Helper to add days to a date in the user's timezone
  const addDays = (baseYear: number, baseMonth: number, baseDay: number, daysToAdd: number): { year: number; month: number; day: number } => {
    const tempDate = new Date(Date.UTC(baseYear, baseMonth, baseDay + daysToAdd));
    return {
      year: tempDate.getUTCFullYear(),
      month: tempDate.getUTCMonth(),
      day: tempDate.getUTCDate(),
    };
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
          const date = localTimeToUtc(todayYear, todayMonth, todayDay, hours, minutes, resolvedTimezone);
          return { date, confident: true };
        } else {
          // End of day in user's timezone
          const date = localTimeToUtc(todayYear, todayMonth, todayDay, 23, 59, resolvedTimezone);
          return { date, confident: true };
        }
      },
    },
    // "tomorrow" with optional time
    {
      pattern: /^tomorrow(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/i,
      handler: (match) => {
        const tomorrow = addDays(todayYear, todayMonth, todayDay, 1);
        if (match[1]) {
          let hours = parseInt(match[1], 10);
          const minutes = match[2] ? parseInt(match[2], 10) : 0;
          const ampm = match[3]?.toLowerCase();
          if (ampm === 'pm' && hours < 12) hours += 12;
          if (ampm === 'am' && hours === 12) hours = 0;
          const date = localTimeToUtc(tomorrow.year, tomorrow.month, tomorrow.day, hours, minutes, resolvedTimezone);
          return { date, confident: true };
        } else {
          const date = localTimeToUtc(tomorrow.year, tomorrow.month, tomorrow.day, 23, 59, resolvedTimezone);
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
          const futureDay = addDays(todayYear, todayMonth, todayDay, amount);
          date = localTimeToUtc(futureDay.year, futureDay.month, futureDay.day, 23, 59, resolvedTimezone);
        } else if (unit.startsWith('hour')) {
          date = new Date(referenceDate.getTime() + amount * 60 * 60 * 1000);
        } else {
          date = new Date(referenceDate.getTime() + amount * 60 * 1000);
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
        let daysToAdd = targetDay - todayDayOfWeek;
        if (daysToAdd <= 0) daysToAdd += 7; // Next week if today or past
        
        const targetDate = addDays(todayYear, todayMonth, todayDay, daysToAdd);
        
        // Handle time if provided
        if (match[2]) {
          let hours = parseInt(match[2], 10);
          const minutes = match[3] ? parseInt(match[3], 10) : 0;
          const ampm = match[4]?.toLowerCase();
          if (ampm === 'pm' && hours < 12) hours += 12;
          if (ampm === 'am' && hours === 12) hours = 0;
          // If no am/pm specified and hour is 1-7, assume pm for reasonable defaults
          if (!ampm && hours >= 1 && hours <= 7) hours += 12;
          console.log('[DATE PARSER DEBUG] calling localTimeToUtc with:', { year: targetDate.year, month: targetDate.month, day: targetDate.day, hours, minutes, resolvedTimezone });
          const date = localTimeToUtc(targetDate.year, targetDate.month, targetDate.day, hours, minutes, resolvedTimezone);
          console.log('[DATE PARSER DEBUG] localTimeToUtc returned:', date.toISOString());
          return { date, confident: true };
        }
        
        const date = localTimeToUtc(targetDate.year, targetDate.month, targetDate.day, 23, 59, resolvedTimezone);
        return { date, confident: true };
      },
    },
    // "next week" - ambiguous, could mean Monday or 7 days
    {
      pattern: /^next\s+week$/i,
      handler: () => {
        const nextWeek = addDays(todayYear, todayMonth, todayDay, 7);
        const date = localTimeToUtc(nextWeek.year, nextWeek.month, nextWeek.day, 23, 59, resolvedTimezone);
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
