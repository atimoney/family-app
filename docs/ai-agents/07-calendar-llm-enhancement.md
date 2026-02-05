# Calendar Agent LLM Enhancement

> **Issue**: The calendar agent uses rigid regex patterns that fail on natural language queries like "what do we have on this weekend?"
> **Solution**: Add LLM-based intent parsing to supplement/replace regex patterns

---

## Problem Statement

Currently, the calendar agent's `parseCalendarIntent()` function in `packages/agent-core/src/agents/calendar-agent.ts` uses hardcoded regex patterns:

```typescript
// Current approach - fails on natural queries
if (/(?:show|list|what['']?s|get|find|see|check)\s+(?:my\s+)?(?:calendar|events?|schedule)/i.test(lower)) {
  return parseSearchIntent(message, context);
}
```

**Failure case**:
- Input: `"what do we have on this weekend?"`
- Router correctly routes to `calendar` domain with 0.9 confidence
- Calendar agent returns `{"type":"unclear","confidence":0}` because no regex matches

---

## Requirements

### Must Support Natural Language Queries

1. **Search/Query Events**:
   - "what do we have on this weekend?"
   - "am I free tomorrow afternoon?"
   - "any events next week?"
   - "what's happening Saturday?"
   - "do we have anything on Tuesday?"
   - "show me February's events"

2. **Create Events**:
   - "schedule dinner with John on Friday at 7pm"
   - "add kids basketball Saturday 10am"
   - "book a dentist appointment next Monday morning"
   - "put Sarah's birthday party on the 15th"

3. **Update/Reschedule Events**:
   - "move the dentist to Thursday"
   - "reschedule team meeting to 3pm"
   - "change soccer practice to 5pm"

4. **Delete Events**:
   - "cancel the meeting tomorrow"
   - "remove dinner with John"

---

## Implementation Specification

### 1. Add LLM-Based Intent Parser

Create a new function `parseCalendarIntentWithLLM()` that uses the configured LLM provider:

```typescript
// packages/agent-core/src/agents/calendar-agent.ts

import { z } from 'zod';
import { getRouterConfig } from '../router.js';

// Schema for LLM response
const calendarIntentSchema = z.object({
  type: z.enum(['create', 'search', 'update', 'delete', 'unclear']),
  confidence: z.number().min(0).max(1),
  
  // For CREATE intent
  create: z.object({
    title: z.string(),
    startDate: z.string().nullable().describe('ISO date or relative like "tomorrow", "next Saturday"'),
    startTime: z.string().nullable().describe('Time like "10am", "14:00", or null for all-day'),
    endTime: z.string().nullable(),
    duration: z.number().nullable().describe('Duration in minutes if no end time'),
    location: z.string().nullable(),
    attendees: z.array(z.string()),
    allDay: z.boolean(),
    needsClarification: z.enum(['date', 'time', 'title', null]).nullable(),
  }).optional(),
  
  // For SEARCH intent
  search: z.object({
    query: z.string().nullable().describe('Search term or null for all events'),
    dateRange: z.object({
      from: z.string().describe('Relative date like "today", "this weekend", "next week"'),
      to: z.string().nullable(),
    }),
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
    }),
  }).optional(),
  
  // For DELETE intent
  delete: z.object({
    targetEvent: z.string().describe('Title or description of event to delete'),
    date: z.string().nullable().describe('Specific date if mentioned'),
  }).optional(),
  
  reasoning: z.string().describe('Brief explanation of interpretation'),
});

type LLMCalendarIntent = z.infer<typeof calendarIntentSchema>;
```

### 2. System Prompt for Calendar Intent Parsing

```typescript
function getCalendarIntentSystemPrompt(timezone: string, currentDate: string): string {
  return `You are an intent parser for a family calendar assistant.
Your job is to analyze user messages and extract structured calendar intents.

Current date/time: ${currentDate}
User timezone: ${timezone}

INTENT TYPES:
- search: User wants to VIEW or QUERY events (e.g., "what's on this weekend?", "am I free tomorrow?")
- create: User wants to ADD a new event (e.g., "schedule dinner Friday 7pm")
- update: User wants to CHANGE an existing event (e.g., "move meeting to 3pm")
- delete: User wants to REMOVE an event (e.g., "cancel tomorrow's appointment")
- unclear: Cannot determine intent or missing critical info

DATE INTERPRETATION RULES:
- "this weekend" = upcoming Saturday and Sunday
- "next weekend" = Saturday and Sunday of next week
- "tomorrow" = the day after current date
- "next Monday" = the upcoming Monday (could be this week or next)
- Interpret dates relative to ${currentDate}

CONFIDENCE SCORING:
- 0.9-1.0: Clear intent with all required info
- 0.7-0.89: Clear intent but some details assumed
- 0.5-0.69: Ambiguous, may need clarification
- Below 0.5: Unclear intent

For SEARCH intents:
- Always populate dateRange.from with the interpreted date range
- Use "today", "tomorrow", "this weekend", "this week", "next week", etc.

For CREATE intents:
- Extract as much detail as possible
- Set needsClarification if date or time is missing
- Default duration is 60 minutes if not specified

Respond with valid JSON matching the schema. No markdown, no explanations.`;
}
```

### 3. Implementation Function

```typescript
async function parseCalendarIntentWithLLM(
  message: string,
  context: AgentRunContext
): Promise<CalendarIntent> {
  const { llmProvider } = getRouterConfig();
  const currentDate = new Date().toISOString();
  
  const systemPrompt = getCalendarIntentSystemPrompt(
    context.timezone ?? 'UTC',
    currentDate
  );
  
  try {
    const llmResult = await llmProvider.completeJson<LLMCalendarIntent>(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      calendarIntentSchema,
      { temperature: 0.3 } // Lower temperature for more consistent parsing
    );
    
    context.logger.debug(
      { llmResult, message },
      'CalendarAgent: LLM intent parsing result'
    );
    
    // Convert LLM result to existing CalendarIntent format
    return convertLLMResultToCalendarIntent(llmResult, context);
    
  } catch (error) {
    context.logger.warn(
      { error, message },
      'CalendarAgent: LLM intent parsing failed, falling back to regex'
    );
    // Fallback to existing regex-based parsing
    return parseCalendarIntentRegex(message, context);
  }
}
```

### 4. Conversion Function

```typescript
function convertLLMResultToCalendarIntent(
  llmResult: LLMCalendarIntent,
  context: AgentRunContext
): CalendarIntent {
  const timezone = context.timezone ?? 'UTC';
  
  switch (llmResult.type) {
    case 'search': {
      const search = llmResult.search!;
      const dateRange = parseDateRangeFromRelative(
        search.dateRange.from,
        search.dateRange.to,
        timezone
      );
      
      return {
        type: 'search',
        query: search.query,
        from: dateRange.from,
        to: dateRange.to,
        attendee: search.attendee,
        confidence: llmResult.confidence,
      };
    }
    
    case 'create': {
      const create = llmResult.create!;
      const { startAt, endAt } = parseEventTimes(
        create.startDate,
        create.startTime,
        create.endTime,
        create.duration,
        create.allDay,
        timezone
      );
      
      return {
        type: 'create',
        title: create.title,
        startAt,
        endAt,
        location: create.location,
        notes: null,
        allDay: create.allDay,
        attendees: create.attendees,
        needsClarification: create.needsClarification,
        confidence: llmResult.confidence,
      };
    }
    
    case 'update': {
      const update = llmResult.update!;
      return {
        type: 'update',
        eventTitle: update.targetEvent,
        eventId: null,
        patch: {
          title: update.changes.newTitle ?? undefined,
          startAt: update.changes.newDate ?? undefined,
          // Parse time changes...
        },
        confidence: llmResult.confidence,
      };
    }
    
    case 'delete':
    case 'unclear':
    default:
      return { type: 'unclear', confidence: llmResult.confidence };
  }
}
```

### 5. Update Main Parser to Use LLM

```typescript
/**
 * Parse user message into a structured calendar intent.
 * Uses LLM for natural language understanding with regex fallback.
 */
async function parseCalendarIntent(
  message: string,
  context: AgentRunContext
): Promise<CalendarIntent> {
  // Handle follow-up messages with pending context first (existing logic)
  const previousContext = context.previousContext;
  if (previousContext?.awaitingInput && previousContext.pendingEvent) {
    // ... existing follow-up handling code ...
  }
  
  // Use LLM for intent parsing
  return parseCalendarIntentWithLLM(message, context);
}
```

### 6. Helper: Parse Relative Date Ranges

```typescript
function parseDateRangeFromRelative(
  from: string,
  to: string | null,
  timezone: string
): { from: string; to: string } {
  const now = new Date();
  // Use existing date-parser utilities
  
  const ranges: Record<string, () => { from: Date; to: Date }> = {
    'today': () => ({
      from: startOfDay(now),
      to: endOfDay(now),
    }),
    'tomorrow': () => ({
      from: startOfDay(addDays(now, 1)),
      to: endOfDay(addDays(now, 1)),
    }),
    'this weekend': () => ({
      from: startOfDay(getNextSaturday(now)),
      to: endOfDay(getNextSunday(now)),
    }),
    'this week': () => ({
      from: startOfDay(now),
      to: endOfDay(getEndOfWeek(now)),
    }),
    'next week': () => ({
      from: startOfDay(getStartOfNextWeek(now)),
      to: endOfDay(getEndOfNextWeek(now)),
    }),
  };
  
  const rangeKey = from.toLowerCase();
  const range = ranges[rangeKey]?.() ?? {
    from: now,
    to: addDays(now, 7),
  };
  
  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
  };
}
```

---

## Testing Checklist

After implementation, verify these queries work correctly:

| Query | Expected Intent | Expected Date Range |
|-------|-----------------|---------------------|
| "what do we have on this weekend?" | search | Saturday-Sunday |
| "am I free tomorrow afternoon?" | search | Tomorrow 12pm-6pm |
| "any events next week?" | search | Monday-Sunday next week |
| "what's on the calendar for February?" | search | Feb 1-28/29 |
| "schedule dinner Friday 7pm" | create | This/next Friday 7pm |
| "add kids basketball Saturday 10am" | create | This Saturday 10am |
| "move the dentist to Thursday" | update | Target: dentist, new: Thursday |
| "cancel tomorrow's meeting" | delete | Target: meeting, date: tomorrow |

---

## Migration Strategy

1. **Phase 1**: Add LLM parsing alongside regex (current)
   - Keep regex as fallback
   - Log both results for comparison
   - Use LLM result when confidence > 0.7

2. **Phase 2**: Primary LLM with regex fallback
   - LLM is primary parser
   - Regex only for LLM failures/timeouts

3. **Phase 3**: Remove regex patterns
   - Full LLM-based parsing
   - Keep simple keyword detection for quick routing

---

## Environment Variables

```bash
# Existing
OPENAI_API_KEY=sk-...
AI_MODEL=gpt-4o

# Optional: Separate model for intent parsing (cheaper/faster)
AI_INTENT_MODEL=gpt-4o-mini
AI_INTENT_TEMPERATURE=0.3
```

---

## Cost Considerations

- Each calendar intent parse = 1 LLM call (~200-500 tokens)
- Estimated cost: ~$0.001-0.003 per query with gpt-4o-mini
- Consider caching common patterns
- Use lower temperature (0.3) for consistent parsing
