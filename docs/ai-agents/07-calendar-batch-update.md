# Calendar Batch Update Enhancement

## User Story
User asks: *"What events in my calendar look like placeholders for meal plans like pizza night? I need to change them from timed events to all day events so they sit at the top of the calendar."*

This is a two-part request:
1. **Find** events matching criteria (analyze intent)
2. **Modify** those events (batch update with confirmation)

## Current State
- `analyze` intent correctly finds meal placeholder events
- Returns a markdown response describing the events
- No ability to take action on the results

## Desired Flow

```
User: "what events look like meal placeholders? change them to all-day"
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Parse Intent with LLM                                        │
│    - Type: "analyze_and_update"                                 │
│    - Question: "Find meal placeholder events"                   │
│    - Action: { type: "setAllDay", value: true }                │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Fetch Events (calendar.search)                               │
│    - Get all upcoming events                                    │
│    - LLM analyzes which match criteria                          │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Generate Batch Update Proposal                               │
│    Found 3 events that look like meal placeholders:             │
│    • Pizza Night (Sat Feb 7, 5pm-8pm)                          │
│    • Taco Tuesday (Tue Feb 10, 6pm-7pm)                        │
│    • Sunday Roast (Sun Feb 15, 4pm-6pm)                        │
│                                                                 │
│    Would you like me to convert these to all-day events?       │
│    [Confirm] [Cancel]                                           │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼ (User confirms)
┌─────────────────────────────────────────────────────────────────┐
│ 4. Execute Batch Update (calendar.batchUpdate)                  │
│    - For each event: convert to all-day via Google Calendar API │
│    - Report success/failure for each                            │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Changes

### 1. Intent Schema Enhancement (`calendar-agent.ts`)

Add `analyzeAndUpdate` intent type:

```typescript
const llmCalendarIntentSchema = z.object({
  type: z.enum(['create', 'search', 'update', 'delete', 'analyze', 'analyzeAndUpdate', 'unclear']),
  // ... existing fields ...
  
  // For ANALYZE_AND_UPDATE intent - find events then modify them
  analyzeAndUpdate: z.object({
    question: z.string().describe('What events to find'),
    action: z.object({
      type: z.enum(['setAllDay', 'reschedule', 'delete', 'updateTitle', 'updateLocation']),
      value: z.union([z.boolean(), z.string()]).nullable().describe('New value for the change'),
      newDate: z.string().nullable().describe('New date if rescheduling'),
      newTime: z.string().nullable().describe('New time if rescheduling'),
    }),
    dateRange: z.object({
      from: z.string(),
      to: z.string().nullable(),
    }).nullable(),
    filters: z.object({
      keywords: z.array(z.string()),
      pattern: z.string().nullable(),
    }).optional(),
  }).optional(),
});
```

### 2. System Prompt Enhancement

Add to the LLM system prompt:

```
For ANALYZE_AND_UPDATE intent (find events then modify them):
{"type":"analyzeAndUpdate","confidence":0.9,"reasoning":"User wants to find meal placeholders and convert to all-day","analyzeAndUpdate":{"question":"Find events that look like meal plan placeholders","action":{"type":"setAllDay","value":true,"newDate":null,"newTime":null},"dateRange":null,"filters":{"keywords":["pizza","dinner","lunch","meal"],"pattern":"meal-like names"}}}
```

### 3. Handler for analyzeAndUpdate (`calendar-agent.ts`)

```typescript
async function handleAnalyzeAndUpdateIntent(
  intent: AnalyzeAndUpdateIntent,
  originalMessage: string,
  context: AgentRunContext,
  toolExecutor: ToolExecutor
): Promise<CalendarAgentResult> {
  // Step 1: Fetch events
  const searchResult = await toolExecutor('calendar.search', { limit: 50 });
  
  // Step 2: Use LLM to identify matching events
  const matchingEvents = await identifyMatchingEvents(
    searchResult.data.events,
    intent.question,
    intent.filters,
    context
  );
  
  if (matchingEvents.length === 0) {
    return {
      text: "I couldn't find any events matching your criteria.",
      actions: [searchAction],
    };
  }
  
  // Step 3: Generate confirmation with pending action
  const token = crypto.randomUUID();
  const pendingAction: PendingActionInfo = {
    token,
    domain: 'calendar',
    tool: 'calendar.batchUpdate',
    description: `Convert ${matchingEvents.length} events to all-day events`,
    input: {
      eventIds: matchingEvents.map(e => e.id),
      patch: { allDay: true },
    },
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };
  
  pendingActionStore.set(token, pendingAction);
  
  const eventList = matchingEvents
    .map(e => `• **${e.title}** – ${formatEventDate(e.startAt)} (${e.allDay ? 'all-day' : formatTime(e.startAt) + '-' + formatTime(e.endAt)})`)
    .join('\n');
  
  return {
    text: `📅 I found ${matchingEvents.length} events that look like meal placeholders:\n\n${eventList}\n\nWould you like me to convert these to all-day events so they appear at the top of your calendar?`,
    actions: [searchAction],
    requiresConfirmation: true,
    pendingAction,
  };
}
```

### 4. Batch Update Handler (`calendar-handlers.ts`)

Add new tool `calendar.batchUpdate`:

```typescript
async function batchUpdate(
  input: {
    eventIds: string[];
    patch: {
      allDay?: boolean;
      title?: string;
      location?: string;
    };
  },
  context: ToolContext
): Promise<ToolResult<{ updated: number; failed: string[] }>> {
  const authClient = await getGoogleCalendarAuth(context.userId);
  if (!authClient) {
    return { success: false, error: 'Google Calendar not connected' };
  }
  
  const calendarId = await getCalendarId(context);
  let updated = 0;
  const failed: string[] = [];
  
  for (const eventId of input.eventIds) {
    try {
      // Get current event
      const current = await getGoogleEvent({ auth: authClient, calendarId, eventId });
      
      // Build update
      const eventUpdate: calendar_v3.Schema$Event = {};
      
      if (input.patch.allDay !== undefined) {
        // Convert to all-day: use date instead of dateTime
        if (input.patch.allDay) {
          const startDate = current.start?.dateTime 
            ? new Date(current.start.dateTime).toISOString().split('T')[0]
            : current.start?.date;
          const endDate = current.end?.dateTime
            ? new Date(current.end.dateTime).toISOString().split('T')[0]  
            : current.end?.date;
          
          eventUpdate.start = { date: startDate };
          eventUpdate.end = { date: endDate };
        } else {
          // Convert from all-day to timed (default to 9am-10am)
          const startDate = current.start?.date ?? new Date().toISOString().split('T')[0];
          eventUpdate.start = { dateTime: `${startDate}T09:00:00`, timeZone: context.timezone };
          eventUpdate.end = { dateTime: `${startDate}T10:00:00`, timeZone: context.timezone };
        }
      }
      
      if (input.patch.title) {
        eventUpdate.summary = input.patch.title;
      }
      
      await updateEvent({
        auth: authClient,
        calendarId,
        eventId,
        event: eventUpdate,
      });
      
      updated++;
    } catch (err) {
      failed.push(eventId);
      context.logger.error({ err, eventId }, 'Failed to update event');
    }
  }
  
  return {
    success: true,
    data: { updated, failed },
  };
}
```

### 5. LLM Event Matching Helper

```typescript
async function identifyMatchingEvents(
  events: CalendarEvent[],
  question: string,
  filters: { keywords: string[]; pattern: string | null } | undefined,
  context: AgentRunContext
): Promise<CalendarEvent[]> {
  const { llmProvider } = getRouterConfig();
  
  const prompt = `Analyze these calendar events and identify which ones match the criteria.

CRITERIA: ${question}
${filters?.keywords?.length ? `KEYWORDS: ${filters.keywords.join(', ')}` : ''}
${filters?.pattern ? `PATTERN: ${filters.pattern}` : ''}

EVENTS:
${events.map((e, i) => `${i}: "${e.title}" on ${e.startAt}`).join('\n')}

Return a JSON array of indices (numbers) for events that match. Example: [0, 3, 5]
Return only the JSON array, no explanation.`;

  const response = await llmProvider.complete([
    { role: 'system', content: 'You identify calendar events matching criteria. Return only a JSON array of indices.' },
    { role: 'user', content: prompt },
  ], { temperature: 0.1 });

  try {
    const indices = JSON.parse(response) as number[];
    return indices.map(i => events[i]).filter(Boolean);
  } catch {
    // Fallback: keyword matching
    return events.filter(e => 
      filters?.keywords?.some(k => e.title.toLowerCase().includes(k.toLowerCase()))
    );
  }
}
```

### 6. Tool Registration

In `mcp-server/src/tools/calendar-tools.ts`, add the batch update tool:

```typescript
{
  name: 'calendar.batchUpdate',
  description: 'Update multiple calendar events at once',
  schema: z.object({
    eventIds: z.array(z.string()).describe('Array of Google Calendar event IDs to update'),
    patch: z.object({
      allDay: z.boolean().optional().describe('Convert to all-day event'),
      title: z.string().optional().describe('New title'),
      location: z.string().optional().describe('New location'),
    }),
  }),
}
```

## Testing Checklist

- [ ] "what events look like meal placeholders?" → Returns analyze response
- [ ] "find meal events and make them all-day" → Returns confirmation card
- [ ] Confirm action → Events updated in Google Calendar
- [ ] Cancel action → No changes made
- [ ] Verify events appear at top of calendar day view after conversion
- [ ] Error handling when some events fail to update

## Edge Cases

1. **No matching events**: Return helpful message suggesting criteria adjustment
2. **Too many events**: Limit to 10 events per batch, ask user to narrow criteria
3. **Mixed results**: Some events update, some fail - report partial success
4. **Already all-day**: Skip events that are already all-day

## Future Enhancements

- Support for "move these events to next week"
- Support for "delete all events matching X"
- Support for "add [Person] to all these events"
- Natural language time changes: "move all morning meetings to 10am"
