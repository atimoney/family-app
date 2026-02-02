import type { ListDTO, ListsQuery } from '../types';

import { useMemo, useState, useEffect, useCallback } from 'react';

import { getLists } from '../api';

// ----------------------------------------------------------------------

export type UseListsReturn = {
  lists: ListDTO[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

const EMPTY_QUERY: ListsQuery = {};

export function useLists(query: ListsQuery = EMPTY_QUERY): UseListsReturn {
  const [lists, setLists] = useState<ListDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Memoize the query to prevent infinite loops
  const stableQuery = useMemo(
    () => ({
      navVisibility: query.navVisibility,
      templateKey: query.templateKey,
    }),
    [query.navVisibility, query.templateKey]
  );

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getLists(stableQuery);
      setLists(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load lists'));
    } finally {
      setLoading(false);
    }
  }, [stableQuery]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    lists,
    loading,
    error,
    refresh,
  };
}
