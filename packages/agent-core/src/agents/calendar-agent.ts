import { z } from 'zod';
import type { AgentRunContext, AgentAction, ToolResult, ToolCall, PendingActionInfo } from '../types.js';
import { extractDateTimeFromMessage, parseDateRange } from '../utils/date-parser.js';
import {
  pendingActionStore,
  isWriteTool,
  isDestructiveTool,
  CONFIDENCE_THRESHOLD,
} from '../confirmation.js';
import { getRouterConfig } from '../router.js';

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
        allDay?: boolean;
      };
      confidence: number;
    }
  | {
      type: 'analyze';
      question: string;
      from: string | null;
      to: string | null;
      keywords: string[];
      pattern: string | null;
      confidence: number;
    }
  | {
      type: 'analyzeFromContext';
      question: string;
      /** Event data from previous context - populated when executing */
      events?: Array<{ id: string; title: string; startAt: string; allDay: boolean; recurrenceRule?: string | null }>;
      confidence: number;
    }
  | {
      type: 'analyzeAndUpdate';
      question: string;
      action: {
        type: 'setAllDay' | 'reschedule' | 'delete' | 'updateTitle' | 'updateLocation';
        value: boolean | string | null;
        newDate: string | null;
        newTime: string | null;
      };
      from: string | null;
      to: string | null;
      keywords: string[];
      pattern: string | null;
      confidence: number;
    }
  | {
      type: 'updateFromContext';
      action: {
        type: 'setAllDay' | 'reschedule' | 'delete' | 'updateTitle' | 'updateLocation';
        value: boolean | string | null;
        newDate: string | null;
        newTime: string | null;
      };
      /** Event IDs from previous context - populated when executing */
      eventIds?: string[];
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
// LLM INTENT PARSING
// ----------------------------------------------------------------------

/**
 * Schema for LLM-parsed calendar intent.
 */
const llmCalendarIntentSchema = z.object({
  type: z.enum(['create', 'search', 'update', 'delete', 'analyze', 'analyzeFromContext', 'analyzeAndUpdate', 'updateFromContext', 'unclear']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),

  // For CREATE intent
  create: z.object({
    title: z.string(),
    startDate: z.string().nullable().describe('Relative date like "tomorrow", "next Saturday", or ISO date'),
    startTime: z.string().nullable().describe('Time like "10am", "14:00", or null for all-day'),
    endTime: z.string().nullable(),
    durationMinutes: z.number().nullable().describe('Duration in minutes if no end time specified'),
    location: z.string().nullable(),
    attendees: z.array(z.string()),
    allDay: z.boolean(),
    needsClarification: z.enum(['date', 'time', 'title']).nullable(),
  }).optional(),

  // For SEARCH intent
  search: z.object({
    query: z.string().nullable().describe('Search term for event title, or null for all events'),
    dateRange: z.object({
      from: z.string().describe('Relative date like "today", "this weekend", "next week", or ISO date'),
      to: z.string().nullable().describe('End of range, or null if same as from'),
    }).nullable().describe('Date range to search, or null to search all upcoming events'),
    attendee: z.string().nullable(),
  }).optional(),

  // For UPDATE intent
  update: z.object({
    targetEvent: z.string().describe('Title or description of event to update'),
    changes: z.object({
      newDate: z.string().nullable(),
      newTime: z.string().nullable(),
      newTitle: z.string().nullable(),
      newLocation: z.string().nullable(),
      allDay: z.boolean().nullable().describe('Convert to all-day event'),
    }),
  }).optional(),

  // For DELETE intent
  delete: z.object({
    targetEvent: z.string().describe('Title or description of event to delete'),
    date: z.string().nullable().describe('Specific date if mentioned'),
  }).optional(),

  // For ANALYZE intent - complex questions requiring reasoning over events
  analyze: z.object({
    question: z.string().describe('The analytical question to answer about calendar events'),
    dateRange: z.object({
      from: z.string().describe('Start of date range to analyze'),
      to: z.string().nullable().describe('End of date range'),
    }).nullable().describe('Date range to analyze, or null for all upcoming events'),
    filters: z.object({
      keywords: z.array(z.string()).optional().describe('Keywords to filter events by'),
      pattern: z.string().nullable().optional().describe('Pattern to look for in event titles'),
    }).passthrough().optional(),
  }).optional(),

  // For ANALYZE_AND_UPDATE intent - find events then modify them in batch
  analyzeAndUpdate: z.object({
    question: z.string().describe('What events to find'),
    action: z.object({
      type: z.enum(['setAllDay', 'reschedule', 'delete', 'updateTitle', 'updateLocation']),
      value: z.union([z.boolean(), z.string()]).nullable().describe('New value for the change'),
      newDate: z.string().nullable().describe('New date if rescheduling'),
      newTime: z.string().nullable().describe('New time if rescheduling'),
    }),
    dateRange: z.object({
      from: z.string().describe('Start of date range'),
      to: z.string().nullable().describe('End of date range'),
    }).nullable().describe('Date range to search, or null for all upcoming events'),
    filters: z.object({
      keywords: z.array(z.string()).optional().describe('Keywords to filter events by'),
      pattern: z.string().nullable().optional().describe('Pattern to look for'),
    }).passthrough().optional(),
  }).optional(),

  // For ANALYZE_FROM_CONTEXT intent - analyze events from previous search/analyze results (read-only)
  analyzeFromContext: z.object({
    question: z.string().describe('The question to answer about the previously retrieved events'),
  }).optional(),

  // For UPDATE_FROM_CONTEXT intent - modify events from previous search/analyze results
  updateFromContext: z.object({
    action: z.object({
      type: z.enum(['setAllDay', 'reschedule', 'delete', 'updateTitle', 'updateLocation']),
      value: z.union([z.boolean(), z.string()]).nullable().describe('New value for the change'),
      newDate: z.string().nullable().describe('New date if rescheduling'),
      newTime: z.string().nullable().describe('New time if rescheduling'),
    }),
  }).optional(),
});

type LLMCalendarIntent = z.infer<typeof llmCalendarIntentSchema>;

/**
 * Summary of previous results for context-aware intent parsing.
 */
type PreviousResultsContext = {
  eventCount: number;
  eventTitles: string[];
  description: string;
};

/**
 * Build the system prompt for calendar intent parsing.
 * @param timezone - User's timezone
 * @param currentDate - Current date/time ISO string  
 * @param previousResults - Optional context from previous search/analyze results
 */
function getCalendarIntentSystemPrompt(
  timezone: string, 
  currentDate: string,
  previousResults?: PreviousResultsContext
): string {
  const contextSection = previousResults ? `
PREVIOUS CONVERSATION CONTEXT:
The user previously searched/analyzed and found ${previousResults.eventCount} events:
${previousResults.eventTitles.slice(0, 10).map(t => `- ${t}`).join('\n')}${previousResults.eventCount > 10 ? `\n- ... and ${previousResults.eventCount - 10} more` : ''}

IMPORTANT: 
- If the user asks a QUESTION about "these events", "those", "them" (e.g., "which of these are recurring?"), use "analyzeFromContext" intent type.
- If the user wants to MODIFY "these events", "those", "them" (e.g., "change these to all-day"), use "updateFromContext" intent type.
` : '';

  return `You are an intent parser for a family calendar assistant.
Your job is to analyze user messages and extract structured calendar intents.

Current date/time: ${currentDate}
User timezone: ${timezone}
${contextSection}
INTENT TYPES:
- search: User wants to VIEW or QUERY events (e.g., "what's on this weekend?", "am I free tomorrow?", "what do we have on Saturday?")
- create: User wants to ADD a new event (e.g., "schedule dinner Friday 7pm", "add kids basketball Saturday 10am")
- update: User wants to CHANGE an existing event (e.g., "move meeting to 3pm", "reschedule dentist to Thursday")
- delete: User wants to REMOVE an event (e.g., "cancel tomorrow's appointment")
- analyze: User asks a COMPLEX QUESTION requiring reasoning about events WITHOUT wanting to change them AND there are NO previous results to reference (e.g., "which events look like meal placeholders?", "are there any conflicts?")
- analyzeFromContext: User asks a QUESTION about events from a PREVIOUS search/analyze result. Use this when user references "these events", "those", "them", etc. AND wants to ANALYZE (not modify) them (e.g., "which of these are recurring?", "how many of those are all-day?")
- analyzeAndUpdate: User wants to FIND events matching criteria AND then MODIFY them (e.g., "find meal placeholders and make them all-day", "change all morning events to afternoon")
- updateFromContext: User wants to MODIFY events from a PREVIOUS search/analyze result. Use this when user references "these events", "those", "them", etc. AND wants to CHANGE them (e.g., "change these to all-day", "delete them", "make those all-day")
- unclear: Cannot determine intent or missing critical information

DATE INTERPRETATION RULES:
- "this weekend" = the upcoming Saturday and Sunday (or current if today is weekend)
- "next weekend" = Saturday and Sunday of next week
- "tomorrow" = the day after current date
- "next Monday" = the upcoming Monday
- "this week" = from today until end of this week (Sunday)
- "next week" = Monday through Sunday of next week
- Always interpret relative to ${currentDate}

CONFIDENCE SCORING:
- 0.9-1.0: Clear intent with all required information
- 0.7-0.89: Clear intent but some details assumed or inferred
- 0.5-0.69: Ambiguous, may need clarification
- Below 0.5: Unclear intent

RESPONSE FORMAT - You MUST use this EXACT JSON structure:

For SEARCH intent (simple queries):
{"type":"search","confidence":0.9,"reasoning":"User wants to see weekend events","search":{"query":null,"dateRange":{"from":"this weekend","to":null},"attendee":null}}

For ANALYZE intent (complex reasoning questions, NO previous context):
{"type":"analyze","confidence":0.85,"reasoning":"User wants to find events that look like meal placeholders","analyze":{"question":"Find events that look like meal plan placeholders","dateRange":null,"filters":{"keywords":["dinner","lunch","pizza","meal"],"pattern":"meal-like names"}}}

For ANALYZE_FROM_CONTEXT intent (questions about PREVIOUS results):
{"type":"analyzeFromContext","confidence":0.95,"reasoning":"User wants to analyze the events from the previous search","analyzeFromContext":{"question":"Identify which events are recurring"}}

For ANALYZE_AND_UPDATE intent (find events then modify them):
{"type":"analyzeAndUpdate","confidence":0.9,"reasoning":"User wants to find meal placeholders and convert to all-day events","analyzeAndUpdate":{"question":"Find events that look like meal plan placeholders","action":{"type":"setAllDay","value":true,"newDate":null,"newTime":null},"dateRange":null,"filters":{"keywords":["pizza","dinner","lunch","meal","breakfast"],"pattern":"meal-like names"}}}

For UPDATE_FROM_CONTEXT intent (MODIFY events from previous results):
{"type":"updateFromContext","confidence":0.95,"reasoning":"User wants to modify the events from the previous search/analyze","updateFromContext":{"action":{"type":"setAllDay","value":true,"newDate":null,"newTime":null}}}

For CREATE intent:
{"type":"create","confidence":0.9,"reasoning":"User wants to add an event","create":{"title":"Team meeting","startDate":"tomorrow","startTime":"3pm","endTime":null,"durationMinutes":60,"location":null,"attendees":[],"allDay":false,"needsClarification":null}}

For UPDATE intent (single event):
{"type":"update","confidence":0.85,"reasoning":"User wants to reschedule","update":{"targetEvent":"dentist appointment","changes":{"newDate":"Thursday","newTime":"2pm","newTitle":null,"newLocation":null,"allDay":null}}}

For UNCLEAR intent:
{"type":"unclear","confidence":0.3,"reasoning":"Cannot determine what the user wants"}

IMPORTANT RULES:
1. The "type" field MUST be one of: "search", "create", "update", "delete", "analyze", "analyzeFromContext", "analyzeAndUpdate", "updateFromContext", "unclear"
2. Always include "reasoning" explaining your interpretation
3. Include the appropriate nested object based on type
4. For dates, use relative terms like "tomorrow", "this weekend", "next Monday" - I will parse them
5. Use "analyze" for questions that ONLY need to identify/report on events (no changes) AND there is NO previous context
6. Use "analyzeFromContext" when user wants to ASK A QUESTION about events from a previous result (e.g., "which of these are recurring?")
7. Use "analyzeAndUpdate" when user wants to FIND events AND MODIFY them (e.g., "find X and change them to Y")
8. Use "updateFromContext" when user wants to MODIFY events from a previous result (e.g., "change these to all-day", "delete them")
9. Use "search" for simple queries that just need to fetch and display events
10. action.type can be: "setAllDay", "reschedule", "delete", "updateTitle", "updateLocation"

Respond ONLY with valid JSON. No markdown, no explanations.`;
}

/**
 * Parse relative date string to ISO date range.
 * Returns start and end of the date range.
 */
function parseRelativeDateRange(
  fromStr: string,
  toStr: string | null,
  timezone: string
): { from: string; to: string } {
  const now = new Date();
  const lower = fromStr.toLowerCase().trim();

  // Helper to get start of day in local time
  const startOfDay = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Helper to get end of day in local time
  const endOfDay = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  };

  // Helper to add days
  const addDays = (date: Date, days: number): Date => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  // Helper to get next occurrence of a day of week (0=Sunday, 6=Saturday)
  const getNextDayOfWeek = (dayOfWeek: number): Date => {
    const d = new Date(now);
    const currentDay = d.getDay();
    let daysToAdd = dayOfWeek - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7;
    d.setDate(d.getDate() + daysToAdd);
    return startOfDay(d);
  };

  // Parse common relative date patterns
  if (lower === 'today') {
    return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
  }

  if (lower === 'tomorrow') {
    const tomorrow = addDays(now, 1);
    return { from: startOfDay(tomorrow).toISOString(), to: endOfDay(tomorrow).toISOString() };
  }

  if (lower === 'this weekend' || lower === 'weekend') {
    // Get this Saturday
    const saturday = getNextDayOfWeek(6);
    // If today is Saturday or Sunday, use today as start
    if (now.getDay() === 6) {
      return { from: startOfDay(now).toISOString(), to: endOfDay(addDays(now, 1)).toISOString() };
    }
    if (now.getDay() === 0) {
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
    }
    const sunday = addDays(saturday, 1);
    return { from: startOfDay(saturday).toISOString(), to: endOfDay(sunday).toISOString() };
  }

  if (lower === 'next weekend') {
    // Get Saturday of next week
    const daysUntilNextSat = (6 - now.getDay() + 7) % 7 + 7;
    const saturday = addDays(now, daysUntilNextSat === 7 ? 14 : daysUntilNextSat);
    const sunday = addDays(saturday, 1);
    return { from: startOfDay(saturday).toISOString(), to: endOfDay(sunday).toISOString() };
  }

  if (lower === 'this week') {
    // From today until Sunday
    const daysUntilSunday = 7 - now.getDay();
    const sunday = daysUntilSunday === 7 ? now : addDays(now, daysUntilSunday);
    return { from: startOfDay(now).toISOString(), to: endOfDay(sunday).toISOString() };
  }

  if (lower === 'next week') {
    // Next Monday through Sunday
    const daysUntilMonday = (1 - now.getDay() + 7) % 7 || 7;
    const monday = addDays(now, daysUntilMonday);
    const sunday = addDays(monday, 6);
    return { from: startOfDay(monday).toISOString(), to: endOfDay(sunday).toISOString() };
  }

  // Day names: "saturday", "next monday", etc.
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayMatch = lower.match(/(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
  if (dayMatch) {
    const isNext = lower.startsWith('next');
    const targetDay = dayNames.indexOf(dayMatch[1].toLowerCase());
    let date = getNextDayOfWeek(targetDay);
    if (isNext && date.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000) {
      date = addDays(date, 7);
    }
    return { from: startOfDay(date).toISOString(), to: endOfDay(date).toISOString() };
  }

  // Try to parse as ISO date or use date-parser
  const dateResult = extractDateTimeFromMessage(fromStr, now, timezone);
  if (dateResult.datetime) {
    const date = new Date(dateResult.datetime);
    return { from: startOfDay(date).toISOString(), to: endOfDay(date).toISOString() };
  }

  // Fallback: today
  return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
}

/**
 * Parse time string to hours and minutes.
 */
function parseTimeString(timeStr: string): { hours: number; minutes: number } | null {
  // Match patterns like "10am", "3:30pm", "14:00", "9"
  const match = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[3]?.toLowerCase();

  if (ampm === 'pm' && hours < 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;
  // If no am/pm and hours 1-7, assume PM
  if (!ampm && hours >= 1 && hours <= 7) hours += 12;

  return { hours, minutes };
}

/**
 * Convert LLM result to existing CalendarIntent format.
 */
function convertLLMResultToCalendarIntent(
  llmResult: LLMCalendarIntent,
  context: AgentRunContext
): CalendarIntent {
  const timezone = context.timezone ?? 'UTC';

  switch (llmResult.type) {
    case 'search': {
      if (!llmResult.search) {
        return { type: 'unclear', confidence: llmResult.confidence };
      }
      const search = llmResult.search;
      
      // Handle null dateRange - default to next 30 days
      let from: string | null = null;
      let to: string | null = null;
      
      if (search.dateRange) {
        const dateRange = parseRelativeDateRange(
          search.dateRange.from,
          search.dateRange.to,
          timezone
        );
        from = dateRange.from;
        to = dateRange.to;
      }

      return {
        type: 'search',
        query: search.query,
        from,
        to,
        attendee: search.attendee,
        confidence: llmResult.confidence,
      };
    }

    case 'create': {
      if (!llmResult.create) {
        return { type: 'unclear', confidence: llmResult.confidence };
      }
      const create = llmResult.create;

      // Parse start date
      let startAt: string | null = null;
      let endAt: string | null = null;
      let allDay = create.allDay;

      if (create.startDate) {
        const dateRange = parseRelativeDateRange(create.startDate, null, timezone);
        const startDate = new Date(dateRange.from);

        if (create.startTime) {
          const time = parseTimeString(create.startTime);
          if (time) {
            startDate.setHours(time.hours, time.minutes, 0, 0);
            allDay = false;
          }
        }

        startAt = startDate.toISOString();

        // Calculate end time
        if (create.endTime) {
          const endTime = parseTimeString(create.endTime);
          if (endTime) {
            const endDate = new Date(startDate);
            endDate.setHours(endTime.hours, endTime.minutes, 0, 0);
            endAt = endDate.toISOString();
          }
        } else if (!allDay) {
          // Default duration
          const duration = create.durationMinutes ?? DEFAULT_EVENT_DURATION_MINUTES;
          endAt = new Date(startDate.getTime() + duration * 60 * 1000).toISOString();
        } else {
          // All day event
          const endDate = new Date(startDate);
          endDate.setHours(23, 59, 59, 999);
          endAt = endDate.toISOString();
        }
      }

      return {
        type: 'create',
        title: create.title,
        startAt,
        endAt,
        location: create.location,
        notes: null,
        allDay,
        attendees: create.attendees,
        needsClarification: create.needsClarification as 'date' | 'time' | null,
        confidence: llmResult.confidence,
      };
    }

    case 'update': {
      if (!llmResult.update) {
        return { type: 'unclear', confidence: llmResult.confidence };
      }
      const update = llmResult.update;

      const patch: {
        title?: string;
        startAt?: string;
        endAt?: string;
        location?: string;
        notes?: string;
      } = {};

      if (update.changes.newDate || update.changes.newTime) {
        const dateStr = update.changes.newDate ?? 'today';
        const dateRange = parseRelativeDateRange(dateStr, null, timezone);
        const newDate = new Date(dateRange.from);

        if (update.changes.newTime) {
          const time = parseTimeString(update.changes.newTime);
          if (time) {
            newDate.setHours(time.hours, time.minutes, 0, 0);
          }
        }

        patch.startAt = newDate.toISOString();
        patch.endAt = new Date(newDate.getTime() + DEFAULT_EVENT_DURATION_MINUTES * 60 * 1000).toISOString();
      }

      if (update.changes.newTitle) {
        patch.title = update.changes.newTitle;
      }

      if (update.changes.newLocation) {
        patch.location = update.changes.newLocation;
      }

      return {
        type: 'update',
        eventTitle: update.targetEvent,
        eventId: null,
        patch,
        confidence: llmResult.confidence,
      };
    }

    case 'analyze': {
      if (!llmResult.analyze) {
        return { type: 'unclear', confidence: llmResult.confidence };
      }
      const analyze = llmResult.analyze;

      // Handle date range
      let from: string | null = null;
      let to: string | null = null;

      if (analyze.dateRange) {
        const dateRange = parseRelativeDateRange(
          analyze.dateRange.from,
          analyze.dateRange.to,
          timezone
        );
        from = dateRange.from;
        to = dateRange.to;
      }

      return {
        type: 'analyze',
        question: analyze.question,
        from,
        to,
        keywords: analyze.filters?.keywords ?? [],
        pattern: analyze.filters?.pattern ?? null,
        confidence: llmResult.confidence,
      };
    }

    case 'analyzeAndUpdate': {
      if (!llmResult.analyzeAndUpdate) {
        return { type: 'unclear', confidence: llmResult.confidence };
      }
      const analyzeAndUpdate = llmResult.analyzeAndUpdate;

      // Handle date range
      let from: string | null = null;
      let to: string | null = null;

      if (analyzeAndUpdate.dateRange) {
        const dateRange = parseRelativeDateRange(
          analyzeAndUpdate.dateRange.from,
          analyzeAndUpdate.dateRange.to,
          timezone
        );
        from = dateRange.from;
        to = dateRange.to;
      }

      return {
        type: 'analyzeAndUpdate',
        question: analyzeAndUpdate.question,
        action: {
          type: analyzeAndUpdate.action.type,
          value: analyzeAndUpdate.action.value,
          newDate: analyzeAndUpdate.action.newDate,
          newTime: analyzeAndUpdate.action.newTime,
        },
        from,
        to,
        keywords: analyzeAndUpdate.filters?.keywords ?? [],
        pattern: analyzeAndUpdate.filters?.pattern ?? null,
        confidence: llmResult.confidence,
      };
    }

    case 'updateFromContext': {
      if (!llmResult.updateFromContext) {
        return { type: 'unclear', confidence: llmResult.confidence };
      }
      const updateFromContext = llmResult.updateFromContext;

      return {
        type: 'updateFromContext',
        action: {
          type: updateFromContext.action.type,
          value: updateFromContext.action.value,
          newDate: updateFromContext.action.newDate,
          newTime: updateFromContext.action.newTime,
        },
        // eventIds will be populated by parseCalendarIntentWithLLM
        eventIds: undefined,
        confidence: llmResult.confidence,
      };
    }

    case 'analyzeFromContext': {
      if (!llmResult.analyzeFromContext) {
        return { type: 'unclear', confidence: llmResult.confidence };
      }
      const analyzeFromContext = llmResult.analyzeFromContext;

      return {
        type: 'analyzeFromContext',
        question: analyzeFromContext.question,
        // events will be populated by parseCalendarIntentWithLLM
        events: undefined,
        confidence: llmResult.confidence,
      };
    }

    case 'delete':
    case 'unclear':
    default:
      return { type: 'unclear', confidence: llmResult.confidence };
  }
}

/**
 * Parse calendar intent using LLM.
 * Falls back to regex-based parsing on error.
 */
async function parseCalendarIntentWithLLM(
  message: string,
  context: AgentRunContext
): Promise<CalendarIntent> {
  const { llmProvider } = getRouterConfig();
  const currentDate = new Date().toISOString();
  const timezone = context.timezone ?? 'UTC';

  // Build previous results context if available
  let previousResults: PreviousResultsContext | undefined;
  const lastResults = context.previousContext?.lastResults;
  if (lastResults?.domain === 'calendar' && lastResults.events && lastResults.events.length > 0) {
    previousResults = {
      eventCount: lastResults.events.length,
      eventTitles: lastResults.events.map(e => e.title),
      description: lastResults.description,
    };
    context.logger.debug(
      { eventCount: previousResults.eventCount },
      'CalendarAgent: including previous results context for intent parsing'
    );
  }

  const systemPrompt = getCalendarIntentSystemPrompt(timezone, currentDate, previousResults);

  try {
    context.logger.debug(
      { message, hasPreviousResults: !!previousResults },
      'CalendarAgent: parsing intent with LLM'
    );

    const llmResult = await llmProvider.completeJson<LLMCalendarIntent>(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      llmCalendarIntentSchema,
      { temperature: 0.3 }
    );

    context.logger.debug(
      { llmResult, message },
      'CalendarAgent: LLM intent parsing result'
    );

    // Convert LLM result to existing CalendarIntent format
    // Pass the event IDs from context if using updateFromContext
    const intent = convertLLMResultToCalendarIntent(llmResult, context);
    
    // If it's an updateFromContext intent, attach the event IDs
    if (intent.type === 'updateFromContext' && lastResults?.events) {
      (intent as Extract<CalendarIntent, { type: 'updateFromContext' }>).eventIds = 
        lastResults.events.map(e => e.id);
    }

    // If it's an analyzeFromContext intent, attach the event data
    if (intent.type === 'analyzeFromContext' && lastResults?.events) {
      (intent as Extract<CalendarIntent, { type: 'analyzeFromContext' }>).events = 
        lastResults.events.map(e => ({
          id: e.id,
          title: e.title,
          startAt: e.startAt,
          allDay: e.allDay ?? false,
          recurrenceRule: e.recurrenceRule,
        }));
    }
    
    return intent;
  } catch (error) {
    context.logger.warn(
      { error, message },
      'CalendarAgent: LLM intent parsing failed, falling back to regex'
    );
    // Fallback to existing regex-based parsing
    return parseCalendarIntentRegex(message, context);
  }
}

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
 * Parse user message into a structured calendar intent using regex patterns.
 * This is the fallback when LLM parsing fails or for follow-up messages.
 */
function parseCalendarIntentRegex(message: string, context: AgentRunContext): CalendarIntent {
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
 * Parse user message into a structured calendar intent.
 * Uses LLM for natural language understanding with regex fallback.
 * 
 * For follow-up messages with pending context, uses regex directly.
 */
async function parseCalendarIntent(message: string, context: AgentRunContext): Promise<CalendarIntent> {
  const previousContext = context.previousContext;

  // Handle follow-up messages with pending context using regex (faster, deterministic)
  if (previousContext?.awaitingInput && previousContext.pendingEvent) {
    context.logger.debug(
      { awaitingInput: previousContext.awaitingInput, pendingEvent: previousContext.pendingEvent },
      'CalendarAgent: processing follow-up with regex (has pending context)'
    );
    return parseCalendarIntentRegex(message, context);
  }

  // Use LLM for initial intent parsing
  return parseCalendarIntentWithLLM(message, context);
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
  // Extract date/time from the text - pass timezone for correct local time interpretation
  const dateResult = extractDateTimeFromMessage(eventText, new Date(), context.timezone);

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

  // Extract title - be smarter about finding the actual event name
  let title = eventText;

  // First, try to extract a meaningful title from common patterns
  // Pattern: "I have to go [EVENT] on/at [DATE]" -> extract EVENT
  // Also handle: "I have to go to [EVENT]" and "I need to attend [EVENT]"
  // The ^ is removed and we use a more flexible pattern that handles "I " prefix
  const goToMatch = eventText.match(/(?:I\s+)?(?:have\s+to|need\s+to|want\s+to|going\s+to)\s+(?:go\s+(?:to\s+)?|attend\s+)?([a-zA-Z][a-zA-Z0-9\s']+?)(?:\s+(?:on|at|for|,)\s+|\s+(?:next|this|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday))/i);
  if (goToMatch && goToMatch[1]) {
    title = goToMatch[1].trim();
  } else {
    // Remove date/time portions from the text
    if (dateResult.extracted) {
      title = title.replace(new RegExp(`(?:on|at|for)?\\s*${escapeRegex(dateResult.extracted)}`, 'gi'), '').trim();
    }
    // Clean up common filler phrases
    title = title
      .replace(/^(?:I\s+)?(?:have\s+to|need\s+to|want\s+to|going\s+to)\s+(?:go\s+(?:to\s+)?)?/i, '')
      .replace(/,?\s*(?:need\s+(?:it\s+)?in\s+(?:the\s+)?(?:diary|calendar)|put\s+(?:it\s+)?in\s+(?:the\s+)?(?:diary|calendar)|add\s+(?:it\s+)?to\s+(?:the\s+)?(?:diary|calendar))\.?$/i, '')
      .replace(/\s+(?:on|at|for)\s*$/i, '')
      .replace(/^\s*(?:on|at|for)\s+/i, '')
      .replace(/,\s*$/, '')
      .replace(/^\s*,\s*/, '')
      .trim();
  }

  // Capitalize first letter if it looks like an event name
  if (title && title.length > 0 && /^[a-z]/.test(title)) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

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
    const dateResult = extractDateTimeFromMessage(newTimeText, new Date(), context.timezone);
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
    const tz = context.timezone ?? 'UTC';

    if (toolName === 'calendar.create' && toolResult.data) {
      const event = (toolResult.data as { event: { title: string; startAt: string } }).event;
      const startStr = formatEventDate(event.startAt, false, tz);
      return {
        text: `✅ Scheduled "${event.title}" for ${startStr}`,
        actions: [agentAction],
        payload: { event },
      };
    }

    if (toolName === 'calendar.update' && toolResult.data) {
      const event = (toolResult.data as { event: { title: string; startAt: string } }).event;
      return {
        text: `✅ Updated "${event.title}" – now scheduled for ${formatEventDate(event.startAt, false, tz)}`,
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
  const intent = await parseCalendarIntent(message, context);

  context.logger.debug({ intent, message }, 'CalendarAgent: parsed intent');

  switch (intent.type) {
    case 'create':
      return handleCreateIntent(intent, context, toolExecutor);
    case 'search':
      return handleSearchIntent(intent, context, toolExecutor);
    case 'update':
      return handleUpdateIntent(intent, context, toolExecutor);
    case 'analyze':
      return handleAnalyzeIntent(intent, message, context, toolExecutor);
    case 'analyzeFromContext':
      return handleAnalyzeFromContextIntent(intent, message, context);
    case 'analyzeAndUpdate':
      return handleAnalyzeAndUpdateIntent(intent, message, context, toolExecutor);
    case 'updateFromContext':
      return handleUpdateFromContextIntent(intent, message, context, toolExecutor);
    case 'unclear':
    default:
      return {
        text: "I'm not sure what you'd like me to do with the calendar. I can help you:\n" +
          '- Create an event: "Schedule team meeting tomorrow at 3pm"\n' +
          '- View events: "What\'s on my calendar this week?"\n' +
          '- Reschedule: "Move Hamish training to Thursday 6pm"\n' +
          '- Analyze events: "Which events look like meal placeholders?"\n' +
          '- Batch update: "Find meal placeholders and make them all-day events"\n\n' +
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
  isDestructive: boolean,
  /** Optional human-friendly preview (overrides raw input) */
  friendlyPreview?: Record<string, unknown>
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

  // Use friendly preview if provided, otherwise fall back to raw input
  const inputPreview = friendlyPreview ?? pendingAction.toolCall.input;

  const pendingActionInfo: PendingActionInfo = {
    token: pendingAction.token,
    description: pendingAction.description,
    toolName: pendingAction.toolCall.toolName,
    inputPreview,
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
    const tz = context.timezone ?? 'UTC';
    return {
      text: `I'll add "${intent.title}" on ${formatEventDate(intent.startAt!, true, tz)}, but I'm not sure about the exact time. ` +
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
  const tz = context.timezone ?? 'UTC';

  if (needsConfirmation) {
    const dateStr = formatEventDate(intent.startAt!, intent.allDay, tz);
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
    const dateStr = formatEventDate(event.startAt, intent.allDay, tz);
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

/**
 * Handle analyze intent - fetch events then use LLM to reason about them.
 */
async function handleAnalyzeIntent(
  intent: Extract<CalendarIntent, { type: 'analyze' }>,
  originalMessage: string,
  context: AgentRunContext,
  toolExecutor: ToolExecutor
): Promise<CalendarAgentResult> {
  // Step 1: Fetch events from calendar
  const searchInput: Record<string, unknown> = {};
  
  if (intent.from) {
    searchInput.from = intent.from;
  }
  if (intent.to) {
    searchInput.to = intent.to;
  }
  // Get more events for analysis
  searchInput.limit = 50;

  const searchResult = await toolExecutor('calendar.search', searchInput);

  const searchAction: AgentAction = {
    tool: 'calendar.search',
    input: searchInput,
    result: searchResult,
  };

  if (!searchResult.success) {
    return {
      text: `❌ Sorry, I couldn't fetch your calendar events to analyze. ${searchResult.error || ''}`,
      actions: [searchAction],
      payload: { error: searchResult.error },
    };
  }

  const data = searchResult.data as { 
    events: Array<{ 
      id: string;
      title: string; 
      startAt: string; 
      endAt: string;
      location?: string | null;
      notes?: string | null;
      allDay?: boolean;
    }>; 
    total: number 
  };

  if (data.events.length === 0) {
    return {
      text: "📅 I don't see any events in your calendar to analyze. Try creating some events first!",
      actions: [searchAction],
      payload: { events: [], total: 0 },
    };
  }

  // Step 2: Build a prompt for the LLM to analyze the events
  const { llmProvider } = getRouterConfig();
  const tz = context.timezone ?? 'UTC';

  const eventsForAnalysis = data.events.map((e) => ({
    title: e.title,
    date: formatDateShort(e.startAt, tz),
    time: e.allDay ? 'All day' : formatTimeShort(e.startAt, tz),
    location: e.location ?? null,
    notes: e.notes ?? null,
  }));

  const analysisPrompt = `You are analyzing a family's calendar events to answer their question.

USER'S QUESTION: "${originalMessage}"

CALENDAR EVENTS (${data.events.length} events):
${JSON.stringify(eventsForAnalysis, null, 2)}

${intent.keywords.length > 0 ? `KEYWORDS TO LOOK FOR: ${intent.keywords.join(', ')}` : ''}
${intent.pattern ? `PATTERN TO IDENTIFY: ${intent.pattern}` : ''}

Analyze the events and answer the user's question. Be specific and reference actual events from the list.
If looking for patterns or categorizations, explain your reasoning.
Format your response in a clear, readable way with bullet points if listing multiple items.`;

  try {
    const analysisResponse = await llmProvider.complete(
      [
        { role: 'system', content: 'You are a helpful calendar assistant that analyzes events and answers questions about them.' },
        { role: 'user', content: analysisPrompt },
      ],
      { temperature: 0.5 }
    );

    return {
      text: analysisResponse,
      actions: [searchAction],
      payload: { 
        events: data.events, 
        total: data.total,
        analysisType: 'calendar_reasoning',
      },
    };
  } catch (err) {
    context.logger.error({ err }, 'CalendarAgent: analysis LLM call failed');
    
    // Fallback: just list the events
    const eventList = data.events
      .slice(0, 10)
      .map((e) => `• **${e.title}** – ${formatEventDate(e.startAt, false, tz)}`)
      .join('\n');

    return {
      text: `📅 I found ${data.total} events but couldn't complete the analysis. Here are the events:\n\n${eventList}`,
      actions: [searchAction],
      payload: { events: data.events, total: data.total, error: 'Analysis failed' },
    };
  }
}

/**
 * Calendar event type used in analyze and update operations.
 */
type CalendarEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  location?: string | null;
  notes?: string | null;
  allDay?: boolean;
};

/**
 * Use LLM to identify events matching a natural language criteria.
 * Returns array of events that match.
 */
async function identifyMatchingEventsWithLLM(
  events: CalendarEvent[],
  question: string,
  filters: { keywords?: string[]; pattern?: string | null; [key: string]: unknown } | undefined,
  context: AgentRunContext
): Promise<CalendarEvent[]> {
  const { llmProvider } = getRouterConfig();
  const tz = context.timezone ?? 'UTC';

  const eventsForMatching = events.map((e, i) => ({
    index: i,
    title: e.title,
    date: formatDateShort(e.startAt, tz),
    time: e.allDay ? 'All day' : formatTimeShort(e.startAt, tz),
    isAllDay: e.allDay ?? false,
  }));

  const prompt = `Analyze these calendar events and identify which ones match the user's criteria.

USER'S CRITERIA: "${question}"
${filters?.keywords?.length ? `KEYWORDS TO LOOK FOR: ${filters.keywords.join(', ')}` : ''}
${filters?.pattern ? `PATTERN TO IDENTIFY: ${filters.pattern}` : ''}

EVENTS:
${JSON.stringify(eventsForMatching, null, 2)}

Return a JSON array of indices (numbers only) for events that match the criteria.
Example: [0, 3, 5]
If no events match, return an empty array: []

Return ONLY the JSON array, no explanation.`;

  try {
    const response = await llmProvider.complete(
      [
        { role: 'system', content: 'You identify calendar events matching criteria. Return only a JSON array of indices. No explanations.' },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.1 }
    );

    // Parse the response as JSON array
    const cleanedResponse = response.trim().replace(/```json?\n?|\n?```/g, '');
    const indices = JSON.parse(cleanedResponse) as number[];
    
    if (!Array.isArray(indices)) {
      throw new Error('Response is not an array');
    }

    return indices
      .filter((i) => typeof i === 'number' && i >= 0 && i < events.length)
      .map((i) => events[i]);
  } catch (err) {
    context.logger.warn({ err }, 'CalendarAgent: LLM event matching failed, falling back to keyword matching');
    
    // Fallback: keyword matching
    const keywords = filters?.keywords;
    if (!keywords?.length) {
      return [];
    }
    
    return events.filter((e) =>
      keywords.some((k) => e.title.toLowerCase().includes(k.toLowerCase()))
    );
  }
}

/**
 * Handle analyze and update intent - find events matching criteria then propose batch updates.
 */
async function handleAnalyzeAndUpdateIntent(
  intent: Extract<CalendarIntent, { type: 'analyzeAndUpdate' }>,
  originalMessage: string,
  context: AgentRunContext,
  toolExecutor: ToolExecutor
): Promise<CalendarAgentResult> {
  // Step 1: Fetch events from calendar
  const searchInput: Record<string, unknown> = {};
  
  if (intent.from) {
    searchInput.from = intent.from;
  }
  if (intent.to) {
    searchInput.to = intent.to;
  }
  // Get more events for batch operations
  searchInput.limit = 50;

  const searchResult = await toolExecutor('calendar.search', searchInput);

  const searchAction: AgentAction = {
    tool: 'calendar.search',
    input: searchInput,
    result: searchResult,
  };

  if (!searchResult.success) {
    return {
      text: `❌ Sorry, I couldn't fetch your calendar events. ${searchResult.error || ''}`,
      actions: [searchAction],
      payload: { error: searchResult.error },
    };
  }

  const data = searchResult.data as { 
    events: CalendarEvent[]; 
    total: number 
  };

  if (data.events.length === 0) {
    return {
      text: "📅 I don't see any events in your calendar to analyze. Try creating some events first!",
      actions: [searchAction],
      payload: { events: [], total: 0 },
    };
  }

  // Step 2: Use LLM to identify matching events
  const matchingEvents = await identifyMatchingEventsWithLLM(
    data.events,
    intent.question,
    { keywords: intent.keywords, pattern: intent.pattern },
    context
  );

  if (matchingEvents.length === 0) {
    return {
      text: `🔍 I looked through ${data.events.length} events but couldn't find any that match your criteria: "${intent.question}".\n\nWould you like me to search with different criteria?`,
      actions: [searchAction],
      payload: { events: data.events, total: data.total, matchingCount: 0 },
    };
  }

  // Step 3: Build the batch update proposal
  const tz = context.timezone ?? 'UTC';
  
  // Describe what action we'll take
  let actionDescription = '';
  switch (intent.action.type) {
    case 'setAllDay':
      actionDescription = intent.action.value 
        ? 'convert to all-day events (they\'ll appear at the top of the calendar)'
        : 'convert from all-day to timed events';
      break;
    case 'reschedule':
      actionDescription = `reschedule to ${intent.action.newDate || 'new date'}${intent.action.newTime ? ` at ${intent.action.newTime}` : ''}`;
      break;
    case 'delete':
      actionDescription = 'delete these events';
      break;
    case 'updateTitle':
      actionDescription = `update title to "${intent.action.value}"`;
      break;
    case 'updateLocation':
      actionDescription = `update location to "${intent.action.value}"`;
      break;
    default:
      actionDescription = 'update these events';
  }

  // Build event list for display
  const eventList = matchingEvents
    .slice(0, 10)
    .map((e) => {
      const timeStr = e.allDay ? 'All day' : `${formatTimeShort(e.startAt, tz)}-${formatTimeShort(e.endAt, tz)}`;
      return `• **${e.title}** – ${formatDateShort(e.startAt, tz)} (${timeStr})`;
    })
    .join('\n');

  const moreText = matchingEvents.length > 10 
    ? `\n\n_(and ${matchingEvents.length - 10} more events)_` 
    : '';

  // Step 4: Create pending action for confirmation
  const batchInput = {
    eventIds: matchingEvents.map((e) => e.id),
    patch: {} as Record<string, unknown>,
  };

  // Set up the patch based on action type
  switch (intent.action.type) {
    case 'setAllDay':
      batchInput.patch.allDay = intent.action.value;
      break;
    case 'updateTitle':
      batchInput.patch.title = intent.action.value;
      break;
    case 'updateLocation':
      batchInput.patch.location = intent.action.value;
      break;
    // Note: reschedule and delete would need additional handling
  }

  const toolName = 'calendar.batchUpdate';
  const description = `${actionDescription} for ${matchingEvents.length} event${matchingEvents.length > 1 ? 's' : ''}`;

  // Build a human-friendly preview instead of showing raw event IDs
  const eventTitles = matchingEvents.map(e => e.title);
  const friendlyPreview = {
    action: actionDescription,
    eventCount: matchingEvents.length,
    events: eventTitles.slice(0, 5).join(', ') + (eventTitles.length > 5 ? '...' : ''),
  };

  // Always require confirmation for batch operations
  const pendingResult = createPendingConfirmation(toolName, batchInput, description, context, false, friendlyPreview);

  return {
    text: `📅 I found **${matchingEvents.length} events** that look like meal placeholders:\n\n${eventList}${moreText}\n\n**Proposed action:** ${actionDescription}\n\nWould you like me to ${actionDescription}?`,
    actions: [searchAction],
    payload: {
      events: matchingEvents,
      matchingCount: matchingEvents.length,
      totalSearched: data.total,
      proposedAction: intent.action,
    },
    requiresConfirmation: true,
    pendingAction: pendingResult.pendingAction,
  };
}

/**
 * Handle analyze from context intent - analyze events from a previous search/analyze result.
 * This is used when user asks "which of these are recurring?" referring to previously shown events.
 * No database calls are made - we analyze the stored event data directly.
 */
async function handleAnalyzeFromContextIntent(
  intent: Extract<CalendarIntent, { type: 'analyzeFromContext' }>,
  originalMessage: string,
  context: AgentRunContext
): Promise<CalendarAgentResult> {
  const tz = context.timezone ?? 'UTC';

  // Check if we have events from context
  if (!intent.events || intent.events.length === 0) {
    return {
      text: "🤔 I'm not sure which events you're referring to. Could you first show me the events you want to analyze? For example:\n\n" +
        '- "Find events that look like meal placeholders"\n' +
        '- "Show me my events this week"\n\n' +
        'Then I can help you analyze them.',
      actions: [],
      payload: { error: 'no_context', needsInput: true },
    };
  }

  const { llmProvider } = getRouterConfig();

  // Use LLM to analyze the stored events based on the user's question
  const eventsForAnalysis = intent.events.map((e, i) => ({
    index: i,
    title: e.title,
    date: formatDateShort(e.startAt, tz),
    time: e.allDay ? 'All day' : formatTimeShort(e.startAt, tz),
    isAllDay: e.allDay,
    isRecurring: !!e.recurrenceRule,
    recurrenceRule: e.recurrenceRule,
  }));

  const analysisPrompt = `You are analyzing calendar events that were previously retrieved.
The user is asking: "${intent.question}"

Here are the ${intent.events.length} events to analyze:
${JSON.stringify(eventsForAnalysis, null, 2)}

Based on the user's question, provide a helpful analysis of these events.
Your response should:
1. Directly answer the user's question
2. List the relevant events (if asking for a subset)
3. Include any patterns or insights you notice

Respond in a conversational, helpful tone with markdown formatting.`;

  try {
    const analysis = await llmProvider.complete([
      { role: 'system', content: 'You are a helpful family calendar assistant. Provide clear, concise analysis.' },
      { role: 'user', content: analysisPrompt },
    ], { temperature: 0.3 });

    context.logger.debug(
      { question: intent.question, eventCount: intent.events.length },
      'CalendarAgent: analyzeFromContext completed'
    );

    return {
      text: analysis,
      actions: [],
      payload: {
        analyzedEventCount: intent.events.length,
        question: intent.question,
        // Keep the events in payload so they can be used for follow-up
        events: intent.events,
      },
    };
  } catch (error) {
    context.logger.error({ error }, 'CalendarAgent: analyzeFromContext LLM call failed');
    return {
      text: `Sorry, I had trouble analyzing those events. Could you rephrase your question?`,
      actions: [],
      payload: { error: 'llm_error' },
    };
  }
}

/**
 * Handle update from context intent - modify events from a previous search/analyze result.
 * This is used when user says "change these to all-day" referring to previously shown events.
 */
async function handleUpdateFromContextIntent(
  intent: Extract<CalendarIntent, { type: 'updateFromContext' }>,
  originalMessage: string,
  context: AgentRunContext,
  toolExecutor: ToolExecutor
): Promise<CalendarAgentResult> {
  const tz = context.timezone ?? 'UTC';

  // Check if we have event IDs from context
  if (!intent.eventIds || intent.eventIds.length === 0) {
    return {
      text: "🤔 I'm not sure which events you're referring to. Could you first show me the events you want to modify? For example:\n\n" +
        '- "Find events that look like meal placeholders"\n' +
        '- "Show me my events this week"\n\n' +
        'Then I can help you update them.',
      actions: [],
      payload: { error: 'no_context', needsInput: true },
    };
  }

  // Get the event titles from context for display
  const lastResults = context.previousContext?.lastResults;
  const eventTitles = lastResults?.events?.slice(0, 10).map(e => e.title) ?? [];

  // Describe what action we'll take
  let actionDescription = '';
  switch (intent.action.type) {
    case 'setAllDay':
      actionDescription = intent.action.value 
        ? 'convert to all-day events (they\'ll appear at the top of the calendar)'
        : 'convert from all-day to timed events';
      break;
    case 'reschedule':
      actionDescription = `reschedule to ${intent.action.newDate || 'new date'}${intent.action.newTime ? ` at ${intent.action.newTime}` : ''}`;
      break;
    case 'delete':
      actionDescription = 'delete these events';
      break;
    case 'updateTitle':
      actionDescription = `update title to "${intent.action.value}"`;
      break;
    case 'updateLocation':
      actionDescription = `update location to "${intent.action.value}"`;
      break;
    default:
      actionDescription = 'update these events';
  }

  // Build event list for display
  const eventList = eventTitles
    .map((title) => `• **${title}**`)
    .join('\n');

  const moreText = intent.eventIds.length > 10 
    ? `\n\n_(and ${intent.eventIds.length - 10} more events)_` 
    : '';

  // Build the batch update input
  const batchInput = {
    eventIds: intent.eventIds,
    patch: {} as Record<string, unknown>,
  };

  // Set up the patch based on action type
  switch (intent.action.type) {
    case 'setAllDay':
      batchInput.patch.allDay = intent.action.value;
      break;
    case 'updateTitle':
      batchInput.patch.title = intent.action.value;
      break;
    case 'updateLocation':
      batchInput.patch.location = intent.action.value;
      break;
    // Note: reschedule and delete would need additional handling
  }

  const toolName = 'calendar.batchUpdate';
  const description = `${actionDescription} for ${intent.eventIds.length} event${intent.eventIds.length > 1 ? 's' : ''} from previous search`;

  context.logger.info(
    { eventCount: intent.eventIds.length, action: intent.action.type, eventIds: intent.eventIds.slice(0, 5) },
    'CalendarAgent: handleUpdateFromContextIntent - using event IDs from context'
  );

  // Build a human-friendly preview instead of showing raw event IDs
  const friendlyPreview = {
    action: actionDescription,
    eventCount: intent.eventIds.length,
    events: eventTitles.slice(0, 5).join(', ') + (eventTitles.length > 5 ? '...' : ''),
  };

  // Always require confirmation for batch operations
  const pendingResult = createPendingConfirmation(toolName, batchInput, description, context, false, friendlyPreview);

  return {
    text: `📅 I'll update the **${intent.eventIds.length} events** from your previous search:\n\n${eventList}${moreText}\n\n**Proposed action:** ${actionDescription}\n\nWould you like me to proceed?`,
    actions: [],
    payload: {
      eventIds: intent.eventIds,
      eventCount: intent.eventIds.length,
      proposedAction: intent.action,
      fromContext: true,
    },
    requiresConfirmation: true,
    pendingAction: pendingResult.pendingAction,
  };
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
    const tz = context.timezone ?? 'UTC';

    if (data.events.length === 0) {
      const rangeStr = intent.from && intent.to
        ? `between ${formatDateShort(intent.from, tz)} and ${formatDateShort(intent.to, tz)}`
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
        const dateStr = formatEventDate(e.startAt, false, tz);
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
      const tz = context.timezone ?? 'UTC';
      const options = searchData.events
        .slice(0, 3)
        .map((e, i) => `${i + 1}. "${e.title}" on ${formatEventDate(e.startAt, false, tz)}`)
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
  const tz = context.timezone ?? 'UTC';

  if (needsConfirmation) {
    const changesList: string[] = [];
    if (intent.patch.startAt) {
      changesList.push(`new time: ${formatEventDate(intent.patch.startAt, false, tz)}`);
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
      text: `✅ Updated "${event.title}" – now scheduled for ${formatEventDate(event.startAt, false, tz)}`,
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

function formatEventDate(isoString: string, allDayOnly = false, timezone = 'UTC'): string {
  const date = new Date(isoString);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  };

  if (!allDayOnly) {
    options.hour = 'numeric';
    options.minute = '2-digit';
  }

  return date.toLocaleDateString('en-US', options);
}

function formatDateShort(isoString: string, timezone = 'UTC'): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  });
}

function formatTimeShort(isoString: string, timezone = 'UTC'): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
}
