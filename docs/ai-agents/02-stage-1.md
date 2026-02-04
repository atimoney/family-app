# Stage 1: Tasks Vertical Slice

## Overview

Stage 1 implements the first end-to-end vertical slice: **Tasks**. This includes:
- MCP tool schemas for task CRUD operations
- Prisma-backed handlers with audit logging
- TasksAgent specialist with natural language understanding
- Comprehensive test coverage (64 tests)

## Components

### 1. Prisma Schema Addition

**Migration**: `20260204120505_add_agent_audit_log`

```prisma
model AgentAuditLog {
  id            String   @id @default(uuid())
  familyId      String
  userId        String
  requestId     String
  tool          String
  input         Json
  output        Json
  durationMs    Int
  createdAt     DateTime @default(now())

  family        Family   @relation(fields: [familyId], references: [id])
  @@index([familyId, createdAt])
  @@index([requestId])
}
```

### 2. Tool Schemas (`packages/mcp-server/src/tools/task-schemas.ts`)

Four task tools with Zod validation:

| Tool | Input Schema | Description |
|------|-------------|-------------|
| `tasks.list` | `status?`, `assignedToUserId?`, `limit?`, `offset?` | List tasks with optional filters |
| `tasks.create` | `title`, `dueDate?`, `priority?`, `assignedToUserId?`, `notes?` | Create a new task |
| `tasks.complete` | `taskId` | Mark a task as done |
| `tasks.assign` | `taskId`, `assignedToUserId` | Assign task to family member |

### 3. Tool Handlers (`apps/api/src/lib/agent/task-handlers.ts`)

Prisma-backed handlers with:
- Family-scoped queries (all operations filter by `familyId`)
- Assignee validation (ensures user belongs to family)
- Audit logging (every tool call logged to `AgentAuditLog`)
- Error handling with descriptive messages

```typescript
// Example: Create task handler
async function handleCreate(input: TasksCreateInput, context: TaskHandlerContext) {
  // Validate assignee if provided
  if (input.assignedToUserId) {
    const member = await prisma.familyMember.findFirst({
      where: { familyId: context.familyId, userId: input.assignedToUserId }
    });
    if (!member) return { success: false, error: 'Assignee not in family' };
  }
  
  const task = await prisma.task.create({
    data: {
      familyId: context.familyId,
      createdByUserId: context.familyMemberId,
      title: input.title,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      priority: input.priority,
      assignedToUserId: input.assignedToUserId,
      notes: input.notes,
    }
  });
  
  // Write audit log
  await writeAuditLog('tasks.create', input, { success: true, task }, context);
  return { success: true, task };
}
```

### 4. TasksAgent (`packages/agent-core/src/agents/tasks-agent.ts`)

Specialist executor that:
- Parses natural language messages
- Extracts intent (create, list, complete, assign, unclear)
- Extracts entities (title, date, assignee)
- Asks clarifying questions when confidence is low

```typescript
interface TasksAgentResult {
  text: string;           // Response to user
  actions: ToolCall[];    // Tool calls to execute
  payload?: unknown;      // Additional data
}
```

**Intent Detection Examples:**

| Message | Intent | Actions |
|---------|--------|---------|
| "Add a task to buy groceries tomorrow" | create | `tasks.create` with title, dueDate |
| "Show my tasks" | list | `tasks.list` |
| "Mark task abc-123 as done" | complete | `tasks.complete` with taskId |
| "Create a task for next week" | unclear | Asks "What day next week?" |

### 5. Date Parser (`packages/agent-core/src/utils/date-parser.ts`)

Natural language date parsing utility:

| Input | Output | Confident |
|-------|--------|-----------|
| "today" | Today's ISO date | ✅ |
| "tomorrow" | Tomorrow's ISO date | ✅ |
| "in 3 days" | Date +3 days | ✅ |
| "next Monday" | Next occurrence | ✅ |
| "next week" | null | ❌ (ambiguous) |
| "2025-03-15" | ISO date | ✅ |

## Test Coverage

### mcp-server (27 tests)
- `task-schemas.test.ts`: Schema validation for all 4 tools

### agent-core (26 tests)
- `date-parser.test.ts`: 17 tests for natural language dates
- `tasks-agent.test.ts`: 9 tests for intent parsing

### api (11 tests)
- `task-handlers.test.ts`: Handler logic with mocked Prisma

## File Structure

```
packages/
├── agent-core/
│   └── src/
│       ├── agents/
│       │   └── tasks-agent.ts          # TasksAgent specialist
│       └── utils/
│           └── date-parser.ts          # Natural language dates
├── mcp-server/
│   └── src/
│       └── tools/
│           ├── task-schemas.ts         # Zod schemas
│           └── task-tools.ts           # Tool definitions
apps/
└── api/
    ├── prisma/
    │   └── schema.prisma               # AgentAuditLog model
    └── src/
        └── lib/
            └── agent/
                └── task-handlers.ts    # Prisma handlers
```

## Usage Example

```typescript
import { TasksAgent } from '@family/agent-core';
import { executeTaskTool } from './task-handlers';

// 1. Parse user message
const agent = new TasksAgent();
const result = agent.execute({ message: "Add a task to call mom tomorrow" });

// 2. Execute tool calls
for (const action of result.actions) {
  const output = await executeTaskTool(action.tool, action.input, context);
  console.log(output);
}
```

## Next Steps (Stage 2)

1. **Events vertical slice** - Same pattern for calendar events
2. **LLM integration** - Replace deterministic parsing with GPT-4
3. **Router implementation** - Route messages to appropriate agents
4. **Streaming responses** - Real-time feedback during tool execution
