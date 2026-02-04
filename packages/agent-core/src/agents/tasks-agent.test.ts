import { describe, it, expect, vi } from 'vitest';
import { executeTasksAgent } from './tasks-agent.js';
import type { AgentRunContext, ToolResult } from '../types.js';

// Mock context factory
function createMockContext(overrides?: Partial<AgentRunContext>): AgentRunContext {
  return {
    userId: 'user-123',
    familyId: 'family-456',
    familyMemberId: 'member-789',
    requestId: 'req-789',
    conversationId: 'conv-123',
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    ...overrides,
  };
}

// Mock tool executor
function createMockToolExecutor(responses: Record<string, ToolResult>) {
  return vi.fn(async (toolName: string, _input: unknown) => {
    return responses[toolName] ?? { success: false, error: 'Unknown tool' };
  });
}

describe('executeTasksAgent', () => {
  describe('intent detection', () => {
    it('should detect "create" intent from "create a task:" message', async () => {
      const context = createMockContext();
      const toolExecutor = createMockToolExecutor({
        'tasks.create': {
          success: true,
          data: {
            task: {
              id: 'task-1',
              title: 'buy groceries',
              status: 'todo',
              priority: 'medium',
              createdAt: '2025-02-04T10:00:00Z',
            },
          },
        },
      });

      const result = await executeTasksAgent(
        'create a task: buy groceries',
        context,
        toolExecutor
      );

      expect(toolExecutor).toHaveBeenCalledWith('tasks.create', expect.objectContaining({
        title: expect.stringContaining('groceries'),
      }));
      expect(result.text).toContain('groceries');
    });

    it('should detect "list" intent from "show my tasks" message', async () => {
      const context = createMockContext();
      const toolExecutor = createMockToolExecutor({
        'tasks.list': {
          success: true,
          data: {
            items: [
              {
                id: 'task-1',
                title: 'Buy groceries',
                status: 'todo',
                priority: 'medium',
                createdAt: '2025-02-04T10:00:00Z',
              },
            ],
            total: 1,
          },
        },
      });

      const result = await executeTasksAgent(
        'show my tasks',
        context,
        toolExecutor
      );

      expect(toolExecutor).toHaveBeenCalledWith('tasks.list', expect.any(Object));
      expect(result.text.toLowerCase()).toContain('task');
    });

    it('should detect "complete" intent from "complete: task" message', async () => {
      const context = createMockContext();
      const toolExecutor = createMockToolExecutor({
        'tasks.list': {
          success: true,
          data: {
            items: [
              {
                id: 'task-123',
                title: 'Buy groceries',
                status: 'todo',
                priority: 'medium',
                createdAt: '2025-02-04T10:00:00Z',
              },
            ],
            total: 1,
          },
        },
        'tasks.complete': {
          success: true,
          data: {
            task: {
              id: 'task-123',
              title: 'Buy groceries',
              status: 'done',
              priority: 'medium',
              completedAt: '2025-02-04T14:00:00Z',
              createdAt: '2025-02-04T10:00:00Z',
            },
          },
        },
      });

      const result = await executeTasksAgent(
        'complete: Buy groceries',
        context,
        toolExecutor
      );

      // The handler first lists tasks to find by title, then completes
      expect(toolExecutor).toHaveBeenCalled();
      expect(result.actions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('date extraction', () => {
    it('should extract "tomorrow" for due date in create intent', async () => {
      const context = createMockContext();
      const toolExecutor = createMockToolExecutor({
        'tasks.create': {
          success: true,
          data: {
            task: {
              id: 'task-1',
              title: 'call mom',
              status: 'todo',
              priority: 'medium',
              dueAt: '2025-02-05T23:59:00.000Z',
              createdAt: '2025-02-04T10:00:00Z',
            },
          },
        },
      });

      await executeTasksAgent(
        'create a task: call mom tomorrow',
        context,
        toolExecutor
      );

      expect(toolExecutor).toHaveBeenCalledWith('tasks.create', expect.objectContaining({
        dueAt: expect.any(String),
      }));
    });

    it('should ask for clarification on ambiguous dates', async () => {
      const context = createMockContext();
      const toolExecutor = createMockToolExecutor({});

      const result = await executeTasksAgent(
        'create a task: finish report next week',
        context,
        toolExecutor
      );

      // "next week" is ambiguous - should ask for clarification
      expect(result.text.toLowerCase()).toMatch(/when|date|due|specify/);
      expect(result.payload?.awaitingInput).toBe('dueDate');
    });
  });

  describe('error handling', () => {
    it('should handle tool execution failure gracefully', async () => {
      const context = createMockContext();
      const toolExecutor = createMockToolExecutor({
        'tasks.create': {
          success: false,
          error: 'Database connection failed',
        },
      });

      const result = await executeTasksAgent(
        'create a task: test error handling',
        context,
        toolExecutor
      );

      expect(result.text.toLowerCase()).toMatch(/sorry|couldn't|error|failed/);
    });

    it('should handle unknown intent with helpful message', async () => {
      const context = createMockContext();
      const toolExecutor = createMockToolExecutor({});

      const result = await executeTasksAgent(
        'What is the meaning of life?',
        context,
        toolExecutor
      );

      // Should return unclear intent message
      expect(result.text).toContain('not sure');
      expect(result.actions.length).toBe(0);
    });
  });

  describe('response formatting', () => {
    it('should include action in response for successful tool calls', async () => {
      const context = createMockContext();
      const toolExecutor = createMockToolExecutor({
        'tasks.create': {
          success: true,
          data: {
            task: {
              id: 'task-1',
              title: 'Test task',
              status: 'todo',
              priority: 'medium',
              createdAt: '2025-02-04T10:00:00Z',
            },
          },
        },
      });

      const result = await executeTasksAgent(
        'add task: Test task',
        context,
        toolExecutor
      );

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].tool).toBe('tasks.create');
      expect(result.actions[0].result.success).toBe(true);
    });

    it('should format task list as readable text', async () => {
      const context = createMockContext();
      const toolExecutor = createMockToolExecutor({
        'tasks.list': {
          success: true,
          data: {
            items: [
              {
                id: 'task-1',
                title: 'Buy groceries',
                status: 'todo',
                priority: 'high',
                dueAt: '2025-02-05T10:00:00Z',
                createdAt: '2025-02-04T10:00:00Z',
              },
              {
                id: 'task-2',
                title: 'Clean house',
                status: 'doing',
                priority: 'medium',
                createdAt: '2025-02-04T09:00:00Z',
              },
            ],
            total: 2,
          },
        },
      });

      const result = await executeTasksAgent(
        'list my tasks',
        context,
        toolExecutor
      );

      expect(result.text).toContain('Buy groceries');
      expect(result.text).toContain('Clean house');
    });
  });
});
