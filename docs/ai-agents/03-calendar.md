# Stage 2: CalendarAgent & Calendar MCP Tools

This document describes the calendar agent implementation for the family-app AI assistant.

## Overview

Stage 2 introduces the CalendarAgent, which handles natural language requests for family calendar events. The agent can:

- **Search** for events by text query, date range, or attendee
- **Create** new events with title, time, location, and attendees
- **Update/Reschedule** existing events (e.g., "move Hamish training to Thursday 6pm")

## Architecture

```
User Message
     │
     ▼
┌─────────────┐
│ Orchestrator │ ◀── Multi-intent detection
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│  Intent Router   │ ◀── calendar domain patterns
└────────┬─────────┘
         │
         ▼
┌─────────────────┐     ┌───────────────────┐
│ CalendarAgent   │────▶│ MCP Tools         │
│                 │     │ - calendar.search │
│ Intent parsing  │     │ - calendar.create │
│ Confirmation    │     │ - calendar.update │
└─────────────────┘     └────────┬──────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ Prisma Handlers │
                        │ (FamilyEvent)   │
                        └─────────────────┘
```

## Database Schema

New Prisma models added in migration `20260204220803_add_family_events`:

```prisma
model FamilyEvent {
  id              String    @id @default(cuid())
  familyId        String
  title           String
  startAt         DateTime
  endAt           DateTime
  location        String?
  notes           String?
  allDay          Boolean   @default(false)
  createdByUserId String
  deletedAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  family    Family                @relation(fields: [familyId], references: [id])
  attendees FamilyEventAttendee[]
}

model FamilyEventAttendee {
  id      String @id @default(cuid())
  eventId String
  userId  String
  status  String @default("pending")  // pending, accepted, declined

  event FamilyEvent @relation(fields: [eventId], references: [id])
}
```

## MCP Tools

### `calendar.search`

Search for calendar events with optional filters.

**Input:**
```typescript
{
  query?: string;        // Text search in title/notes
  from?: string;         // ISO datetime start of range
  to?: string;           // ISO datetime end of range
  attendeeUserId?: string; // Filter by attendee
  limit?: number;        // Max results (default 20, max 100)
}
```

**Output:**
```typescript
{
  events: CalendarEventOutput[];
  total: number;
}
```

### `calendar.create`

Create a new calendar event.

**Input:**
```typescript
{
  title: string;           // Required
  startAt: string;         // ISO datetime
  endAt: string;           // ISO datetime
  location?: string;
  notes?: string;
  allDay?: boolean;        // Default false
  attendeeUserIds?: string[];
}
```

**Output:**
```typescript
{
  event: CalendarEventOutput;
}
```

### `calendar.update`

Update an existing calendar event.

**Input:**
```typescript
{
  eventId: string;         // Required
  patch: {
    title?: string;
    startAt?: string;
    endAt?: string;
    location?: string;
    notes?: string;
    allDay?: boolean;
  }
}
```

**Output:**
```typescript
{
  event: CalendarEventOutput;
}
```

## Intent Parsing

The CalendarAgent uses rule-based parsing to extract intents from natural language:

### Create Patterns
- "Schedule team meeting tomorrow at 3pm"
- "Book dinner at Italian place for Friday 7pm"
- "Add Hamish's training to the calendar"
- "Create event: Parent-teacher meeting"

### Search Patterns
- "What's on my calendar this week?"
- "Show me events for tomorrow"
- "When is the dentist appointment?"
- "Find events with Mom"

### Update/Move Patterns
- "Move Hamish training to Thursday 6pm"
- "Reschedule the meeting to next Monday"
- "Change dinner reservation to 8pm"

## Confirmation Workflow

The CalendarAgent uses the same confirmation guardrail as TasksAgent:

1. **Read operations** (`calendar.search`) - No confirmation needed
2. **Write operations** (`calendar.create`, `calendar.update`) - Confirmation required if:
   - Confidence score < 0.85 (ambiguous intent)
   - Action is destructive (deletes data)

### Confirmation Flow

```
User: "Add dentist appointment next Tuesday"

Agent (low confidence): 
"I'll schedule 'dentist appointment' for Tuesday, Feb 11th. 
Please confirm to proceed, or say 'cancel' to abort."

Response includes:
{
  requiresConfirmation: true,
  pendingAction: {
    token: "pa_abc123...",
    description: "I'll schedule 'dentist appointment' for Tuesday, Feb 11th.",
    toolName: "calendar.create",
    inputPreview: { title: "dentist appointment", startAt: "2026-02-11T..." },
    expiresAt: "2026-02-04T23:30:00Z",
    isDestructive: false
  }
}

User confirms:
POST /agent/chat
{
  "message": "yes",
  "confirmationToken": "pa_abc123...",
  "confirmed": true
}

Agent executes and returns:
"✅ Scheduled 'dentist appointment' for Tue, Feb 11 at 12:00 PM"
```

## Multi-Intent Handling

The orchestrator detects messages with multiple intents:

```
User: "Add groceries to my tasks and schedule family dinner for Sunday 6pm"
```

Detection triggers when:
1. Message contains multi-intent indicators ("and also", "and then", "plus")
2. Multiple domains match significantly

The orchestrator executes both agents and merges responses:
- If any response requires confirmation, that one is prioritized
- Otherwise, responses are combined with separators

## File Structure

```
packages/agent-core/
├── src/
│   ├── agents/
│   │   ├── calendar-agent.ts    # CalendarAgent implementation
│   │   ├── tasks-agent.ts       # Existing
│   │   └── index.ts             # Exports both agents
│   ├── router.ts                # Intent routing + multi-intent detection
│   ├── orchestrator.ts          # Multi-intent handling
│   └── utils/
│       └── date-parser.ts       # parseDateRange() added

packages/mcp-server/
├── src/
│   └── tools/
│       ├── calendar-schemas.ts  # Zod schemas for calendar tools
│       ├── calendar-tools.ts    # Tool definitions
│       └── index.ts             # Exports

apps/api/
├── src/
│   ├── lib/
│   │   └── agent/
│   │       ├── calendar-handlers.ts  # Prisma handlers
│   │       └── index.ts              # Exports
│   └── routes/
│       └── agent/
│           └── index.ts         # Registers CalendarAgent executor
```

## Usage Examples

### Creating an Event

```bash
curl -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "message": "Schedule team standup tomorrow at 9:30am"
  }'
```

### Searching Events

```bash
curl -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "message": "What events do I have this week?"
  }'
```

### Rescheduling

```bash
curl -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "message": "Move Hamish training to Thursday 6pm"
  }'
```

## Testing

Run tests:

```bash
# All packages
pnpm test

# Just calendar-related
pnpm -F @family/agent-core test
pnpm -F @family/mcp-server test
pnpm -F api test
```

## Future Enhancements

- [ ] Recurring events support
- [ ] Google Calendar sync integration
- [ ] Conflict detection
- [ ] Smart scheduling suggestions
- [ ] Calendar sharing permissions
- [ ] Event reminders/notifications
