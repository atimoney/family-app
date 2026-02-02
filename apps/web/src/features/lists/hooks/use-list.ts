import type { ListWithItems } from '../types';

import { useState, useEffect, useCallback } from 'react';

import { getList } from '../api';

// ----------------------------------------------------------------------

export type UseListReturn = {
  list: ListWithItems | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

export type UseListOptions = {
  includeItems?: boolean;
};

export function useList(listId: string | null, options: UseListOptions = {}): UseListReturn {
  const [list, setList] = useState<ListWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { includeItems = false } = options;

  const refresh = useCallback(async () => {
    if (!listId) {
      setList(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getList(listId, includeItems);
      setList(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load list'));
    } finally {
      setLoading(false);
    }
  }, [listId, includeItems]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    list,
    loading,
    error,
    refresh,
  };
}
