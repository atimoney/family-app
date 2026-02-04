import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  pendingActionStore,
  isWriteTool,
  isDestructiveTool,
  CONFIDENCE_THRESHOLD,
} from './confirmation.js';

describe('confirmation', () => {
  beforeEach(() => {
    pendingActionStore.clear();
  });

  afterEach(() => {
    pendingActionStore.clear();
  });

  describe('pendingActionStore', () => {
    const baseOptions = {
      userId: 'user-123',
      familyId: 'family-456',
      requestId: 'req-789',
      conversationId: 'conv-abc',
      toolCall: { toolName: 'tasks.create', input: { title: 'Test task' } },
      description: 'Create task: Test task',
    };

    describe('create', () => {
      it('should create a pending action with token', () => {
        const action = pendingActionStore.create(baseOptions);

        expect(action.token).toMatch(/^pa_[a-f0-9]{32}$/);
        expect(action.userId).toBe('user-123');
        expect(action.familyId).toBe('family-456');
        expect(action.requestId).toBe('req-789');
        expect(action.conversationId).toBe('conv-abc');
        expect(action.toolCall.toolName).toBe('tasks.create');
        expect(action.description).toBe('Create task: Test task');
        expect(action.createdAt).toBeInstanceOf(Date);
        expect(action.ttlMs).toBe(5 * 60 * 1000); // Default 5 minutes
        expect(action.isDestructive).toBe(false);
      });

      it('should accept custom TTL', () => {
        const action = pendingActionStore.create({
          ...baseOptions,
          ttlMs: 60 * 1000, // 1 minute
        });

        expect(action.ttlMs).toBe(60 * 1000);
      });

      it('should mark destructive actions', () => {
        const action = pendingActionStore.create({
          ...baseOptions,
          isDestructive: true,
        });

        expect(action.isDestructive).toBe(true);
      });
    });

    describe('get', () => {
      it('should retrieve a valid pending action', () => {
        const created = pendingActionStore.create(baseOptions);

        const result = pendingActionStore.get(created.token, 'user-123', 'family-456');

        expect(result.found).toBe(true);
        if (result.found) {
          expect(result.action.token).toBe(created.token);
        }
      });

      it('should reject non-existent token', () => {
        const result = pendingActionStore.get('pa_nonexistent123456789012', 'user-123', 'family-456');

        expect(result.found).toBe(false);
        if (!result.found) {
          expect(result.reason).toBe('not_found');
        }
      });

      it('should reject wrong user', () => {
        const created = pendingActionStore.create(baseOptions);

        const result = pendingActionStore.get(created.token, 'wrong-user', 'family-456');

        expect(result.found).toBe(false);
        if (!result.found) {
          expect(result.reason).toBe('user_mismatch');
        }
      });

      it('should reject wrong family', () => {
        const created = pendingActionStore.create(baseOptions);

        const result = pendingActionStore.get(created.token, 'user-123', 'wrong-family');

        expect(result.found).toBe(false);
        if (!result.found) {
          expect(result.reason).toBe('family_mismatch');
        }
      });

      it('should reject expired token', () => {
        // Create with very short TTL
        const created = pendingActionStore.create({
          ...baseOptions,
          ttlMs: 1, // 1ms
        });

        // Wait for expiry
        vi.useFakeTimers();
        vi.advanceTimersByTime(10);

        const result = pendingActionStore.get(created.token, 'user-123', 'family-456');

        expect(result.found).toBe(false);
        if (!result.found) {
          expect(result.reason).toBe('expired');
        }

        vi.useRealTimers();
      });
    });

    describe('consume', () => {
      it('should get and delete the pending action', () => {
        const created = pendingActionStore.create(baseOptions);

        // First consume succeeds
        const result1 = pendingActionStore.consume(created.token, 'user-123', 'family-456');
        expect(result1.found).toBe(true);

        // Second consume fails (already consumed)
        const result2 = pendingActionStore.consume(created.token, 'user-123', 'family-456');
        expect(result2.found).toBe(false);
        if (!result2.found) {
          expect(result2.reason).toBe('not_found');
        }
      });
    });

    describe('delete', () => {
      it('should delete a pending action', () => {
        const created = pendingActionStore.create(baseOptions);

        const deleted = pendingActionStore.delete(created.token);
        expect(deleted).toBe(true);

        const result = pendingActionStore.get(created.token, 'user-123', 'family-456');
        expect(result.found).toBe(false);
      });

      it('should return false for non-existent token', () => {
        const deleted = pendingActionStore.delete('pa_nonexistent123456789012');
        expect(deleted).toBe(false);
      });
    });

    describe('getByUser', () => {
      it('should return all valid actions for a user', () => {
        pendingActionStore.create(baseOptions);
        pendingActionStore.create({
          ...baseOptions,
          toolCall: { toolName: 'tasks.complete', input: { taskId: '123' } },
        });
        pendingActionStore.create({
          ...baseOptions,
          userId: 'other-user',
        });

        const userActions = pendingActionStore.getByUser('user-123');
        expect(userActions).toHaveLength(2);
      });
    });

    describe('cleanup', () => {
      it('should remove expired actions', () => {
        vi.useFakeTimers();

        // Create action with short TTL
        pendingActionStore.create({
          ...baseOptions,
          ttlMs: 100,
        });

        expect(pendingActionStore.size).toBe(1);

        // Advance time past TTL
        vi.advanceTimersByTime(200);
        const cleaned = pendingActionStore.cleanup();

        expect(cleaned).toBe(1);
        expect(pendingActionStore.size).toBe(0);

        vi.useRealTimers();
      });
    });

    describe('size', () => {
      it('should return count of pending actions', () => {
        expect(pendingActionStore.size).toBe(0);

        pendingActionStore.create(baseOptions);
        expect(pendingActionStore.size).toBe(1);

        pendingActionStore.create({ ...baseOptions });
        expect(pendingActionStore.size).toBe(2);
      });
    });
  });

  describe('isWriteTool', () => {
    it('should return true for write operations', () => {
      expect(isWriteTool('tasks.create')).toBe(true);
      expect(isWriteTool('tasks.update')).toBe(true);
      expect(isWriteTool('tasks.delete')).toBe(true);
      expect(isWriteTool('tasks.assign')).toBe(true);
      expect(isWriteTool('tasks.complete')).toBe(true);
    });

    it('should return false for read operations', () => {
      expect(isWriteTool('tasks.list')).toBe(false);
      expect(isWriteTool('tasks.get')).toBe(false);
      expect(isWriteTool('calendar.list')).toBe(false);
    });
  });

  describe('isDestructiveTool', () => {
    it('should return true for destructive operations', () => {
      expect(isDestructiveTool('tasks.delete')).toBe(true);
      expect(isDestructiveTool('events.remove')).toBe(true);
    });

    it('should return false for non-destructive operations', () => {
      expect(isDestructiveTool('tasks.create')).toBe(false);
      expect(isDestructiveTool('tasks.update')).toBe(false);
      expect(isDestructiveTool('tasks.complete')).toBe(false);
    });
  });

  describe('CONFIDENCE_THRESHOLD', () => {
    it('should be 0.85', () => {
      expect(CONFIDENCE_THRESHOLD).toBe(0.85);
    });
  });
});
