import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTaskToolHandlers } from './task-handlers.js';
import type { PrismaClient } from '@prisma/client';

// Mock Prisma client factory with all needed methods
function createMockPrisma() {
  return {
    task: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    familyMember: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
    },
    agentAuditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaClient;
}

// Mock context factory
function createMockContext() {
  return {
    userId: 'user-123',
    familyId: 'family-456',
    familyMemberId: 'member-123',
    requestId: 'req-789',
    roles: ['member'],
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}

describe('task-handlers', () => {
  let handlers: ReturnType<typeof createTaskToolHandlers>;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    handlers = createTaskToolHandlers({ prisma: mockPrisma });
  });

  describe('list', () => {
    it('should list tasks for the family', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          familyId: 'family-456',
          title: 'Buy groceries',
          description: null,
          status: 'todo',
          priority: 'medium',
          dueAt: null,
          completedAt: null,
          assignedToUserId: null,
          createdByUserId: 'user-123',
          labels: [],
          createdAt: new Date('2025-02-04T10:00:00Z'),
          updatedAt: new Date('2025-02-04T10:00:00Z'),
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(mockPrisma.task.findMany).mockResolvedValue(mockTasks as any);
      vi.mocked(mockPrisma.task.count).mockResolvedValue(1);

      const context = createMockContext();
      const result = await handlers.list({ status: 'open', limit: 20 }, context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.items).toHaveLength(1);
      expect(result.data?.total).toBe(1);
    });

    it('should filter by status', async () => {
      vi.mocked(mockPrisma.task.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.task.count).mockResolvedValue(0);

      const context = createMockContext();
      await handlers.list({ status: 'done', limit: 20 }, context);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'done',
          }),
        })
      );
    });

    it('should filter by assignee', async () => {
      vi.mocked(mockPrisma.task.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.task.count).mockResolvedValue(0);

      const context = createMockContext();
      await handlers.list({ limit: 20, assignedToUserId: 'user-999' }, context);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignedToUserId: 'user-999',
          }),
        })
      );
    });

    it('should write audit log', async () => {
      vi.mocked(mockPrisma.task.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.task.count).mockResolvedValue(0);

      const context = createMockContext();
      await handlers.list({ status: 'open', limit: 20 }, context);

      expect(mockPrisma.agentAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toolName: 'tasks.list',
            success: true,
            requestId: 'req-789',
          }),
        })
      );
    });
  });

  describe('create', () => {
    it('should create a new task', async () => {
      const mockCreatedTask = {
        id: 'task-new',
        familyId: 'family-456',
        title: 'New task',
        description: 'Description',
        status: 'todo',
        priority: 'high',
        dueAt: new Date('2025-02-10T10:00:00Z'),
        completedAt: null,
        assignedToUserId: null,
        createdByUserId: 'user-123',
        labels: [],
        createdAt: new Date('2025-02-04T10:00:00Z'),
        updatedAt: new Date('2025-02-04T10:00:00Z'),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(mockPrisma.task.create).mockResolvedValue(mockCreatedTask as any);

      const context = createMockContext();
      const result = await handlers.create(
        {
          title: 'New task',
          notes: 'Description',
          priority: 'high',
          dueAt: '2025-02-10T10:00:00Z',
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.data?.task.title).toBe('New task');
      expect(mockPrisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            familyId: 'family-456',
            createdByUserId: 'member-123',
            title: 'New task',
            priority: 'high',
          }),
        })
      );
    });

    it('should validate assignee belongs to family', async () => {
      vi.mocked(mockPrisma.familyMember.findFirst).mockResolvedValue(null);

      const context = createMockContext();
      const result = await handlers.create(
        {
          title: 'Task with invalid assignee',
          priority: 'medium',
          assignedToUserId: 'non-family-user',
        },
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not a member');
    });

    it('should allow valid family member as assignee', async () => {
      vi.mocked(mockPrisma.familyMember.findFirst).mockResolvedValue({
        id: 'member-1',
        familyId: 'family-456',
        userId: 'valid-user',
        role: 'member',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const mockCreatedTask = {
        id: 'task-new',
        familyId: 'family-456',
        title: 'Assigned task',
        description: null,
        status: 'todo',
        priority: 'medium',
        dueAt: null,
        completedAt: null,
        assignedToUserId: 'valid-user',
        createdByUserId: 'user-123',
        labels: [],
        createdAt: new Date('2025-02-04T10:00:00Z'),
        updatedAt: new Date('2025-02-04T10:00:00Z'),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(mockPrisma.task.create).mockResolvedValue(mockCreatedTask as any);

      const context = createMockContext();
      const result = await handlers.create(
        {
          title: 'Assigned task',
          priority: 'medium',
          assignedToUserId: 'valid-user',
        },
        context
      );

      expect(result.success).toBe(true);
    });
  });

  describe('complete', () => {
    it('should mark a task as done', async () => {
      const mockTask = {
        id: 'task-1',
        familyId: 'family-456',
        title: 'Task to complete',
        description: null,
        status: 'todo',
        priority: 'medium',
        dueAt: null,
        completedAt: null,
        assignedToUserId: null,
        createdByUserId: 'user-123',
        labels: [],
        createdAt: new Date('2025-02-04T10:00:00Z'),
        updatedAt: new Date('2025-02-04T10:00:00Z'),
      };

      const completedTask = {
        ...mockTask,
        status: 'done',
        completedAt: new Date('2025-02-04T14:00:00Z'),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(mockPrisma.task.findFirst).mockResolvedValue(mockTask as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(mockPrisma.task.update).mockResolvedValue(completedTask as any);

      const context = createMockContext();
      const result = await handlers.complete({ taskId: 'task-1' }, context);

      expect(result.success).toBe(true);
      expect(result.data?.task.status).toBe('done');
      expect(result.data?.task.completedAt).toBeDefined();
    });

    it('should return error for non-existent task', async () => {
      vi.mocked(mockPrisma.task.findFirst).mockResolvedValue(null);

      const context = createMockContext();
      const result = await handlers.complete({ taskId: 'non-existent' }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('assign', () => {
    it('should assign a task to a family member', async () => {
      const mockTask = {
        id: 'task-1',
        familyId: 'family-456',
        title: 'Task to assign',
        description: null,
        status: 'todo',
        priority: 'medium',
        dueAt: null,
        completedAt: null,
        assignedToUserId: null,
        createdByUserId: 'user-123',
        labels: [],
        createdAt: new Date('2025-02-04T10:00:00Z'),
        updatedAt: new Date('2025-02-04T10:00:00Z'),
      };

      const assignedTask = {
        ...mockTask,
        assignedToUserId: 'assignee-user',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(mockPrisma.task.findFirst).mockResolvedValue(mockTask as any);
      vi.mocked(mockPrisma.familyMember.findFirst).mockResolvedValue({
        id: 'member-1',
        familyId: 'family-456',
        userId: 'assignee-user',
        role: 'member',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(mockPrisma.task.update).mockResolvedValue(assignedTask as any);

      const context = createMockContext();
      const result = await handlers.assign(
        { taskId: 'task-1', assignedToUserId: 'assignee-user' },
        context
      );

      expect(result.success).toBe(true);
      expect(result.data?.task.assignedToUserId).toBe('assignee-user');
    });

    it('should reject assignment to non-family member', async () => {
      const mockTask = {
        id: 'task-1',
        familyId: 'family-456',
        title: 'Task',
        description: null,
        status: 'todo',
        priority: 'medium',
        dueAt: null,
        completedAt: null,
        assignedToUserId: null,
        createdByUserId: 'user-123',
        labels: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(mockPrisma.task.findFirst).mockResolvedValue(mockTask as any);
      vi.mocked(mockPrisma.familyMember.findFirst).mockResolvedValue(null);

      const context = createMockContext();
      const result = await handlers.assign(
        { taskId: 'task-1', assignedToUserId: 'stranger' },
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not a member');
    });
  });
});
