# Stage 0: Agent System Scaffolding

> **Implemented**: 2026-02-04  
> **Status**: ✅ Complete (scaffolding only, placeholder agents)

---

## Overview

Stage 0 establishes the foundational architecture for the AI agent system:

1. **`@family/agent-core`** — Router, orchestrator, and specialist agent framework
2. **`@family/mcp-server`** — Tool registry with typed definitions (MCP-style)
3. **API Routes** — HTTP gateway for agent chat and tool invocation

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Web/Mobile)                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                    POST /agent/chat  or  POST /agent/mcp/invoke
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    apps/api (Fastify)                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  routes/agent/index.ts                                     │ │
│  │  - Auth (fastify.authenticate)                             │ │
│  │  - Request validation (Zod)                                │ │
│  │  - Logging with requestId                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
        │                                      │
        ▼                                      ▼
┌───────────────────────┐            ┌────────────────────────┐
│  @family/agent-core   │            │  @family/mcp-server    │
│  ┌─────────────────┐  │            │  ┌──────────────────┐  │
│  │ Router          │  │            │  │ Tool Registry    │  │
│  │ - routeIntent() │  │            │  │ - register()     │  │
│  └────────┬────────┘  │            │  │ - invoke()       │  │
│           │           │            │  └──────────────────┘  │
│           ▼           │            │           │            │
│  ┌─────────────────┐  │            │           ▼            │
│  │ Orchestrator    │  │            │  ┌──────────────────┐  │
│  │ - orchestrate() │──┼────────────┼─▶│ Tools            │  │
│  └────────┬────────┘  │            │  │ - system.ping    │  │
│           │           │            │  │ - system.listTools│ │
│           ▼           │            │  └──────────────────┘  │
│  ┌─────────────────┐  │            └────────────────────────┘
│  │ Agent Executors │  │
│  │ - tasks (stub)  │  │
│  │ - calendar (stub)│ │
│  │ - meals (stub)  │  │
│  │ - lists (stub)  │  │
│  └─────────────────┘  │
└───────────────────────┘
```

---

## API Endpoints

### POST /agent/chat

Main conversational endpoint for agent interactions.

**Request:**
```json
{
  "message": "Create a task to buy groceries tomorrow",
  "conversationId": "optional-uuid-for-context",
  "domainHint": "tasks"
}
```

**Response:**
```json
{
  "text": "I understand you want help with tasks. This feature is coming soon!",
  "actions": [],
  "payload": { "domain": "tasks", "status": "placeholder" },
  "domain": "tasks",
  "conversationId": "abc-123",
  "requestId": "def-456"
}
```

**Auth:** Bearer token required (Supabase JWT)

---

### POST /agent/mcp/invoke

Direct tool invocation endpoint (bypasses agent routing).

**Request:**
```json
{
  "toolName": "system.ping",
  "input": { "echo": "hello" }
}
```

**Response:**
```json
{
  "toolName": "system.ping",
  "requestId": "abc-123",
  "result": {
    "success": true,
    "data": {
      "ok": true,
      "time": "2026-02-04T10:30:00.000Z",
      "echo": "hello"
    },
    "executionMs": 1
  }
}
```

**Auth:** Bearer token required

---

### GET /agent/mcp/tools

List all registered tools.

**Response:**
```json
{
  "tools": [
    { "name": "system.ping", "description": "Health check tool that returns server time and status" },
    { "name": "system.listTools", "description": "List all registered tools with their descriptions" }
  ]
}
```

**Auth:** Bearer token required

---

## curl Examples

### Prerequisites

Get a valid Supabase access token (from browser DevTools or Supabase client):

```bash
export API_URL="http://localhost:3001"
export TOKEN="your-supabase-access-token"
```

### Chat with Agent

```bash
# Basic chat
curl -X POST "$API_URL/agent/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me my tasks for today"}'

# With domain hint
curl -X POST "$API_URL/agent/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "What events do I have?", "domainHint": "calendar"}'

# With conversation ID for context
curl -X POST "$API_URL/agent/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Add milk to the shopping list", "conversationId": "conv-123"}'
```

### Invoke MCP Tools

```bash
# Ping tool
curl -X POST "$API_URL/agent/mcp/invoke" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"toolName": "system.ping", "input": {"echo": "hello"}}'

# List all tools
curl -X POST "$API_URL/agent/mcp/invoke" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"toolName": "system.listTools", "input": {}}'

# List tools (GET endpoint)
curl -X GET "$API_URL/agent/mcp/tools" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Package Structure

### @family/agent-core

```
packages/agent-core/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── src/
    ├── index.ts          # Public exports
    ├── types.ts          # AgentRequest, AgentResponse, etc.
    ├── router.ts         # routeIntent() - keyword-based routing
    └── orchestrator.ts   # orchestrate() + agent executor registry
```

### @family/mcp-server

```
packages/mcp-server/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── src/
    ├── index.ts          # Public exports
    ├── types.ts          # ToolContext, ToolResult, ToolDefinition
    └── registry.ts       # toolRegistry + built-in tools
```

### apps/api routes

```
apps/api/src/routes/agent/
├── index.ts              # Route handlers
└── schema.ts             # Zod schemas for request/response
```

---

## Logging

All agent and tool operations include structured logging with correlation IDs:

```typescript
// Every log entry includes:
{
  requestId: "abc-123",      // Unique per request
  userId: "user-456",        // Authenticated user
  familyId: "family-789",    // User's family
  // ... operation-specific fields
}
```

**Log Levels:**
- `debug`: Detailed execution traces (routing decisions, tool inputs)
- `info`: Request start/end, significant events
- `warn`: Validation failures, non-fatal errors
- `error`: Exceptions, failed operations

---

## Next Steps (Stage 1+)

1. **TasksAgent Implementation**
   - Create task tools: `tasks.create`, `tasks.query`, `tasks.update`
   - Replace placeholder executor with real LLM-powered agent

2. **CalendarAgent Implementation**
   - Query Google Calendar events
   - Create events from natural language

3. **Conversation Memory**
   - Store conversation history
   - Multi-turn context handling

4. **LLM Integration**
   - Add OpenAI/Anthropic client
   - Tool calling with structured outputs

---

## Dependencies Added

```json
// apps/api/package.json
{
  "dependencies": {
    "@family/agent-core": "workspace:*",
    "@family/mcp-server": "workspace:*"
  }
}

// packages/agent-core/package.json
// packages/mcp-server/package.json
{
  "dependencies": {
    "zod": "^3.23.8"
  }
}
```

---

## Testing

After running `pnpm install` from the repo root:

```bash
# Start the API
pnpm dev:api

# In another terminal, test the endpoints
curl -X POST "http://localhost:3001/agent/mcp/invoke" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"toolName": "system.ping", "input": {}}'
```

Expected response:
```json
{
  "toolName": "system.ping",
  "requestId": "...",
  "result": {
    "success": true,
    "data": { "ok": true, "time": "2026-02-04T..." },
    "executionMs": 1
  }
}
```
