# Chat UI Design Document

## Overview

This document describes the front-end implementation of the AI Agent chat interface for the Family App. The UI provides a conversational interface for users to interact with the AI agent for task management, calendar operations, meal planning, and other family-related activities.

## UI/UX Pattern

### Reference Components (from Minimals Template)

The chat UI is inspired by the Minimals Chat components located in:

- [minimal-full/src/sections/chat/chat-message-list.tsx](../../minimal-full/src/sections/chat/chat-message-list.tsx) - Message list with auto-scroll
- [minimal-full/src/sections/chat/chat-message-item.tsx](../../minimal-full/src/sections/chat/chat-message-item.tsx) - Individual message bubbles with avatars
- [minimal-full/src/sections/chat/chat-message-input.tsx](../../minimal-full/src/sections/chat/chat-message-input.tsx) - Composer input with send functionality
- [minimal-full/src/sections/chat/hooks/use-messages-scroll.ts](../../minimal-full/src/sections/chat/hooks/use-messages-scroll.ts) - Auto-scroll behavior
- [minimal-full/src/sections/chat/layout.tsx](../../minimal-full/src/sections/chat/layout.tsx) - Chat layout structure

Key adaptations for AI agent chat:
- **Single conversation model** (MVP) - no conversation list sidebar
- **Simplified message types**: user messages, assistant messages, confirmation cards
- **No participant system** - only user and AI assistant
- **Confirmation flow** integrated into message list

### Route & Layout

- **Route**: `/assistant`
- **Layout**: Uses existing `DashboardLayout` with `DashboardContent`
- **Page component**: `apps/web/src/pages/assistant/index.tsx`
- **View component**: `apps/web/src/sections/assistant/view/assistant-view.tsx`

### Page Structure

```
┌──────────────────────────────────────────────────────────────┐
│  Header: "AI Assistant"                                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │  Message List (scrollable)                             │  │
│  │  ├── User message bubble (right aligned)               │  │
│  │  ├── Assistant message bubble (left aligned)           │  │
│  │  ├── Confirmation card (special assistant message)     │  │
│  │  └── ... more messages                                 │  │
│  │                                                        │  │
│  │  Empty state / typing indicator                        │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Quick Actions: [Create task] [List tasks] [Today]...  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Composer: [multiline input] [Send]                    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Data Model

### Message Types

```typescript
/** Message roles in the conversation */
export type MessageRole = 'user' | 'assistant' | 'system';

/** Message status for optimistic updates and error handling */
export type MessageStatus = 'sending' | 'sent' | 'error';

/** A single chat message */
export type ChatMessage = {
  id: string;                    // Unique message ID
  role: MessageRole;             // Who sent the message
  content: string;               // Message text
  timestamp: string;             // ISO timestamp
  status: MessageStatus;         // For UI state (sending, sent, error)
  
  // Optional fields for assistant messages
  domain?: AgentDomain;          // tasks, calendar, meals, etc.
  actions?: AgentAction[];       // Executed tool actions
  payload?: Record<string, unknown>; // Structured data
  
  // Confirmation-specific fields
  requiresConfirmation?: boolean;
  pendingAction?: PendingActionInfo;
};

/** Conversation state */
export type Conversation = {
  id: string;                    // UUID for conversation continuity
  messages: ChatMessage[];       // All messages in order
  createdAt: string;            // When conversation started
  updatedAt: string;            // Last activity
};
```

### API Types (from backend)

Types are imported from `@family/agent-core` (see [packages/agent-core/src/types.ts](../../packages/agent-core/src/types.ts)):

```typescript
// Request to POST /agent/chat
export type AgentRequest = {
  message: string;
  conversationId?: string;
  domainHint?: AgentDomain;
  confirmationToken?: string;
  confirmed?: boolean;
  timezone?: string;
};

// Response from POST /agent/chat
export type AgentResponse = {
  text: string;
  actions: AgentAction[];
  payload?: Record<string, unknown>;
  domain: AgentDomain;
  conversationId: string;
  requestId: string;
  requiresConfirmation?: boolean;
  pendingAction?: PendingActionInfo;
};

// Pending action details
export type PendingActionInfo = {
  token: string;
  description: string;
  toolName: string;
  inputPreview: Record<string, unknown>;
  expiresAt: string;
  isDestructive: boolean;
};
```

## Confirmation Flow UX

### When Confirmation is Needed

The backend returns `requiresConfirmation: true` when:
1. Confidence is below threshold (< 0.85)
2. Operation is destructive (delete/remove)

### Confirmation Card Design

When a message has `requiresConfirmation: true`, render a special card:

```
┌─────────────────────────────────────────────────┐
│  🤖 Assistant                                    │
│                                                 │
│  "I'll create a task: call mom with medium      │
│   priority."                                    │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │  ⚡ Action Required                       │  │
│  │                                           │  │
│  │  Tool: tasks.create                       │  │
│  │  Title: call mom                          │  │
│  │  Priority: medium                         │  │
│  │                                           │  │
│  │  [Confirm]  [Cancel]                      │  │
│  │                                           │  │
│  │  ⏱️ Expires in 5 minutes                  │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### User Actions

- **Confirm**: Sends `{ confirmationToken, confirmed: true }` to `/agent/chat`
- **Cancel**: Dismisses the card, optionally sends a "cancelled" message

### Expiration Handling

- Show countdown or "Expires at HH:MM"
- Disable Confirm button when expired
- Show "Expired" state with option to retry the original request

## Empty State & Quick Actions

### Empty State (no messages)

```
┌─────────────────────────────────────────────────┐
│                                                 │
│     🤖                                          │
│                                                 │
│     Hi! I'm your family assistant.              │
│     How can I help you today?                   │
│                                                 │
│     Try asking me to:                           │
│     • "Create a task to buy groceries"          │
│     • "What's on the calendar today?"           │
│     • "Plan meals for this week"                │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Quick Action Chips

Displayed above the composer:

- **Create task** → "Create a new task"
- **List tasks** → "Show my pending tasks"
- **Today's events** → "What's on today?"
- **Plan meals** → "Help me plan meals for this week"

Clicking a chip inserts the prompt text and auto-submits.

## Loading & Error States

### Loading (waiting for response)

- Show typing indicator (animated dots) below last message
- Disable send button
- Allow user to scroll up (preserve scroll position)

### Error Handling

1. **Network error**: Show error message in chat with retry button
2. **Validation error**: Display error details, allow resubmission
3. **Rate limit**: Show "slow down" message with countdown

### Streaming (Future Enhancement)

- Currently: wait for full response
- Future: Support SSE/WebSocket for streaming responses
- Placeholder: typing indicator serves as streaming stand-in

## Scroll Behavior

Based on Minimals `useMessagesScroll` hook:

1. **Auto-scroll to bottom** on new messages
2. **Preserve position** if user has scrolled up
3. **"New messages" button** when user is scrolled up and new messages arrive

## Persistence (MVP)

### LocalStorage Approach

For MVP, conversations are stored in localStorage:

```typescript
const STORAGE_KEY = 'family-assistant-conversation';

// On app load: restore conversation
// On each message: save to localStorage
// On "new conversation": clear and generate new ID
```

### Future: Backend Persistence

When backend conversation storage is implemented:
- Fetch conversation history on load
- Sync messages to backend
- Support multiple conversations

## Component Structure

```
apps/web/src/
├── features/
│   └── assistant/
│       ├── api.ts              # API client for /agent/chat
│       ├── types.ts            # ChatMessage, Conversation types
│       └── hooks/
│           └── use-agent-chat.ts # Main state management hook
├── pages/
│   └── assistant/
│       └── index.tsx           # Route entry point
├── routes/
│   └── sections/
│       └── assistant.tsx       # Route configuration
└── sections/
    └── assistant/
        ├── view/
        │   └── assistant-view.tsx    # Main view component
        ├── assistant-message-list.tsx
        ├── assistant-message-item.tsx
        ├── assistant-message-input.tsx
        ├── assistant-confirmation-card.tsx
        ├── assistant-quick-actions.tsx
        ├── assistant-empty-state.tsx
        └── assistant-typing-indicator.tsx
```

## Dev-Only Debug Panel

In development mode (`import.meta.env.DEV`), show collapsible debug info per assistant message:

```
┌─────────────────────────────────────────────────┐
│  🤖 Task created successfully!                  │
│                                                 │
│  [▼ Debug Info]                                 │
│  ┌───────────────────────────────────────────┐  │
│  │ Domain: tasks                             │  │
│  │ RequestId: abc-123-def                    │  │
│  │ Actions:                                  │  │
│  │ - tasks.create → success (45ms)           │  │
│  │   Input: { title: "...", ... }            │  │
│  │   Result: { task: { id: "...", ... } }    │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## API Integration

### Endpoint

```
POST /agent/chat
Authorization: Bearer <supabase-jwt>
Content-Type: application/json
```

### Request Examples

**Regular message:**
```json
{
  "message": "Create a task to buy milk",
  "conversationId": "conv-uuid-123"
}
```

**Confirmation:**
```json
{
  "message": "",
  "conversationId": "conv-uuid-123",
  "confirmationToken": "pa_abc123...",
  "confirmed": true
}
```

### Using Existing API Client

```typescript
import { apiClient, endpoints } from 'src/lib/api-client';

// Add to endpoints:
endpoints.agent = {
  chat: '/agent/chat',
};

// Usage:
const response = await apiClient.post<AgentResponse>(endpoints.agent.chat, request);
```

## Testing Strategy

### Unit Tests

- `useAgentChat` hook: message sending, confirmation flow, error handling
- `AssistantConfirmationCard`: render states, button actions, expiration

### Integration Tests

- Full send flow with mocked API
- Confirmation flow end-to-end
- LocalStorage persistence

### Manual Testing Checklist

- [ ] Send message and receive response
- [ ] Confirmation card appears for low-confidence actions
- [ ] Confirm button executes action
- [ ] Cancel button dismisses card
- [ ] Expired confirmation shows correct state
- [ ] Quick actions work
- [ ] Scroll behavior is correct
- [ ] Error states display properly
- [ ] Conversation persists across refresh

## Implementation Priority

1. **Phase 1**: Basic chat with message list and input
2. **Phase 2**: Confirmation flow (cards, confirm/cancel)
3. **Phase 3**: Quick actions and empty state
4. **Phase 4**: Debug panel and polish
5. **Phase 5**: Tests

---

*Last updated: 2026-02-05*
