import type { AgentRunContext, AgentAction, ToolResult, ToolCall, PendingActionInfo } from '../types.js';
import { extractDateTimeFromMessage, parseDateRange } from '../utils/date-parser.js';
import {
  pendingActionStore,
  isWriteTool,
  isDestructiveTool,
  CONFIDENCE_THRESHOLD,
} from '../confirmation.js';

// ----------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------

export type CalendarAgentResult = {
  text: string;
  actions: AgentAction[];
  payload?: Record<string, unknown>;
  /** If true, response requires user confirmation */
  requiresConfirmation?: boolean;
  /** Details about pending action */
  pendingAction?: PendingActionInfo;
};

/**
 * Parsed calendar intent from user message.
 */
type CalendarIntent =
  | {
      type: 'create';
      title: string;
      startAt: string | null;
      endAt: string | null;
      location: string | null;
      notes: string | null;
      allDay: boolean;
      attendees: string[];
      needsClarification: 'time' | 'date' | null;
      confidence: number;
    }
  | {
      type: 'search';
      query: string | null;
      from: string | null;
      to: string | null;
      attendee: string | null;
      confidence: number;
    }
  | {
      type: 'update';
      eventTitle: string | null;
      eventId: string | null;
      patch: {
        title?: string;
        startAt?: string;
        endAt?: string;
        location?: string;
        notes?: string;
      };
      confidence: number;
    }
  | { type: 'unclear'; confidence: number };

/**
 * Tool executor function injected by the API layer.
 */
export type ToolExecutor = (
  toolName: string,
  input: Record<string, unknown>
) => Promise<ToolResult>;

/**
 * Loaded preferences for the calendar agent.
 */
type CalendarPreferences = {
  defaultDuration?: number; // minutes
  preferredTimezone?: string; // IANA timezone
  namingConvention?: string; // template for event names
  defaultReminder?: number; // minutes before event
  workHoursStart?: string; // HH:mm format
  workHoursEnd?: string; // HH:mm format
};

// Preference keys for calendar domain
const CALENDAR_PREF_KEYS = {
  DEFAULT_DURATION: 'calendar.defaultDuration',
  PREFERRED_TIMEZONE: 'calendar.preferredTimezone',
  NAMING_CONVENTION: 'calendar.namingConvention',
  DEFAULT_REMINDER: 'calendar.defaultReminder',
  WORK_HOURS_START: 'calendar.workHoursStart',
  WORK_HOURS_END: 'calendar.workHoursEnd',
};

// Default values (used when preferences not set)
const DEFAULT_EVENT_DURATION_MINUTES = 60;

// ----------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------

/**
 * Load calendar-related preferences using the prefs.getBulk tool.
 */
async function loadCalendarPreferences(
  toolExecutor: ToolExecutor
): Promise<CalendarPreferences> {
  const prefs: CalendarPreferences = {};

  try {
    const result = await toolExecutor('prefs.getBulk', {
      requests: [
        { scope: 'family', key: CALENDAR_PREF_KEYS.DEFAULT_DURATION },
        { scope: 'family', key: CALENDAR_PREF_KEYS.PREFERRED_TIMEZONE },
        { scope: 'family', key: CALENDAR_PREF_KEYS.NAMING_CONVENTION },
        { scope: 'family', key: CALENDAR_PREF_KEYS.DEFAULT_REMINDER },
        { scope: 'family', key: CALENDAR_PREF_KEYS.WORK_HOURS_START },
        { scope: 'family', key: CALENDAR_PREF_KEYS.WORK_HOURS_END },
      ],
    });

    if (result.success && result.data) {
      const data = result.data as { results: Record<string, unknown> };
      const r = data.results;

      if (typeof r[CALENDAR_PREF_KEYS.DEFAULT_DURATION] === 'number') {
        prefs.defaultDuration = r[CALENDAR_PREF_KEYS.DEFAULT_DURATION] as number;
      }
      if (typeof r[CALENDAR_PREF_KEYS.PREFERRED_TIMEZONE] === 'string') {
        prefs.preferredTimezone = r[CALENDAR_PREF_KEYS.PREFERRED_TIMEZONE] as string;
      }
      if (typeof r[CALENDAR_PREF_KEYS.NAMING_CONVENTION] === 'string') {
        prefs.namingConvention = r[CALENDAR_PREF_KEYS.NAMING_CONVENTION] as string;
      }
      if (typeof r[CALENDAR_PREF_KEYS.DEFAULT_REMINDER] === 'number') {
        prefs.defaultReminder = r[CALENDAR_PREF_KEYS.DEFAULT_REMINDER] as number;
      }
      if (typeof r[CALENDAR_PREF_KEYS.WORK_HOURS_START] === 'string') {
        prefs.workHoursStart = r[CALENDAR_PREF_KEYS.WORK_HOURS_START] as string;
      }
      if (typeof r[CALENDAR_PREF_KEYS.WORK_HOURS_END] === 'string') {
        prefs.workHoursEnd = r[CALENDAR_PREF_KEYS.WORK_HOURS_END] as string;
      }
    }
  } catch (err) {
    // Preferences are optional, continue without them
  }

  return prefs;
}

/**
 * Parse user message into a structured calendar intent.
 * If there's pending context (previous message asked for clarification), merge it with the new message.
 */
function parseCalendarIntent(message: string, context: AgentRunContext): CalendarIntent {
  const lower = message.toLowerCase();
  const previousContext = context.previousContext;

  // Check if this is a follow-up to a previous clarification request
  if (previousContext?.awaitingInput && previousContext.pendingEvent) {
    context.logger.debug(
      { awaitingInput: previousContext.awaitingInput, pendingEvent: previousContext.pendingEvent },
      'CalendarAgent: processing follow-up message with pending context'
    );

    // User is providing the date/time we asked for
    if (previousContext.awaitingInput === 'dateTime') {
      // Try to parse just the date/time from the new message
      const dateResult = extractDateTimeFromMessage(message, new Date(), context.timezone);
      
      if (dateResult.datetime) {
        // Merge with pending event data
        const start = new Date(dateResult.datetime);
        const end = new Date(start.getTime() + 60 * 60 * 1000); // Default 1 hour

        return {
          type: 'create',
          title: previousContext.pendingEvent.title,
          startAt: dateResult.datetime,
          endAt: end.toISOString(),
          location: previousContext.pendingEvent.location ?? null,
          notes: previousContext.pendingEvent.notes ?? null,
          allDay: false,
          attendees: previousContext.pendingEvent.attendees ?? [],
          needsClarification: null,
          confidence: 0.90, // High confidence since user explicitly provided the date
        };
      }
    }

    // User is providing the time we asked for (date already known)
    if (previousContext.awaitingInput === 'time' && previousContext.pendingEvent.startAt) {
      const timeMatch = message.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      const allDayMatch = /all\s*day/i.test(message);

      if (timeMatch || allDayMatch) {
        const existingDate = new Date(previousContext.pendingEvent.startAt);

        if (allDayMatch) {
          const start = new Date(existingDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(start);
          end.setHours(23, 59, 59, 999);

          return {
            type: 'create',
            title: previousContext.pendingEvent.title,
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            location: previousContext.pendingEvent.location ?? null,
            notes: null,
            allDay: true,
            attendees: previousContext.pendingEvent.attendees ?? [],
            needsClarification: null,
            confidence: 0.90,
          };
        }

        if (timeMatch) {
          let hours = parseInt(timeMatch[1], 10);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
          const ampm = timeMatch[3]?.toLowerCase();
          if (ampm === 'pm' && hours < 12) hours += 12;
          if (ampm === 'am' && hours === 12) hours = 0;
          if (!ampm && hours >= 1 && hours <= 7) hours += 12; // Assume PM for 1-7

          existingDate.setHours(hours, minutes, 0, 0);
          const end = new Date(existingDate.getTime() + 60 * 60 * 1000);

          return {
            type: 'create',
            title: previousContext.pendingEvent.title,
            startAt: existingDate.toISOString(),
            endAt: end.toISOString(),
            location: previousContext.pendingEvent.location ?? null,
            notes: null,
            allDay: false,
            attendees: previousContext.pendingEvent.attendees ?? [],
            needsClarification: null,
            confidence: 0.90,
          };
        }
      }
    }
  }

  // SEARCH patterns
  if (/(?:show|list|what['']?s|get|find|see|check)\s+(?:my\s+)?(?:calendar|events?|schedule)/i.test(lower)) {
    return parseSearchIntent(message, context);
  }

  if (/when\s+(?:is|am)\s+/i.test(lower) || /(?:what|any)\s+events?\s+/i.test(lower)) {
    return parseSearchIntent(message, context);
  }

  // UPDATE/MOVE patterns - check before CREATE
  const movePatterns: Array<{ pattern: RegExp; confidence: number }> = [
    { pattern: /^(?:move|reschedule|change|shift)\s+(?:the\s+)?["']?(.+?)["']?\s+(?:to|for)\s+(.+)$/i, confidence: 0.90 },
    { pattern: /^(?:update|modify|edit)\s+(?:the\s+)?["']?(.+?)["']?\s+(?:event)?/i, confidence: 0.85 },
    { pattern: /^(?:change|move)\s+(.+?)\s+(?:from\s+.+?\s+)?to\s+(.+)$/i, confidence: 0.85 },
  ];

  for (const { pattern, confidence } of movePatterns) {
    const match = message.match(pattern);
    if (match) {
      return parseUpdateIntent(match[1].trim(), match[2]?.trim() || null, context, confidence);
    }
  }

  // CREATE patterns - improved to handle "create event for saturday 10am kids basketball"
  const createPatterns: Array<{ pattern: RegExp; confidence: number }> = [
    // "create event for saturday 10am kids basketball" - time before title
    { pattern: /^(?:schedule|book|add|create|new)\s+(?:a\s+)?(?:event|meeting|appointment)\s+(?:for|on)\s+((?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+(.+)$/i, confidence: 0.95 },
    // Standard patterns
    { pattern: /^(?:schedule|book|add|create|new)\s+(?:a\s+)?(?:event|meeting|appointment)[:\s]+(.+)$/i, confidence: 0.95 },
    { pattern: /^(?:schedule|book|add|create)\s+["']?(.+?)["']?\s+(?:on|at|for)\s+(.+)$/i, confidence: 0.90 },
    { pattern: /^(?:event|meeting|appointment)[:\s]+(.+)$/i, confidence: 0.88 },
    { pattern: /^(?:put|add)\s+(.+?)\s+(?:on|in)\s+(?:the\s+)?calendar/i, confidence: 0.85 },
  ];

  for (let i = 0; i < createPatterns.length; i++) {
    const { pattern, confidence } = createPatterns[i];
    const match = message.match(pattern);
    if (match) {
      // Special handling for first pattern: "create event for saturday 10am kids basketball"
      if (i === 0 && match[1] && match[2] && match[5]) {
        const dayName = match[1]; // "saturday" or "next saturday"
        let hours = parseInt(match[2], 10);
        const minutes = match[3] ? parseInt(match[3], 10) : 0;
        const ampm = match[4]?.toLowerCase();
        const title = match[5].trim();

        // Parse the day
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayLower = dayName.toLowerCase().replace(/^next\s+/, '');
        const targetDay = dayNames.indexOf(dayLower);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currentDay = today.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7;
        const eventDate = new Date(today);
        eventDate.setDate(today.getDate() + daysToAdd);

        // Apply time
        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
        if (!ampm && hours >= 1 && hours <= 7) hours += 12;
        eventDate.setHours(hours, minutes, 0, 0);

        const endDate = new Date(eventDate.getTime() + 60 * 60 * 1000);

        return {
          type: 'create',
          title,
          startAt: eventDate.toISOString(),
          endAt: endDate.toISOString(),
          location: null,
          notes: null,
          allDay: false,
          attendees: [],
          needsClarification: null,
          confidence,
        };
      }

      const eventText = match[2] ? `${match[1]} ${match[2]}` : match[1];
      return parseCreateIntent(eventText.trim(), context, confidence);
    }
  }

  // Check for general event-related keywords with a time component
  if (/(?:training|practice|meeting|appointment|dinner|lunch|party|class|lesson|basketball|soccer|football|game)/i.test(lower) && 
      /(?:at|on|this|next|tomorrow|today|\d{1,2}(?::\d{2})?\s*(?:am|pm)?|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(lower)) {
    return parseCreateIntent(message, context, 0.75);
  }

  // If message mentions calendar-related terms but unclear intent
  if (/calendar|event|schedule|meeting/i.test(lower)) {
    // If it's a question, treat as search
    if (/\?$/.test(lower) || /^(?:when|what|do|does|is|are)/i.test(lower)) {
      return parseSearchIntent(message, context);
    }
  }

  return { type: 'unclear', confidence: 0.0 };
}

/**
 * Parse a search intent from the message.
 */
function parseSearchIntent(message: string, context: AgentRunContext): CalendarIntent {
  const lower = message.toLowerCase();

  // Extract date range
  const dateRange = parseDateRange(message, new Date());

  // Extract search query (event title or type)
  let query: string | null = null;
  const queryMatch = message.match(/(?:for|about|called|named|titled)\s+["']?([^"']+)["']?/i);
  if (queryMatch) {
    query = queryMatch[1].trim();
  }

  // Extract attendee
  let attendee: string | null = null;
  const attendeeMatch = lower.match(/(?:with|for)\s+([a-z]+)/i);
  if (attendeeMatch && !['me', 'us', 'the', 'a', 'an'].includes(attendeeMatch[1])) {
    attendee = attendeeMatch[1];
  }

  // Check for "my" indicating current user
  if (/\bmy\b/i.test(lower)) {
    attendee = 'me';
  }

  return {
    type: 'search',
    query,
    from: dateRange.from,
    to: dateRange.to,
    attendee,
    confidence: 0.90, // Search is low-risk, high confidence
  };
}

/**
 * Parse a create intent from the message.
 */
function parseCreateIntent(
  eventText: string,
  context: AgentRunContext,
  baseConfidence: number
): CalendarIntent {
  // Extract date/time from the text
  const dateResult = extractDateTimeFromMessage(eventText, new Date());

  // Extract time separately for events like "6pm", "at 3:30"
  const timeMatch = eventText.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);

  let startAt: string | null = null;
  let endAt: string | null = null;
  let allDay = false;

  if (dateResult.datetime) {
    startAt = dateResult.datetime;
    // Default to 1 hour event if time specified
    const start = new Date(dateResult.datetime);
    if (timeMatch || dateResult.extracted?.includes(':')) {
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      endAt = end.toISOString();
    } else {
      // All day event if no time specified
      allDay = true;
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      endAt = end.toISOString();
    }
  }

  // Extract title (remove date/time portions)
  let title = eventText;
  if (dateResult.extracted) {
    title = title.replace(new RegExp(`(?:on|at|for)?\\s*${escapeRegex(dateResult.extracted)}`, 'gi'), '').trim();
  }
  // Clean up remaining prepositions and whitespace
  title = title
    .replace(/\s+(?:on|at|for)\s*$/i, '')
    .replace(/^\s*(?:on|at|for)\s+/i, '')
    .trim();

  // Extract location
  let location: string | null = null;
  const locationMatch = title.match(/(?:at|@)\s+([^,]+?)(?:\s+(?:on|at)\s+|$)/i);
  if (locationMatch && !locationMatch[1].match(/^\d{1,2}(?::\d{2})?\s*(?:am|pm)?$/i)) {
    location = locationMatch[1].trim();
    // Don't remove location from title - it's often part of the event name
  }

  // Extract attendees (e.g., "with Mom and Dad", "for Hamish")
  const attendees: string[] = [];
  const withMatch = title.match(/(?:with|for)\s+([A-Z][a-z]+(?:\s+(?:and|,)\s+[A-Z][a-z]+)*)/i);
  if (withMatch) {
    const names = withMatch[1].split(/\s+(?:and|,)\s+/i);
    attendees.push(...names.map((n) => n.trim()));
  }

  // Calculate confidence
  let confidence = baseConfidence;

  if (!dateResult.confident && dateResult.extracted) {
    confidence *= 0.8;
  }

  if (!startAt) {
    confidence *= 0.7;
  }

  if (title.length < 3) {
    confidence *= 0.6;
  }

  const needsClarification = !startAt ? 'date' as const :
    (!dateResult.confident ? 'time' as const : null);

  return {
    type: 'create',
    title: title || eventText,
    startAt,
    endAt,
    location,
    notes: null,
    allDay,
    attendees,
    needsClarification,
    confidence,
  };
}

/**
 * Parse an update intent from the message.
 */
function parseUpdateIntent(
  eventTitle: string,
  newTimeText: string | null,
  context: AgentRunContext,
  baseConfidence: number
): CalendarIntent {
  const patch: {
    title?: string;
    startAt?: string;
    endAt?: string;
    location?: string;
    notes?: string;
  } = {};

  if (newTimeText) {
    const dateResult = extractDateTimeFromMessage(newTimeText, new Date());
    if (dateResult.datetime) {
      patch.startAt = dateResult.datetime;
      // Default 1 hour duration
      const start = new Date(dateResult.datetime);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      patch.endAt = end.toISOString();
    }
  }

  // Extract location change
  const locationMatch = eventTitle.match(/(?:location|venue|place)\s+(?:to|:)\s+(.+)/i);
  if (locationMatch) {
    patch.location = locationMatch[1].trim();
  }

  return {
    type: 'update',
    eventTitle: eventTitle.replace(/(?:location|venue|place)\s+(?:to|:)\s+.+/i, '').trim(),
    eventId: null,
    patch,
    confidence: baseConfidence * (patch.startAt ? 1 : 0.7),
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ----------------------------------------------------------------------
// CALENDAR AGENT EXECUTOR
// ----------------------------------------------------------------------

/**
 * Execute a confirmed pending action for calendar.
 */
export async function executeConfirmedAction(
  confirmationToken: string,
  context: AgentRunContext,
  toolExecutor: ToolExecutor
): Promise<CalendarAgentResult> {
  const result = pendingActionStore.consume(
    confirmationToken,
    context.userId,
    context.familyId
  );

  if (!result.found) {
    // Log the actual reason for debugging, but return generic message to client
    // to prevent token enumeration attacks
    context.logger.warn(
      { token: confirmationToken, reason: result.reason },
      'CalendarAgent: confirmation validation failed'
    );

    return {
      text: '❌ This confirmation is invalid or has expired. Please try your request again.',
      actions: [],
      payload: { error: 'invalid_confirmation' },
    };
  }

  const { action: pendingAction } = result;

  context.logger.info(
    {
      token: confirmationToken,
      toolName: pendingAction.toolCall.toolName,
      originalRequestId: pendingAction.requestId,
    },
    'CalendarAgent: executing confirmed action'
  );

  const toolResult = await toolExecutor(
    pendingAction.toolCall.toolName,
    pendingAction.toolCall.input
  );

  const agentAction: AgentAction = {
    tool: pendingAction.toolCall.toolName,
    input: pendingAction.toolCall.input,
    result: toolResult,
  };

  if (toolResult.success) {
    const toolName = pendingAction.toolCall.toolName;

    if (toolName === 'calendar.create' && toolResult.data) {
      const event = (toolResult.data as { event: { title: string; startAt: string } }).event;
      const startStr = formatEventDate(event.startAt);
      return {
        text: `✅ Scheduled "${event.title}" for ${startStr}`,
        actions: [agentAction],
        payload: { event },
      };
    }

    if (toolName === 'calendar.update' && toolResult.data) {
      const event = (toolResult.data as { event: { title: string; startAt: string } }).event;
      return {
        text: `✅ Updated "${event.title}" – now scheduled for ${formatEventDate(event.startAt)}`,
        actions: [agentAction],
        payload: { event },
      };
    }

    return {
      text: `✅ Action completed successfully.`,
      actions: [agentAction],
      payload: toolResult.data as Record<string, unknown> | undefined,
    };
  } else {
    return {
      text: `❌ Sorry, the action failed. ${toolResult.error || 'Please try again.'}`,
      actions: [agentAction],
      payload: { error: toolResult.error },
    };
  }
}

/**
 * Main calendar agent executor.
 */
export async function executeCalendarAgent(
  message: string,
  context: AgentRunContext,
  toolExecutor: ToolExecutor
): Promise<CalendarAgentResult> {
  const intent = parseCalendarIntent(message, context);

  context.logger.debug({ intent, message }, 'CalendarAgent: parsed intent');

  switch (intent.type) {
    case 'create':
      return handleCreateIntent(intent, context, toolExecutor);
    case 'search':
      return handleSearchIntent(intent, context, toolExecutor);
    case 'update':
      return handleUpdateIntent(intent, context, toolExecutor);
    case 'unclear':
    default:
      return {
        text: "I'm not sure what you'd like me to do with the calendar. I can help you:\n" +
          '- Create an event: "Schedule team meeting tomorrow at 3pm"\n' +
          '- View events: "What\'s on my calendar this week?"\n' +
          '- Reschedule: "Move Hamish training to Thursday 6pm"\n\n' +
          'What would you like to do?',
        actions: [],
        payload: { needsInput: true },
      };
  }
}

// ----------------------------------------------------------------------
// INTENT HANDLERS
// ----------------------------------------------------------------------

function requiresConfirmation(
  toolName: string,
  confidence: number,
  isDestructive: boolean
): boolean {
  if (!isWriteTool(toolName)) {
    return false;
  }
  if (isDestructive) {
    return true;
  }
  if (confidence < CONFIDENCE_THRESHOLD) {
    return true;
  }
  return false;
}

function createPendingConfirmation(
  toolName: string,
  input: Record<string, unknown>,
  description: string,
  context: AgentRunContext,
  isDestructive: boolean
): CalendarAgentResult {
  const toolCall: ToolCall = { toolName, input };

  const pendingAction = pendingActionStore.create({
    userId: context.userId,
    familyId: context.familyId,
    requestId: context.requestId,
    conversationId: context.conversationId,
    toolCall,
    description,
    isDestructive,
    ttlMs: 5 * 60 * 1000,
  });

  const pendingActionInfo: PendingActionInfo = {
    token: pendingAction.token,
    description: pendingAction.description,
    toolName: pendingAction.toolCall.toolName,
    inputPreview: pendingAction.toolCall.input,
    expiresAt: new Date(pendingAction.createdAt.getTime() + pendingAction.ttlMs).toISOString(),
    isDestructive: pendingAction.isDestructive,
  };

  return {
    text: description + '\n\nPlease confirm to proceed, or say "cancel" to abort.',
    actions: [],
    payload: { confirmationRequired: true },
    requiresConfirmation: true,
    pendingAction: pendingActionInfo,
  };
}

async function handleCreateIntent(
  intent: Extract<CalendarIntent, { type: 'create' }>,
  context: AgentRunContext,
  toolExecutor: ToolExecutor
): Promise<CalendarAgentResult> {
  // If clarification needed
  if (intent.needsClarification === 'date') {
    return {
      text: `I'd like to add "${intent.title}" to the calendar, but I need to know when. ` +
        `Could you specify the date and time? For example:\n` +
        `- "tomorrow at 3pm"\n` +
        `- "next Monday at 10am"\n` +
        `- "June 15th"`,
      actions: [],
      payload: {
        pendingEvent: {
          title: intent.title,
          location: intent.location,
          attendees: intent.attendees,
        },
        awaitingInput: 'dateTime',
      },
    };
  }

  if (intent.needsClarification === 'time') {
    return {
      text: `I'll add "${intent.title}" on ${formatEventDate(intent.startAt!, true)}, but I'm not sure about the exact time. ` +
        `What time should it be? Or say "all day" for an all-day event.`,
      actions: [],
      payload: {
        pendingEvent: {
          title: intent.title,
          startAt: intent.startAt,
          location: intent.location,
        },
        awaitingInput: 'time',
      },
    };
  }

  // Load preferences for default duration
  const prefs = await loadCalendarPreferences(toolExecutor);
  const defaultDurationMinutes = prefs.defaultDuration ?? DEFAULT_EVENT_DURATION_MINUTES;

  context.logger.debug(
    { prefs, requestId: context.requestId },
    'CalendarAgent loaded preferences'
  );

  // Calculate end time using preference-based duration if not already set
  let endAt = intent.endAt;
  if (!endAt && intent.startAt && !intent.allDay) {
    const start = new Date(intent.startAt);
    const end = new Date(start.getTime() + defaultDurationMinutes * 60 * 1000);
    endAt = end.toISOString();
  }

  // Build tool input
  const input: Record<string, unknown> = {
    title: intent.title,
    startAt: intent.startAt,
    endAt: endAt,
    allDay: intent.allDay,
  };

  if (intent.location) {
    input.location = intent.location;
  }

  if (intent.notes) {
    input.notes = intent.notes;
  }

  if (intent.attendees.length > 0) {
    input.attendeeUserIds = intent.attendees;
  }

  const toolName = 'calendar.create';
  const needsConfirmation = requiresConfirmation(toolName, intent.confidence, false);

  if (needsConfirmation) {
    const dateStr = formatEventDate(intent.startAt!, intent.allDay);
    const locationStr = intent.location ? ` at ${intent.location}` : '';
    const durationStr = !intent.allDay ? ` (${defaultDurationMinutes} min)` : '';
    const description = `I'll schedule "${intent.title}" for ${dateStr}${durationStr}${locationStr}.`;

    context.logger.info(
      { toolName, confidence: intent.confidence, title: intent.title },
      'CalendarAgent: requesting confirmation for create'
    );

    return createPendingConfirmation(toolName, input, description, context, false);
  }

  // Execute directly
  const result = await toolExecutor(toolName, input);

  const action: AgentAction = {
    tool: toolName,
    input,
    result,
  };

  if (result.success && result.data) {
    const event = (result.data as { event: { id: string; title: string; startAt: string; location?: string | null } }).event;
    const dateStr = formatEventDate(event.startAt, intent.allDay);
    const locationStr = event.location ? ` at ${event.location}` : '';

    return {
      text: `✅ Scheduled "${event.title}" for ${dateStr}${locationStr}`,
      actions: [action],
      payload: { event },
    };
  } else {
    return {
      text: `❌ Sorry, I couldn't create that event. ${result.error || 'Please try again.'}`,
      actions: [action],
      payload: { error: result.error },
    };
  }
}

async function handleSearchIntent(
  intent: Extract<CalendarIntent, { type: 'search' }>,
  context: AgentRunContext,
  toolExecutor: ToolExecutor
): Promise<CalendarAgentResult> {
  const input: Record<string, unknown> = {};

  if (intent.query) {
    input.query = intent.query;
  }
  if (intent.from) {
    input.from = intent.from;
  }
  if (intent.to) {
    input.to = intent.to;
  }
  if (intent.attendee) {
    // Resolve 'me' to current user
    if (intent.attendee === 'me') {
      input.attendeeUserId = context.familyMemberId;
    } else {
      // Would need to resolve name to ID
      input.attendeeUserId = intent.attendee;
    }
  }

  const toolName = 'calendar.search';
  const result = await toolExecutor(toolName, input);

  const action: AgentAction = {
    tool: toolName,
    input,
    result,
  };

  if (result.success && result.data) {
    const data = result.data as { events: Array<{ title: string; startAt: string; location?: string | null }>; total: number };

    if (data.events.length === 0) {
      const rangeStr = intent.from && intent.to
        ? `between ${formatDateShort(intent.from)} and ${formatDateShort(intent.to)}`
        : 'in that time range';
      return {
        text: `📅 No events found ${rangeStr}.`,
        actions: [action],
        payload: { events: [], total: 0 },
      };
    }

    const eventList = data.events
      .slice(0, 5)
      .map((e) => {
        const dateStr = formatEventDate(e.startAt);
        const locationStr = e.location ? ` @ ${e.location}` : '';
        return `• **${e.title}** – ${dateStr}${locationStr}`;
      })
      .join('\n');

    const moreText = data.total > 5 ? `\n\n_(${data.total - 5} more events not shown)_` : '';

    return {
      text: `📅 **Your Events:**\n\n${eventList}${moreText}`,
      actions: [action],
      payload: { events: data.events, total: data.total },
    };
  } else {
    return {
      text: `❌ Sorry, I couldn't search the calendar. ${result.error || 'Please try again.'}`,
      actions: [action],
      payload: { error: result.error },
    };
  }
}

async function handleUpdateIntent(
  intent: Extract<CalendarIntent, { type: 'update' }>,
  context: AgentRunContext,
  toolExecutor: ToolExecutor
): Promise<CalendarAgentResult> {
  // First, search for the event if we don't have an ID
  if (!intent.eventId && intent.eventTitle) {
    const searchResult = await toolExecutor('calendar.search', {
      query: intent.eventTitle,
      limit: 5,
    });

    if (!searchResult.success) {
      return {
        text: `❌ Couldn't search for "${intent.eventTitle}". ${searchResult.error || ''}`,
        actions: [],
        payload: { error: searchResult.error },
      };
    }

    const searchData = searchResult.data as { events: Array<{ id: string; title: string; startAt: string }> };

    if (searchData.events.length === 0) {
      return {
        text: `I couldn't find an event called "${intent.eventTitle}". Would you like me to search differently or create a new event?`,
        actions: [],
        payload: { notFound: true },
      };
    }

    if (searchData.events.length > 1) {
      // Multiple matches - ask user to clarify
      const options = searchData.events
        .slice(0, 3)
        .map((e, i) => `${i + 1}. "${e.title}" on ${formatEventDate(e.startAt)}`)
        .join('\n');

      return {
        text: `I found multiple events matching "${intent.eventTitle}":\n\n${options}\n\nWhich one did you mean?`,
        actions: [],
        payload: {
          multipleMatches: true,
          candidates: searchData.events.slice(0, 3),
        },
      };
    }

    // Single match found
    intent.eventId = searchData.events[0].id;
  }

  if (!intent.eventId) {
    return {
      text: `I need to know which event to update. Could you tell me the event name?`,
      actions: [],
      payload: { needsEventId: true },
    };
  }

  // Check if we have changes to make
  if (Object.keys(intent.patch).length === 0) {
    return {
      text: `What would you like to change about this event? You can update:\n` +
        `- Time: "move to Friday 3pm"\n` +
        `- Location: "change location to the park"\n` +
        `- Title: "rename to Team Standup"`,
      actions: [],
      payload: { needsChanges: true },
    };
  }

  const input: Record<string, unknown> = {
    eventId: intent.eventId,
    patch: intent.patch,
  };

  const toolName = 'calendar.update';
  const needsConfirmation = requiresConfirmation(toolName, intent.confidence, false);

  if (needsConfirmation) {
    const changesList: string[] = [];
    if (intent.patch.startAt) {
      changesList.push(`new time: ${formatEventDate(intent.patch.startAt)}`);
    }
    if (intent.patch.location) {
      changesList.push(`location: ${intent.patch.location}`);
    }
    if (intent.patch.title) {
      changesList.push(`title: "${intent.patch.title}"`);
    }

    const description = `I'll update the event with: ${changesList.join(', ')}.`;

    context.logger.info(
      { toolName, confidence: intent.confidence, eventId: intent.eventId },
      'CalendarAgent: requesting confirmation for update'
    );

    return createPendingConfirmation(toolName, input, description, context, false);
  }

  // Execute directly
  const result = await toolExecutor(toolName, input);

  const action: AgentAction = {
    tool: toolName,
    input,
    result,
  };

  if (result.success && result.data) {
    const event = (result.data as { event: { title: string; startAt: string } }).event;
    return {
      text: `✅ Updated "${event.title}" – now scheduled for ${formatEventDate(event.startAt)}`,
      actions: [action],
      payload: { event },
    };
  } else {
    return {
      text: `❌ Sorry, I couldn't update that event. ${result.error || 'Please try again.'}`,
      actions: [action],
      payload: { error: result.error },
    };
  }
}

// ----------------------------------------------------------------------
// FORMATTING HELPERS
// ----------------------------------------------------------------------

function formatEventDate(isoString: string, allDayOnly = false): string {
  const date = new Date(isoString);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  };

  if (!allDayOnly) {
    options.hour = 'numeric';
    options.minute = '2-digit';
  }

  return date.toLocaleDateString('en-US', options);
}

function formatDateShort(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
