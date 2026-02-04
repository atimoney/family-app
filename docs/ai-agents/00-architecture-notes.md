# AI Agents Architecture Notes

> **Generated**: 2026-02-04  
> **Purpose**: Analysis of family-app monorepo for AI agent integration

---

## 1. Current-State Summary

### 1.1 Monorepo Structure

```
family-app/
├── apps/
│   ├── api/          # Fastify TS API server
│   └── web/          # Vite React TS frontend
├── packages/
│   └── shared/       # @family/shared - shared types & utilities
├── docs/             # Documentation
├── scripts/          # DB backup scripts
└── backups/          # Database backups
```

**Package Manager**: pnpm (v10.28.1) with workspace protocol  
**Workspace Config**: `pnpm-workspace.yaml` includes `apps/*` and `packages/*`

### 1.2 Database Schema (Prisma/PostgreSQL)

**Core Entities**:

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| `Profile` | User profile (keyed by Supabase `auth.users.id`) | → FamilyMember |
| `Family` | Family unit | → FamilyMember[], Tasks[], Lists[] |
| `FamilyMember` | User membership in a family | → Profile, Tasks |
| `Task` | Tasks with recurrence support | → Family, FamilyMember (assignee/creator), GoogleAccount |
| `TaskTemplate` | Quick-create task templates | → Family, FamilyMember (default assignee) |
| `List` | Generic list primitive (shopping, meal_plan, custom) | → Family, ListItem[] |
| `ListItem` | Items within a list | → List |
| `CalendarEvent` | Cached Google Calendar events | → GoogleAccount, SelectedCalendar |
| `GoogleAccount` | OAuth credentials per user | → Tasks, CalendarEvents |
| `EventCategory` | Custom event categories per family | → Family |

**Task Model Fields (important for AI):**
- `title`, `description`, `status` (todo/doing/done), `priority` (low/medium/high/urgent)
- `dueAt`, `completedAt`, `assignedToUserId`, `createdByUserId`
- `isRecurring`, `recurrenceRule` (JSON RRULE-like), `parentTaskId`, `recurrenceIndex`
- `linkedCalendarEventId`, `linkedCalendarId` (Google Calendar integration)
- `labels[]`, `sortOrder`
- Soft delete via `deletedAt`

**List Model Features:**
- `templateKey`: shopping | meal_plan | custom
- `config`: JSON schema for dynamic fields per list type
- `navVisibility`: pinned | visible | hidden

### 1.3 Authentication

**Provider**: Supabase Auth (hosted)

**API (Fastify)**:
- `plugins/auth.ts` - JWT verification using `jose` library
- Fetches JWKS from `SUPABASE_JWKS_URL` for ES256 verification
- Decorates `request.user` with `{ id: string, jwt: JWTPayload }`
- Routes use `preHandler: [fastify.authenticate]` for protected endpoints

**Web (React)**:
- Supabase client in `src/lib/supabase.ts`
- Auth context in `src/auth/context/supabase/auth-provider.tsx`
- Sets Bearer token on axios/fetch via `axios.defaults.headers.common.Authorization`
- Helper: `src/lib/auth-helpers.ts` provides `getAuthHeaders()`

**Environment Variables (API)**:
```
SUPABASE_JWKS_URL      # Required
SUPABASE_JWT_ISSUER    # Optional
SUPABASE_JWT_AUDIENCE  # Optional
```

### 1.4 API Route Structure

**Fastify Plugin Pattern**:
- Routes registered in `src/routes/index.ts`
- Each feature has its own directory with `index.ts` + `schema.ts` (Zod)
- Auth plugin registered per-route group: `await fastify.register(authPlugin)`

**Current Route Prefixes**:
| Prefix | Feature |
|--------|---------|
| `/health` | Health check |
| `/api/profile` | User profile |
| `/api/family` | Family CRUD + members |
| `/api/invites` | Family invitations |
| `/api/lists` | Lists (shopping, meal_plan, custom) |
| `/api/items` | List items |
| `/v1/tasks` | Tasks CRUD + bulk + recurring |
| `/v1/task-templates` | Task templates |
| `/v1/calendar` | Calendar events |
| `/v1/shopping` | Shopping (legacy?) |
| `/integrations/google` | Google OAuth + calendar sync |

**Typical Route Handler Pattern**:
```typescript
fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const userId = request.user?.id;
  if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
  
  const membership = await getUserFamilyMembership(userId);
  if (!membership) return reply.status(404).send({ error: 'No family found' });
  
  // ... business logic
});
```

### 1.5 Logging & Telemetry

**Current State**: Basic Fastify built-in logging only

- Pino logger via Fastify (JSON logs)
- Log level: `debug` in dev, `info` in prod (configurable via `LOG_LEVEL`)
- Pattern: `fastify.log.info/warn/error/debug({ ...context }, 'message')`
- No OpenTelemetry, no external telemetry services yet

**Logging Usage Examples**:
```typescript
fastify.log.info({ userId, calendarId }, 'Starting calendar sync');
fastify.log.warn({ err, userId }, 'Google token refresh failed');
logger?.error({ err, eventId: event.id }, 'Failed to process event');
```

### 1.6 Shared Package (`@family/shared`)

**Location**: `packages/shared/`

**Exports**:
- `types.ts` - Core domain types (Task, Family, Profile, etc.)
- `list-types.ts` - List primitive types and configs

**Usage Pattern**:
```typescript
import type { Task, TaskStatus } from '@family/shared';
import { getDefaultListConfig } from '@family/shared';
```

### 1.7 Web Frontend Patterns

**API Client**: `src/lib/api-client.ts`
- Typed fetch wrapper with error handling
- `ApiError` class for HTTP errors
- Base URL from `VITE_API_BASE_URL`

**Feature Organization** (tasks example):
```
src/features/tasks/
├── api.ts      # API calls (getTasks, createTask, etc.)
├── hooks/      # React Query hooks (useTasks, useTask, etc.)
├── types.ts    # Re-exports from @family/shared
└── index.ts    # Public exports
```

---

## 2. Recommended Locations for AI Agent Packages

### 2.1 Proposed Structure

```
family-app/
├── apps/
│   ├── api/                    # Existing Fastify API
│   │   └── src/
│   │       └── routes/
│   │           └── agents/     # NEW: Agent gateway routes
│   └── web/                    # Existing React app
│   └── mcp-server/             # NEW: MCP server (optional, future)
├── packages/
│   ├── shared/                 # Existing shared types
│   └── agent-core/             # NEW: Agent framework & tools
```

### 2.2 Package Descriptions

#### `packages/agent-core` (NEW)

**Purpose**: Core agent framework - tools, schemas, orchestration primitives

```
packages/agent-core/
├── package.json               # @family/agent-core
├── tsconfig.json
└── src/
    ├── index.ts               # Public exports
    ├── types.ts               # AgentResult, ToolCall, etc.
    ├── tools/                 # Tool definitions
    │   ├── index.ts
    │   ├── task-tools.ts      # createTask, updateTask, queryTasks
    │   ├── calendar-tools.ts  # queryEvents, createEvent
    │   └── list-tools.ts      # addListItem, queryListItems
    ├── agents/                # Agent definitions
    │   ├── index.ts
    │   ├── tasks-agent.ts     # TasksAgent
    │   └── base-agent.ts      # Abstract base
    ├── orchestrator/          # Multi-agent coordination
    │   ├── index.ts
    │   └── router.ts          # Intent routing
    └── schemas/               # Zod schemas for tool I/O
        └── index.ts
```

**Key Design Decisions**:
- Tools are pure functions that accept context (prisma, userId, familyId)
- Agents compose tools and define system prompts
- No LLM provider coupling in core - pass `llmClient` as parameter
- Shared with API routes AND potential future MCP server

#### `apps/api/src/routes/agents/` (NEW)

**Purpose**: HTTP gateway for agent interactions

```
apps/api/src/routes/agents/
├── index.ts           # Route registration
├── schema.ts          # Request/response Zod schemas
├── chat.ts            # POST /agents/chat - conversational endpoint
└── tools.ts           # POST /agents/tools/:toolName - direct tool calls (optional)
```

**Endpoint Design**:
```typescript
// POST /agents/chat
{
  "message": "Create a task to buy groceries tomorrow",
  "conversationId": "optional-for-context",
  "agentHint": "tasks" // optional routing hint
}

// Response
{
  "response": "I've created a task 'Buy groceries' due tomorrow.",
  "actions": [
    { "tool": "createTask", "result": { "id": "...", "title": "Buy groceries" } }
  ],
  "conversationId": "..."
}
```

#### `apps/mcp-server/` (FUTURE)

**Purpose**: Model Context Protocol server for external AI tool consumption

**When to Add**: When you want Claude Desktop, Cursor, or other MCP clients to interact with family-app data.

```
apps/mcp-server/
├── package.json        # @family/mcp-server
├── tsconfig.json
└── src/
    ├── index.ts        # MCP server entry
    └── handlers.ts     # MCP tool handlers (delegates to agent-core)
```

---

## 3. Naming Conventions & Boundaries

### 3.1 Terminology

| Term | Definition | Example |
|------|------------|---------|
| **Tool** | Single, atomic operation with defined input/output schema | `createTask`, `queryEvents` |
| **Agent** | Entity that interprets user intent and orchestrates tools | `TasksAgent`, `CalendarAgent` |
| **Orchestrator** | Routes requests to appropriate agent(s) | `AgentRouter` |
| **Gateway** | HTTP layer exposing agents to clients | `/agents/chat` route |

### 3.2 Naming Patterns

**Tools**:
- Verb + Noun: `createTask`, `updateTask`, `queryTasks`, `deleteTask`
- Query prefix for read operations: `queryTasks`, `queryEvents`
- Use singular nouns for single-item ops: `getTask`, `createTask`
- Use plural for bulk/query ops: `queryTasks`, `bulkUpdateTasks`

**Agents**:
- Suffix with `Agent`: `TasksAgent`, `CalendarAgent`, `ListsAgent`
- Domain-focused, not implementation-focused

**Files**:
- Tool files: `{domain}-tools.ts` (e.g., `task-tools.ts`)
- Agent files: `{domain}-agent.ts` (e.g., `tasks-agent.ts`)
- Kebab-case for filenames, PascalCase for classes

### 3.3 Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                      apps/web (React)                       │
│  - Calls /agents/chat endpoint                              │
│  - Renders agent responses in chat UI                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  apps/api (Fastify)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ routes/agents/  (Gateway)                            │   │
│  │  - Auth (reuse existing fastify.authenticate)        │   │
│  │  - Request validation                                │   │
│  │  - Rate limiting (future)                            │   │
│  │  - Conversation context management                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                              │                              │
│                              ▼                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ packages/agent-core                                  │   │
│  │  - Orchestrator: routes to agent                     │   │
│  │  - Agents: interpret intent, call tools              │   │
│  │  - Tools: execute operations (use Prisma client)     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Key Boundaries**:

1. **Gateway ↔ Agent-Core**: Gateway handles HTTP, auth, context. Agent-core is protocol-agnostic.
2. **Agent ↔ Tools**: Agents decide WHAT to do. Tools do the actual work.
3. **Agent-Core ↔ Prisma**: Tools receive `prisma` client as parameter (dependency injection).
4. **No LLM in agent-core**: LLM client passed in by gateway, making testing easier.

---

## 4. First Slice: TasksAgent MVP

### 4.1 Scope

**Goal**: Natural language task management for a single family user.

**Capabilities**:
- Create a task from natural language
- Query tasks (due today, this week, assigned to me, etc.)
- Update task status (mark complete)
- Simple intent recognition (no complex multi-turn)

**Out of Scope (MVP)**:
- Recurring task generation
- Calendar linking
- Multi-agent orchestration
- Conversation memory beyond single turn
- Streaming responses

### 4.2 Implementation Plan

#### Phase 1: Package Setup (Day 1)

1. Create `packages/agent-core/`
   ```bash
   mkdir -p packages/agent-core/src/{tools,agents,schemas}
   ```

2. Initialize package:
   ```json
   {
     "name": "@family/agent-core",
     "type": "module",
     "exports": { ".": { "types": "./src/index.ts", "import": "./dist/index.js" } }
   }
   ```

3. Add to workspace (automatic via `pnpm-workspace.yaml`)

4. Define core types:
   ```typescript
   // src/types.ts
   export type ToolContext = {
     prisma: PrismaClient;
     userId: string;
     familyId: string;
   };
   
   export type ToolResult<T> = {
     success: boolean;
     data?: T;
     error?: string;
   };
   
   export type AgentResult = {
     response: string;
     actions: ToolAction[];
   };
   ```

#### Phase 2: Task Tools (Day 1-2)

```typescript
// src/tools/task-tools.ts
export const taskTools = {
  createTask: {
    name: 'createTask',
    description: 'Create a new task for the family',
    schema: z.object({
      title: z.string(),
      description: z.string().optional(),
      dueAt: z.string().datetime().optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
      assignedToUserId: z.string().optional(),
    }),
    execute: async (ctx: ToolContext, input: CreateTaskInput): Promise<ToolResult<Task>> => {
      // ... implementation using ctx.prisma
    },
  },
  
  queryTasks: {
    name: 'queryTasks',
    description: 'Query tasks with filters',
    schema: z.object({
      status: z.array(z.enum(['todo', 'doing', 'done'])).optional(),
      dueBefore: z.string().datetime().optional(),
      dueAfter: z.string().datetime().optional(),
      assignedToUserId: z.string().optional(),
      limit: z.number().default(20),
    }),
    execute: async (ctx: ToolContext, input: QueryTasksInput): Promise<ToolResult<Task[]>> => {
      // ... implementation
    },
  },
  
  updateTaskStatus: {
    name: 'updateTaskStatus',
    description: 'Update a task status (e.g., mark as done)',
    schema: z.object({
      taskId: z.string(),
      status: z.enum(['todo', 'doing', 'done']),
    }),
    execute: async (ctx: ToolContext, input) => {
      // ... implementation
    },
  },
};
```

#### Phase 3: TasksAgent (Day 2-3)

```typescript
// src/agents/tasks-agent.ts
export class TasksAgent {
  private tools = taskTools;
  
  readonly systemPrompt = `You are a helpful family task assistant.
You help users manage their family tasks using available tools.
Today's date is {{today}}.
The user's timezone is {{timezone}}.

Available tools:
- createTask: Create a new task
- queryTasks: Find tasks matching criteria
- updateTaskStatus: Mark tasks as todo/doing/done

When creating tasks:
- Extract due dates from natural language ("tomorrow", "next Monday")
- Default priority is medium unless specified
- Ask for clarification only if the request is truly ambiguous`;

  async process(
    message: string,
    context: AgentContext
  ): Promise<AgentResult> {
    // 1. Format system prompt with context
    // 2. Call LLM with tool definitions
    // 3. Execute tool calls
    // 4. Format response
  }
}
```

#### Phase 4: Gateway Route (Day 3)

```typescript
// apps/api/src/routes/agents/index.ts
import { TasksAgent } from '@family/agent-core';

const agentsRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(authPlugin);
  
  fastify.post('/chat', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user?.id;
    const membership = await getUserFamilyMembership(userId);
    
    const { message } = request.body as { message: string };
    
    const agent = new TasksAgent();
    const result = await agent.process(message, {
      prisma: fastify.prisma,
      userId,
      familyId: membership.familyId,
      llmClient: /* inject LLM client */,
    });
    
    return result;
  });
};
```

#### Phase 5: Testing (Day 3-4)

**Unit Tests** (vitest):
- Tool execution with mock Prisma
- Date parsing (natural language → ISO)
- Schema validation

**Integration Tests**:
- Round-trip: message → agent → tool → response
- Error handling (invalid input, not found, etc.)

### 4.3 Success Criteria

- [ ] User can say "Create a task to buy milk tomorrow" → task created with correct due date
- [ ] User can say "What tasks do I have this week?" → list of tasks returned
- [ ] User can say "Mark the grocery task as done" → task status updated
- [ ] All tool calls logged with input/output for debugging
- [ ] Error responses are user-friendly, not stack traces

### 4.4 Future Iterations

| Iteration | Features |
|-----------|----------|
| MVP+1 | Conversation memory, multi-turn clarification |
| MVP+2 | CalendarAgent + orchestrator routing |
| MVP+3 | Streaming responses, proactive suggestions |
| MVP+4 | MCP server for external AI tools |

---

## Appendix: Environment Variables to Add

```bash
# For AI features (add to apps/api/.env)
OPENAI_API_KEY=sk-...            # or ANTHROPIC_API_KEY
AI_MODEL=gpt-4o                  # or claude-3-sonnet
AI_MAX_TOKENS=1024
AI_TEMPERATURE=0.7
```

---

## Appendix: Dependencies to Add

```bash
# packages/agent-core
pnpm --filter @family/agent-core add zod
pnpm --filter @family/agent-core add -D typescript @types/node vitest

# apps/api (for LLM client)
pnpm --filter @family/api add openai  # or @anthropic-ai/sdk
```
