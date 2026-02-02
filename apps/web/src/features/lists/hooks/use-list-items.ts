import type { ListItemDTO, ListItemsQuery } from '../types';

import { useMemo, useState, useEffect, useCallback } from 'react';

import { getListItems } from '../api';

// ----------------------------------------------------------------------

export type UseListItemsReturn = {
  items: ListItemDTO[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

const EMPTY_QUERY: ListItemsQuery = {};

export function useListItems(
  listId: string | null,
  query: ListItemsQuery = EMPTY_QUERY
): UseListItemsReturn {
  const [items, setItems] = useState<ListItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Memoize the query to prevent infinite loops
  const stableQuery = useMemo(
    () => ({
      status: query.status,
      includeArchived: query.includeArchived,
    }),
    [query.status, query.includeArchived]
  );

  const refresh = useCallback(async () => {
    if (!listId) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getListItems(listId, stableQuery);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load list items'));
    } finally {
      setLoading(false);
    }
  }, [listId, stableQuery]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    items,
    loading,
    error,
    refresh,
  };
}
