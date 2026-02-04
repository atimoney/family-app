# Confirmation Guardrail Layer

## Overview

The confirmation layer provides a guardrail for write operations in the agent system. It ensures that potentially impactful or ambiguous actions require explicit user confirmation before execution.

## Design Principles

1. **Safe by Default**: Write operations with low confidence require confirmation
2. **No Secrets in Tokens**: Tokens are correlation IDs only, no embedded data
3. **Time-Bounded**: Pending actions expire after TTL (default 5 minutes)
4. **User-Scoped**: Actions are validated against the requesting user/family
5. **Minimal Friction**: High-confidence, non-destructive actions execute immediately

## When Confirmation is Required

An action requires confirmation if ANY of these conditions are true:

| Condition | Rationale |
|-----------|-----------|
| Confidence < 0.85 | Parser isn't certain about user intent |
| Destructive action (delete/remove) | Hard to undo, always confirm |

Read operations (list, get) never require confirmation.

## API Changes

### Request Schema

```typescript
// POST /agent/chat
{
  message: string;           // User's message (required unless confirming)
  conversationId?: string;   // For context continuity
  domainHint?: string;       // Route to specific domain
  confirmationToken?: string; // Token from pendingAction
  confirmed?: boolean;       // Must be true to execute pending action
}
```

### Response Schema

```typescript
{
  text: string;              // Agent response
  actions: AgentAction[];    // Executed actions
  payload?: object;          // Structured data
  domain: string;
  conversationId: string;
  requestId: string;
  requiresConfirmation?: boolean;  // NEW: true if awaiting confirmation
  pendingAction?: {                // NEW: present if requiresConfirmation
    token: string;                 // Confirmation token (pa_...)
    description: string;           // Human-readable action description
    toolName: string;              // Tool to be executed
    inputPreview: object;          // Sanitized preview of input
    expiresAt: string;             // ISO timestamp when token expires
    isDestructive: boolean;        // Whether action is destructive
  }
}
```

## Confirmation Flow

### 1. User Request (Low Confidence)

```
User: "I gotta call mom"
```

Agent detects `create` intent but with low confidence (0.65):

```json
{
  "text": "I'll create a task: \"call mom\" with medium priority.\n\nPlease confirm to proceed, or say \"cancel\" to abort.",
  "requiresConfirmation": true,
  "pendingAction": {
    "token": "pa_a1b2c3d4e5f6...",
    "description": "I'll create a task: \"call mom\" with medium priority.",
    "toolName": "tasks.create",
    "inputPreview": { "title": "call mom", "priority": "medium" },
    "expiresAt": "2026-02-05T14:05:00.000Z",
    "isDestructive": false
  }
}
```

### 2. User Confirms

```json
{
  "message": "yes",
  "confirmationToken": "pa_a1b2c3d4e5f6...",
  "confirmed": true
}
```

### 3. Action Executed

```json
{
  "text": "✅ Created task: \"call mom\"",
  "actions": [{
    "tool": "tasks.create",
    "input": { "title": "call mom", "priority": "medium" },
    "result": { "success": true, "data": { "task": { ... } } }
  }]
}
```

## Token Security

### Token Format

```
pa_<32 hex characters>
```

Example: `pa_a1b2c3d4e5f6789012345678901234ab`

### What's NOT in the Token

- No timestamps
- No user IDs
- No action details
- No signatures

The token is purely a lookup key. All validation happens server-side by matching:
- Token exists in store
- Token belongs to requesting user
- Token is for the same family context
- Token hasn't expired

### Validation Errors

| Error | Meaning |
|-------|---------|
| `not_found` | Token doesn't exist or already consumed |
| `expired` | TTL exceeded (5 minutes default) |
| `user_mismatch` | Different user trying to confirm |
| `family_mismatch` | Different family context |

## Confidence Scoring

The TasksAgent assigns confidence scores based on pattern matching:

| Pattern | Base Confidence |
|---------|-----------------|
| `create a task: X` | 0.95 |
| `task: X` | 0.90 |
| `remind: X` | 0.85 |
| `I need to X` | 0.75 |
| Implicit (contains "task") | 0.65 |

Confidence is reduced by:
- Uncertain date parsing: × 0.8
- Very short title (< 5 chars): × 0.7
- Contains question mark: × 0.5

Threshold for auto-execution: **0.85**

## Implementation Details

### PendingActionStore

In-memory store with automatic cleanup:

```typescript
import { pendingActionStore } from '@family/agent-core';

// Create a pending action
const action = pendingActionStore.create({
  userId: 'user-123',
  familyId: 'family-456',
  requestId: 'req-789',
  conversationId: 'conv-abc',
  toolCall: { toolName: 'tasks.create', input: { title: 'Buy milk' } },
  description: 'Create task: Buy milk',
  isDestructive: false,
  ttlMs: 5 * 60 * 1000, // optional, defaults to 5 min
});

// Consume (get and delete) on confirmation
const result = pendingActionStore.consume(token, userId, familyId);
if (result.found) {
  // Execute result.action.toolCall
}
```

### Production Considerations

For production, replace the in-memory store with:
- **Redis**: For multi-instance deployments
- **Database**: For audit trail and persistence

Key considerations:
- Set Redis TTL to match action TTL
- Use atomic operations (GET + DELETE)
- Consider rate limiting pending actions per user

## Helper Functions

```typescript
import { isWriteTool, isDestructiveTool, CONFIDENCE_THRESHOLD } from '@family/agent-core';

isWriteTool('tasks.create');     // true
isWriteTool('tasks.list');       // false
isDestructiveTool('tasks.delete'); // true
CONFIDENCE_THRESHOLD;            // 0.85
```

## Test Coverage

### Unit Tests (`confirmation.test.ts`)

- Token generation format
- Create/get/consume/delete operations
- User/family validation
- TTL expiration
- Cleanup behavior
- Write/destructive tool detection

### Integration Tests

The TasksAgent tests verify:
- High confidence creates execute immediately
- Low confidence creates return confirmation
- Confirmed actions execute correctly

## File Locations

| File | Purpose |
|------|---------|
| `packages/agent-core/src/confirmation.ts` | PendingActionStore and helpers |
| `packages/agent-core/src/types.ts` | `PendingActionInfo` type and schemas |
| `packages/agent-core/src/agents/tasks-agent.ts` | Confirmation integration |
| `apps/api/src/routes/agent/index.ts` | Confirmation API handling |

## Future Enhancements

1. **Batch Confirmations**: Confirm multiple pending actions at once
2. **Cancel Endpoint**: Explicit cancel instead of waiting for expiry
3. **Confirmation History**: Track confirmed/cancelled actions
4. **Per-Tool Thresholds**: Different confidence thresholds per tool
5. **User Preferences**: Let users opt out of confirmations for certain actions
