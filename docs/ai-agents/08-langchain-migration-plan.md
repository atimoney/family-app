# LangChain Migration Plan

> **Created**: 2026-02-08  
> **Status**: Planning  
> **Purpose**: Migrate from intent-based routing to LangChain ReAct agent pattern

---

## Executive Summary

The current agent architecture uses a **deterministic intent-based routing** system where:
1. LLM classifies user intent → returns a fixed intent type
2. Code executes a pre-defined flow for that intent type
3. Multi-turn context is manually stored and retrieved

This approach is **rigid** and requires adding new intent types (e.g., `analyzeFromContext`) for each new use case. A **LangChain/ReAct-style** architecture would give the LLM more autonomy to decide what tools to call and when, enabling more flexible and natural conversations.

---

## Current Architecture Analysis

### File Structure

```
packages/agent-core/src/
├── orchestrator.ts          # Main entry point, routes to specialist agents
├── router.ts                # LLM-based intent classification
├── conversation-context.ts  # In-memory context store with TTL
├── confirmation.ts          # Pending action confirmation system
├── types.ts                 # Core type definitions
├── llm/
│   ├── types.ts             # LLMProvider interface
│   ├── openai-provider.ts   # OpenAI implementation
│   └── mock-provider.ts     # Testing mock
└── agents/
    ├── calendar-agent.ts    # ~2400 lines - handles all calendar intents
    ├── tasks-agent.ts       # Task management agent
    └── meals-agent.ts       # Meal planning agent
```

### Current Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│ User Input  │────▶│    Router    │────▶│   Orchestrator  │────▶│  Specialist  │
│             │     │ (LLM classify│     │ (domain switch) │     │    Agent     │
└─────────────┘     │  → domain)   │     └─────────────────┘     │ (LLM intent) │
                    └──────────────┘                              └──────────────┘
                                                                         │
                                                                         ▼
                                                                  ┌──────────────┐
                                                                  │  Fixed Flow  │
                                                                  │  (switch on  │
                                                                  │  intent type)│
                                                                  └──────────────┘
```

### Key Components

#### 1. Router (`router.ts`)
- **Purpose**: Classify user message into domain (tasks, calendar, meals, lists)
- **Method**: Single LLM call with Zod schema validation
- **Output**: `IntentRoute { domain, confidence, reasons }`

#### 2. Orchestrator (`orchestrator.ts`)
- **Purpose**: Route to specialist agent, manage context, handle confirmations
- **Pattern**: Switch statement on domain, delegates to registered executors
- **Context**: Manual storage of `lastResults` for follow-up references

#### 3. Specialist Agents (e.g., `calendar-agent.ts`)
- **Pattern**: Large switch statement on intent types
- **Intent Types**: ~8 types (search, create, update, analyze, analyzeFromContext, etc.)
- **Problem**: Each new capability requires:
  - New Zod schema field
  - New intent type in union
  - New case in switch statement
  - Updated LLM prompt with examples

#### 4. Conversation Context (`conversation-context.ts`)
- **Storage**: In-memory Map with TTL (10 min default)
- **Content**: pendingEvent, pendingTask, lastResults, awaitingInput
- **Problem**: Manual context management, lost on server restart

### Current Pain Points

| Issue | Impact | Example |
|-------|--------|---------|
| **Rigid intent types** | Can't handle novel queries | "Which of these are recurring?" required new `analyzeFromContext` type |
| **Manual context** | Follow-up commands fail | "Change these to all-day" didn't know what "these" referred to |
| **Large agent files** | Hard to maintain | `calendar-agent.ts` is 2400+ lines |
| **Duplicate logic** | Each agent reimplements patterns | Intent parsing, tool execution, error handling |
| **No tool selection** | LLM can't choose tools | Code decides which tool based on intent type |

---

## Target Architecture: LangChain/LangGraph

### Proposed Flow

```
┌─────────────┐     ┌──────────────────────────────────────────────────┐
│ User Input  │────▶│              LangChain Agent                     │
│ + History   │     │                                                  │
└─────────────┘     │  ┌────────────┐   ┌────────────┐   ┌─────────┐  │
                    │  │   Think    │──▶│   Act      │──▶│ Observe │  │
                    │  │ (reasoning)│   │ (tool call)│   │ (result)│  │
                    │  └────────────┘   └────────────┘   └─────────┘  │
                    │        │                                  │      │
                    │        └──────────── Loop ────────────────┘      │
                    └──────────────────────────────────────────────────┘
                                          │
                                          ▼
                    ┌──────────────────────────────────────────────────┐
                    │                   Tools                          │
                    │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
                    │  │calendar│ │ tasks  │ │ meals  │ │ lists  │    │
                    │  │.search │ │.create │ │.suggest│ │.add    │    │
                    │  └────────┘ └────────┘ └────────┘ └────────┘    │
                    └──────────────────────────────────────────────────┘
```

### Key Differences

| Aspect | Current | LangChain |
|--------|---------|-----------|
| **Control flow** | Code decides (switch) | LLM decides (ReAct loop) |
| **Tool selection** | Implicit from intent | Explicit LLM choice |
| **Multi-step** | Pre-coded sequences | Dynamic chaining |
| **Context** | Manual storage | Built-in memory |
| **Errors** | Catch and return | Self-correction loop |

### Technology Choices

**Option A: LangChain.js**
- Pros: Mature, well-documented, large ecosystem
- Cons: Heavy dependency, some abstractions don't fit our needs
- Packages: `langchain`, `@langchain/openai`, `@langchain/community`

**Option B: LangGraph.js**
- Pros: More control, graph-based flows, checkpointing
- Cons: Newer, less documentation
- Packages: `@langchain/langgraph`

**Option C: Custom ReAct Implementation**
- Pros: Lightweight, full control, no dependencies
- Cons: More work, reinventing the wheel

**Recommendation**: Start with **LangChain.js** for the agent loop, with option to migrate to **LangGraph** for more complex workflows later.

---

## Migration Plan

### Phase 1: Foundation (Week 1-2)

**Goal**: Set up LangChain infrastructure without breaking existing agents

#### Tasks

1. **Add LangChain dependencies**
   ```bash
   pnpm add langchain @langchain/openai @langchain/core
   ```

2. **Create LangChain adapter for existing LLM provider**
   - Wrap `OpenAIProvider` in LangChain's `ChatOpenAI` interface
   - Or use LangChain's `ChatOpenAI` directly

3. **Define tools from existing handlers**
   - Convert each tool (calendar.search, calendar.create, etc.) to LangChain `Tool` format
   - Keep existing tool implementations, just wrap them

4. **Implement memory adapter**
   - Wrap `ConversationContextStore` in LangChain's `BufferMemory` or `ConversationSummaryMemory`
   - Eventually migrate to persistent storage (Redis/Postgres)

### Phase 2: Calendar Agent Migration (Week 3-4)

**Goal**: Migrate `calendar-agent.ts` to LangChain agent

#### Tasks

1. **Define calendar tools**
   ```typescript
   const calendarSearchTool = new DynamicTool({
     name: 'calendar_search',
     description: 'Search for calendar events. Use when user asks about their schedule.',
     func: async (input) => { /* existing search logic */ }
   });
   ```

2. **Create calendar agent**
   ```typescript
   const calendarAgent = await initializeAgentExecutorWithOptions(
     [calendarSearchTool, calendarCreateTool, calendarUpdateTool, ...],
     chatModel,
     { agentType: 'openai-tools', memory }
   );
   ```

3. **Remove intent parsing**
   - Delete the huge switch statement
   - Let LLM decide which tool to call

4. **Test with existing scenarios**
   - "What's on my calendar this week?"
   - "Find meal placeholders and make them all-day"
   - "Which of these are recurring?"

### Phase 3: Other Agents (Week 5-6)

**Goal**: Migrate tasks and meals agents

1. **Tasks Agent**
   - Tools: task.create, task.update, task.search, task.complete

2. **Meals Agent**  
   - Tools: meal.suggest, meal.plan, meal.getRecipe

3. **Shopping/Lists Agent**
   - Tools: list.add, list.remove, list.get

### Phase 4: Orchestrator Refactor (Week 7-8)

**Goal**: Replace domain router with unified agent or agent supervisor

#### Option A: Single Agent with All Tools
- One agent has access to all tools
- Simpler, works well for <20 tools
- May become unfocused with many tools

#### Option B: Agent Supervisor (LangGraph)
- Meta-agent routes to specialist agents
- More complex but scales better
- Better for domain separation

**Recommendation**: Start with Option A, refactor to Option B if tool count grows.

### Phase 5: Production Hardening (Week 9-10)

1. **Persistent memory**
   - Migrate from in-memory to Redis or Postgres
   - Add conversation history to database

2. **Streaming responses**
   - Use LangChain's streaming for real-time output
   - Update frontend to handle streaming

3. **Observability**
   - Add LangSmith or custom tracing
   - Log all tool calls and reasoning

4. **Cost optimization**
   - Cache common queries
   - Use cheaper models for routing
   - Implement token budgets

---

## Implementation Details

### Tool Definition Pattern

```typescript
// tools/calendar.ts
import { DynamicStructuredTool } from 'langchain/tools';
import { z } from 'zod';

export const calendarSearchTool = new DynamicStructuredTool({
  name: 'calendar_search',
  description: `Search for calendar events. Use this when the user asks:
- What's on my calendar?
- Am I free on [date]?
- What events do I have this week?
Returns a list of events with id, title, start time, and whether they are all-day.`,
  schema: z.object({
    query: z.string().optional().describe('Search term for event title'),
    startDate: z.string().optional().describe('Start of date range (ISO format)'),
    endDate: z.string().optional().describe('End of date range (ISO format)'),
    limit: z.number().optional().default(20).describe('Max events to return'),
  }),
  func: async ({ query, startDate, endDate, limit }, runManager) => {
    // Call existing tool handler
    const result = await toolExecutor('calendar.search', {
      query, from: startDate, to: endDate, limit
    });
    
    // Return stringified result for LLM to process
    return JSON.stringify(result.data);
  },
});
```

### Agent Creation Pattern

```typescript
// agents/calendar-langchain.ts
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { BufferMemory } from 'langchain/memory';

const systemPrompt = `You are a helpful family calendar assistant. 
You have access to tools to search, create, and modify calendar events.

When the user asks about events, use calendar_search to find them.
When they want to create an event, use calendar_create.
When they reference "these events" or "those", use the events from your previous tool call.

Always confirm with the user before making changes to their calendar.

Current date: {current_date}
User timezone: {timezone}`;

export async function createCalendarAgent(context: AgentRunContext) {
  const model = new ChatOpenAI({ 
    modelName: 'gpt-4o',
    temperature: 0.3,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    new MessagesPlaceholder('chat_history'),
    ['human', '{input}'],
    new MessagesPlaceholder('agent_scratchpad'),
  ]);

  const tools = [
    calendarSearchTool,
    calendarCreateTool,
    calendarUpdateTool,
    calendarDeleteTool,
    calendarAnalyzeTool,
  ];

  const agent = await createOpenAIToolsAgent({
    llm: model,
    tools,
    prompt,
  });

  return new AgentExecutor({
    agent,
    tools,
    memory: new BufferMemory({
      memoryKey: 'chat_history',
      returnMessages: true,
    }),
    verbose: true,
  });
}
```

### Memory Persistence Pattern

```typescript
// memory/postgres-memory.ts
import { BaseChatMessageHistory } from '@langchain/core/chat_history';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { prisma } from '../db';

export class PostgresChatHistory extends BaseChatMessageHistory {
  private conversationId: string;
  private userId: string;

  constructor(conversationId: string, userId: string) {
    super();
    this.conversationId = conversationId;
    this.userId = userId;
  }

  async getMessages(): Promise<BaseMessage[]> {
    const messages = await prisma.chatMessage.findMany({
      where: { conversationId: this.conversationId },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map((m) =>
      m.role === 'human' 
        ? new HumanMessage(m.content)
        : new AIMessage(m.content)
    );
  }

  async addMessage(message: BaseMessage): Promise<void> {
    await prisma.chatMessage.create({
      data: {
        conversationId: this.conversationId,
        userId: this.userId,
        role: message._getType(),
        content: message.content as string,
      },
    });
  }

  async clear(): Promise<void> {
    await prisma.chatMessage.deleteMany({
      where: { conversationId: this.conversationId },
    });
  }
}
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **LLM makes wrong tool calls** | Medium | High | Add confirmation for destructive actions, improve tool descriptions |
| **Increased latency** | High | Medium | Optimize prompts, use parallel tool calls, cache results |
| **Higher API costs** | High | Medium | Use cheaper models for simple tasks, implement token budgets |
| **Regression in existing features** | Medium | High | Comprehensive test suite, gradual rollout with feature flags |
| **Memory bloat** | Low | Medium | Implement conversation summarization, sliding window |

---

## Success Metrics

1. **Flexibility**: Can handle novel queries without code changes
2. **Accuracy**: Same or better task completion rate
3. **Latency**: P95 < 3s for single-turn, < 8s for multi-turn
4. **Cost**: < $0.05 per conversation turn on average
5. **Developer Experience**: New capabilities in hours, not days

---

## GitHub Copilot Prompts

Use these prompts in order to implement the migration:

### Phase 1: Foundation

```
1. Add LangChain dependencies to the agent-core package. We need langchain, @langchain/openai, and @langchain/core. Update package.json and install.

2. Create a new file packages/agent-core/src/langchain/chat-model.ts that wraps our existing OpenAI configuration in a LangChain ChatOpenAI model. Export a factory function createChatModel(config) that returns the configured model.

3. Create packages/agent-core/src/langchain/memory.ts that adapts our existing ConversationContextStore to LangChain's BufferMemory interface. It should read/write to our existing context store for backward compatibility.

4. Create packages/agent-core/src/langchain/tools/base.ts with a helper function wrapToolHandler(toolName, toolExecutor, schema, description) that converts our existing tool handlers to LangChain DynamicStructuredTool format.
```

### Phase 2: Calendar Tools

```
5. Create packages/agent-core/src/langchain/tools/calendar.ts with LangChain tool definitions for: calendar_search, calendar_create, calendar_update, calendar_delete. Use the wrapToolHandler helper from the previous step. Each tool should have a detailed description explaining when to use it.

6. Create packages/agent-core/src/langchain/tools/calendar.ts - add a calendar_analyze tool that takes a question and a list of event IDs, fetches those events, and uses LLM to answer the question. This replaces our analyzeFromContext intent.

7. Create packages/agent-core/src/langchain/agents/calendar-agent.ts that creates a LangChain AgentExecutor with the calendar tools. Use createOpenAIToolsAgent with a system prompt that explains the assistant's role and available tools. Include chat_history for conversation memory.
```

### Phase 3: Integration

```
8. Update packages/agent-core/src/orchestrator.ts to optionally use the new LangChain calendar agent. Add an environment variable LANGCHAIN_ENABLED=true to toggle between old and new implementations. When enabled, route calendar domain to the LangChain agent instead of the old executeCalendarAgent.

9. Add integration tests in packages/agent-core/src/langchain/__tests__/calendar-agent.test.ts that verify: (a) simple search queries work, (b) multi-turn conversations maintain context, (c) follow-up references like "these events" resolve correctly.

10. Create packages/agent-core/src/langchain/tools/tasks.ts with LangChain tool definitions for: task_create, task_update, task_complete, task_search, task_list. Follow the same pattern as calendar tools.
```

### Phase 4: Full Migration

```
11. Create packages/agent-core/src/langchain/agents/unified-agent.ts that combines all domain tools (calendar, tasks, meals, lists) into a single agent. The system prompt should explain all available capabilities. This replaces the router+orchestrator pattern.

12. Update the API endpoint in apps/api/src/routes/agent/index.ts to use the unified LangChain agent. Remove the domain routing logic. The single agent should handle all user requests.

13. Implement streaming responses: Update the LangChain agent to use streamEvents() and modify the API endpoint to return a Server-Sent Events stream. Update the frontend ChatView to consume the stream and show partial responses.

14. Add LangSmith tracing: Configure LANGCHAIN_TRACING_V2=true and LANGCHAIN_API_KEY in environment. Add project name LANGCHAIN_PROJECT=family-app. Verify traces appear in LangSmith dashboard.

15. Implement persistent memory: Create a Prisma model ChatMessage with fields (id, conversationId, userId, role, content, toolCalls, createdAt). Update the LangChain memory adapter to use Postgres instead of in-memory storage.
```

### Phase 5: Optimization

```
16. Add conversation summarization: When chat history exceeds 10 messages, use LLM to summarize older messages into a system context. Store the summary and only keep recent messages in active memory.

17. Implement tool result caching: Create a cache layer that stores tool results keyed by (toolName, normalizedInput, ttl). Calendar searches and task lists should cache for 60 seconds. 

18. Add cost tracking: Create middleware that logs token usage per request. Store in a CostLog table with (userId, requestId, inputTokens, outputTokens, model, cost, createdAt). Add an admin endpoint to view cost summaries.

19. Create a fallback system: If the LangChain agent fails or times out after 30 seconds, fall back to the old intent-based system. Log fallback events for analysis.

20. Performance optimization: Profile the agent and identify slow paths. Consider using gpt-4o-mini for tool selection and gpt-4o only for complex reasoning. Implement parallel tool execution where possible.
```

---

## Appendix: Current Intent Types

For reference, these are the intent types that would be replaced by LangChain tools:

### Calendar Agent
- `search` → `calendar_search` tool
- `create` → `calendar_create` tool  
- `update` → `calendar_update` tool
- `delete` → `calendar_delete` tool
- `analyze` → `calendar_search` + LLM reasoning
- `analyzeFromContext` → LLM uses previous tool results (automatic with memory)
- `analyzeAndUpdate` → `calendar_search` + `calendar_update` (agent chains)
- `updateFromContext` → `calendar_update` with IDs from memory

### Tasks Agent
- `create` → `task_create` tool
- `update` → `task_update` tool
- `complete` → `task_complete` tool
- `search` → `task_search` tool
- `list` → `task_list` tool

### Meals Agent
- `suggest` → `meal_suggest` tool
- `plan` → `meal_plan` tool
- `getRecipe` → `meal_get_recipe` tool
