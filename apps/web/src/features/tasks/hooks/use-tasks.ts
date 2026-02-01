import type { Task, TasksQuery } from '../types';

import { useMemo, useState, useEffect, useCallback } from 'react';

import { getTasks } from '../api';

// ----------------------------------------------------------------------

export type UseTasksReturn = {
  tasks: Task[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

const EMPTY_QUERY: TasksQuery = {};

export function useTasks(query: TasksQuery = EMPTY_QUERY): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Memoize the query to prevent infinite loops
  const stableQuery = useMemo(
    () => ({
      status: query.status,
      assignedTo: query.assignedTo,
      dueBefore: query.dueBefore,
      dueAfter: query.dueAfter,
      includeCompleted: query.includeCompleted,
      labels: query.labels,
      search: query.search,
    }),
    [
      query.status,
      query.assignedTo,
      query.dueBefore,
      query.dueAfter,
      query.includeCompleted,
      query.labels,
      query.search,
    ]
  );

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTasks(stableQuery);
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load tasks'));
    } finally {
      setLoading(false);
    }
  }, [stableQuery]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    tasks,
    loading,
    error,
    refresh,
  };
}
