import { describe, it, expect } from 'vitest';
import {
  tasksListInputSchema,
  tasksCreateInputSchema,
  tasksCompleteInputSchema,
  tasksAssignInputSchema,
  taskSchema,
  taskStatusSchema,
  taskPrioritySchema,
} from './task-schemas.js';

describe('task-schemas', () => {
  describe('tasksListInputSchema', () => {
    it('should accept empty input with defaults', () => {
      const result = tasksListInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        // Only limit has a default
        expect(result.data.limit).toBe(50);
        expect(result.data.status).toBeUndefined();
      }
    });

    it('should accept valid status values', () => {
      expect(tasksListInputSchema.safeParse({ status: 'open' }).success).toBe(true);
      expect(tasksListInputSchema.safeParse({ status: 'done' }).success).toBe(true);
    });

    it('should reject invalid status values', () => {
      const result = tasksListInputSchema.safeParse({ status: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should reject "all" status (not in schema)', () => {
      const result = tasksListInputSchema.safeParse({ status: 'all' });
      expect(result.success).toBe(false);
    });

    it('should accept assignedToUserId filter', () => {
      const result = tasksListInputSchema.safeParse({
        assignedToUserId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assignedToUserId).toBe('123e4567-e89b-12d3-a456-426614174000');
      }
    });

    it('should enforce limit constraints', () => {
      expect(tasksListInputSchema.safeParse({ limit: 0 }).success).toBe(false);
      expect(tasksListInputSchema.safeParse({ limit: 101 }).success).toBe(false);
      expect(tasksListInputSchema.safeParse({ limit: 50 }).success).toBe(true);
    });
  });

  describe('tasksCreateInputSchema', () => {
    it('should require title', () => {
      const result = tasksCreateInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept minimal input with defaults', () => {
      const result = tasksCreateInputSchema.safeParse({ title: 'Test task' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Test task');
        expect(result.data.priority).toBe('medium');
      }
    });

    it('should accept full input', () => {
      const result = tasksCreateInputSchema.safeParse({
        title: 'Test task',
        notes: 'Task notes',
        dueAt: '2025-02-15T10:00:00Z',
        priority: 'high',
        assignedToUserId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe('high');
        expect(result.data.dueAt).toBe('2025-02-15T10:00:00Z');
      }
    });

    it('should reject invalid priority', () => {
      const result = tasksCreateInputSchema.safeParse({
        title: 'Test',
        priority: 'critical',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid date format', () => {
      const result = tasksCreateInputSchema.safeParse({
        title: 'Test',
        dueAt: 'not-a-date',
      });
      expect(result.success).toBe(false);
    });

    it('should accept valid ISO 8601 datetime strings', () => {
      // The schema uses z.string().datetime() - Zod's default only accepts UTC (Z suffix)
      const validDates = [
        '2025-02-15T10:00:00Z',
        '2025-02-15T10:00:00.000Z',
      ];
      for (const date of validDates) {
        const result = tasksCreateInputSchema.safeParse({ title: 'Test', dueAt: date });
        expect(result.success, `Expected ${date} to be valid`).toBe(true);
      }
    });

    it('should reject date-only strings (no time component)', () => {
      // z.string().datetime() requires time component
      const result = tasksCreateInputSchema.safeParse({
        title: 'Test',
        dueAt: '2025-02-15',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('tasksCompleteInputSchema', () => {
    it('should require taskId', () => {
      const result = tasksCompleteInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept valid taskId', () => {
      const result = tasksCompleteInputSchema.safeParse({
        taskId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(true);
    });

    it('should accept any non-empty string taskId', () => {
      // Schema uses z.string().min(1), not uuid validation
      const result = tasksCompleteInputSchema.safeParse({ taskId: 'any-string-id' });
      expect(result.success).toBe(true);
    });

    it('should reject empty taskId', () => {
      const result = tasksCompleteInputSchema.safeParse({ taskId: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('tasksAssignInputSchema', () => {
    it('should require both taskId and assignedToUserId', () => {
      expect(tasksAssignInputSchema.safeParse({}).success).toBe(false);
      expect(tasksAssignInputSchema.safeParse({ taskId: '123e4567-e89b-12d3-a456-426614174000' }).success).toBe(false);
    });

    it('should accept valid input', () => {
      const result = tasksAssignInputSchema.safeParse({
        taskId: '123e4567-e89b-12d3-a456-426614174000',
        assignedToUserId: '987fcdeb-51a2-3b4c-d567-890123456789',
      });
      expect(result.success).toBe(true);
    });

    it('should accept null assignedToUserId (for unassigning)', () => {
      const result = tasksAssignInputSchema.safeParse({
        taskId: '123e4567-e89b-12d3-a456-426614174000',
        assignedToUserId: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('taskSchema', () => {
    it('should validate task output structure', () => {
      const result = taskSchema.safeParse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        familyId: 'family-123',
        title: 'Test task',
        status: 'todo',
        priority: 'medium',
        createdByUserId: 'user-123',
        labels: [],
        createdAt: '2025-02-04T10:00:00Z',
        updatedAt: '2025-02-04T10:00:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional fields', () => {
      const result = taskSchema.safeParse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        familyId: 'family-123',
        title: 'Test task',
        description: 'A description',
        status: 'doing',
        priority: 'high',
        dueAt: '2025-02-15T10:00:00Z',
        assignedToUserId: '987fcdeb-51a2-3b4c-d567-890123456789',
        assignedToName: 'John Doe',
        completedAt: null,
        createdByUserId: 'user-123',
        labels: ['urgent', 'home'],
        createdAt: '2025-02-04T10:00:00Z',
        updatedAt: '2025-02-04T10:00:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('should validate status enum', () => {
      const result = taskSchema.safeParse({
        id: '123',
        familyId: 'family-123',
        title: 'Test',
        status: 'invalid',
        priority: 'medium',
        createdByUserId: 'user-123',
        labels: [],
        createdAt: '2025-02-04T10:00:00Z',
        updatedAt: '2025-02-04T10:00:00Z',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('taskStatusSchema', () => {
    it('should accept valid statuses', () => {
      expect(taskStatusSchema.safeParse('todo').success).toBe(true);
      expect(taskStatusSchema.safeParse('doing').success).toBe(true);
      expect(taskStatusSchema.safeParse('done').success).toBe(true);
    });

    it('should reject invalid statuses', () => {
      expect(taskStatusSchema.safeParse('pending').success).toBe(false);
      expect(taskStatusSchema.safeParse('').success).toBe(false);
    });
  });

  describe('taskPrioritySchema', () => {
    it('should accept valid priorities', () => {
      expect(taskPrioritySchema.safeParse('low').success).toBe(true);
      expect(taskPrioritySchema.safeParse('medium').success).toBe(true);
      expect(taskPrioritySchema.safeParse('high').success).toBe(true);
      expect(taskPrioritySchema.safeParse('urgent').success).toBe(true);
    });

    it('should reject invalid priorities', () => {
      expect(taskPrioritySchema.safeParse('critical').success).toBe(false);
      expect(taskPrioritySchema.safeParse('').success).toBe(false);
    });
  });
});
