import type { Task, CreateTaskInput, UpdateTaskInput } from '../types';

import { useState, useCallback } from 'react';

import { createTask, updateTask, deleteTask, bulkUpdateTasks } from '../api';

// ----------------------------------------------------------------------

export type UseTaskMutationsReturn = {
  create: (input: CreateTaskInput) => Promise<Task | null>;
  update: (taskId: string, input: UpdateTaskInput) => Promise<Task | null>;
  remove: (taskId: string) => Promise<boolean>;
  bulkUpdate: (updates: Array<{ id: string; status?: string; sortOrder?: number }>) => Promise<boolean>;
  loading: boolean;
  error: Error | null;
};

export function useTaskMutations(onSuccess?: () => void): UseTaskMutationsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(
    async (input: CreateTaskInput): Promise<Task | null> => {
      try {
        setLoading(true);
        setError(null);
        const task = await createTask(input);
        onSuccess?.();
        return task;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to create task'));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [onSuccess]
  );

  const update = useCallback(
    async (taskId: string, input: UpdateTaskInput): Promise<Task | null> => {
      try {
        setLoading(true);
        setError(null);
        const task = await updateTask(taskId, input);
        onSuccess?.();
        return task;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to update task'));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [onSuccess]
  );

  const remove = useCallback(
    async (taskId: string): Promise<boolean> => {
      try {
        setLoading(true);
        setError(null);
        await deleteTask(taskId);
        onSuccess?.();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to delete task'));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [onSuccess]
  );

  const bulkUpdate = useCallback(
    async (updates: Array<{ id: string; status?: string; sortOrder?: number }>): Promise<boolean> => {
      try {
        setLoading(true);
        setError(null);
        await bulkUpdateTasks(updates);
        onSuccess?.();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to bulk update tasks'));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [onSuccess]
  );

  return {
    create,
    update,
    remove,
    bulkUpdate,
    loading,
    error,
  };
}
