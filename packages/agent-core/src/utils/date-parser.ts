// ----------------------------------------------------------------------
// DATE/TIME PARSING UTILITIES
// ----------------------------------------------------------------------

/**
 * Attempt to parse natural language date/time expressions.
 * Returns ISO string if confident, null if ambiguous.
 */
export function parseDateTime(
  text: string,
  referenceDate: Date = new Date(),
  timezone?: string
): { datetime: string | null; confident: boolean; parsed: string | null } {
  const lower = text.toLowerCase().trim();

  // Get current date parts in user's timezone (simplified, assumes UTC offset)
  const now = referenceDate;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Patterns for relative dates
  const patterns: Array<{
    pattern: RegExp;
    handler: (match: RegExpMatchArray) => { date: Date; confident: boolean };
  }> = [
    // "today" with optional time
    {
      pattern: /^today(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/i,
      handler: (match) => {
        const date = new Date(today);
        if (match[1]) {
          let hours = parseInt(match[1], 10);
          const minutes = match[2] ? parseInt(match[2], 10) : 0;
          const ampm = match[3]?.toLowerCase();
          if (ampm === 'pm' && hours < 12) hours += 12;
          if (ampm === 'am' && hours === 12) hours = 0;
          date.setHours(hours, minutes, 0, 0);
        } else {
          date.setHours(23, 59, 0, 0); // End of day
        }
        return { date, confident: true };
      },
    },
    // "tomorrow" with optional time
    {
      pattern: /^tomorrow(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/i,
      handler: (match) => {
        const date = new Date(today);
        date.setDate(date.getDate() + 1);
        if (match[1]) {
          let hours = parseInt(match[1], 10);
          const minutes = match[2] ? parseInt(match[2], 10) : 0;
          const ampm = match[3]?.toLowerCase();
          if (ampm === 'pm' && hours < 12) hours += 12;
          if (ampm === 'am' && hours === 12) hours = 0;
          date.setHours(hours, minutes, 0, 0);
        } else {
          date.setHours(23, 59, 0, 0);
        }
        return { date, confident: true };
      },
    },
    // "in X days/hours/minutes"
    {
      pattern: /^in\s+(\d+)\s+(day|days|hour|hours|minute|minutes)$/i,
      handler: (match) => {
        const amount = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        const date = new Date(now);
        if (unit.startsWith('day')) {
          date.setDate(date.getDate() + amount);
          date.setHours(23, 59, 0, 0);
        } else if (unit.startsWith('hour')) {
          date.setTime(date.getTime() + amount * 60 * 60 * 1000);
        } else if (unit.startsWith('minute')) {
          date.setTime(date.getTime() + amount * 60 * 1000);
        }
        return { date, confident: true };
      },
    },
    // Day of week (next occurrence)
    {
      pattern: /^(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i,
      handler: (match) => {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDay = dayNames.indexOf(match[1].toLowerCase());
        const date = new Date(today);
        const currentDay = date.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7; // Next week if today or past
        date.setDate(date.getDate() + daysToAdd);
        date.setHours(23, 59, 0, 0);
        return { date, confident: true };
      },
    },
    // "next week" - ambiguous, could mean Monday or 7 days
    {
      pattern: /^next\s+week$/i,
      handler: () => {
        const date = new Date(today);
        date.setDate(date.getDate() + 7);
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
        };
      }
    }
  }

  return { datetime: null, confident: false, parsed: null };
}

/**
 * Extract potential date/time from a message.
 */
export function extractDateTimeFromMessage(
  message: string,
  referenceDate: Date = new Date()
): { datetime: string | null; confident: boolean; extracted: string | null } {
  // Common patterns to look for in the message
  const datePatterns = [
    /(?:due|by|on|at|for)\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i,
    /(?:due|by|on|at|for)\s+next\s+(week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    /(?:due|by|on|at|for)\s+in\s+(\d+)\s+(day|days|hour|hours)/i,
    /(tomorrow|today)(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i,
    /next\s+(week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  ];

  for (const pattern of datePatterns) {
    const match = message.match(pattern);
    if (match) {
      // Extract the date portion and parse it
      const extracted = match[0].replace(/^(?:due|by|on|at|for)\s+/i, '');
      const result = parseDateTime(extracted, referenceDate);
      if (result.datetime) {
        return { ...result, extracted };
      }
    }
  }

  return { datetime: null, confident: false, extracted: null };
}

/**
 * Parse a date range from a message (e.g., "this week", "next month", "between Mon and Fri").
 */
export function parseDateRange(
  message: string,
  referenceDate: Date = new Date()
): { from: string | null; to: string | null } {
  const lower = message.toLowerCase();
  const now = referenceDate;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // "today"
  if (/\btoday\b/.test(lower)) {
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    return {
      from: today.toISOString(),
      to: endOfDay.toISOString(),
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
    };
  }

  // "this month"
  if (/this\s+month/.test(lower)) {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    return {
      from: startOfMonth.toISOString(),
      to: endOfMonth.toISOString(),
    };
  }

  // Default: no range specified, return nulls
  return { from: null, to: null };
}
