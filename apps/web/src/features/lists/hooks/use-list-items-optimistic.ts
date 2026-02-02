import type {
  ListItemDTO,
  ListItemsQuery,
  CreateListItemInput,
  UpdateListItemInput,
} from '../types';

import { useMemo, useState, useEffect, useCallback } from 'react';

import { toast } from 'src/components/snackbar';

import { getListItems, createListItem, updateListItem, deleteListItem } from '../api';

// ----------------------------------------------------------------------

export type UseListItemsOptimisticReturn = {
  items: ListItemDTO[];
  loading: boolean;
  error: Error | null;
  mutating: boolean;
  refresh: () => Promise<void>;
  // Optimistic mutations
  create: (input: CreateListItemInput) => Promise<ListItemDTO | null>;
  update: (itemId: string, input: UpdateListItemInput) => Promise<ListItemDTO | null>;
  remove: (itemId: string) => Promise<boolean>;
  toggleStatus: (item: ListItemDTO) => Promise<boolean>;
};

const EMPTY_QUERY: ListItemsQuery = {};

/**
 * Hook that manages list items with optimistic updates.
 * Shows instant UI feedback while persisting changes to the server.
 */
export function useListItemsOptimistic(
  listId: string | null,
  query: ListItemsQuery = EMPTY_QUERY
): UseListItemsOptimisticReturn {
  const [serverItems, setServerItems] = useState<ListItemDTO[]>([]);
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, Partial<ListItemDTO>>>(
    new Map()
  );
  const [pendingCreates, setPendingCreates] = useState<ListItemDTO[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Memoize the query to prevent infinite loops
  const stableQuery = useMemo(
    () => ({
      status: query.status,
      includeArchived: query.includeArchived,
    }),
    [query.status, query.includeArchived]
  );

  // Compute final items with optimistic updates applied
  const items = useMemo(() => {
    // Start with server items
    let result = serverItems
      // Apply optimistic updates
      .map((item) => {
        const update = optimisticUpdates.get(item.id);
        return update ? { ...item, ...update } : item;
      })
      // Filter out pending deletes
      .filter((item) => !pendingDeletes.has(item.id));

    // Add pending creates
    result = [...pendingCreates, ...result];

    return result;
  }, [serverItems, optimisticUpdates, pendingCreates, pendingDeletes]);

  // Fetch items from server
  const refresh = useCallback(async () => {
    if (!listId) {
      setServerItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getListItems(listId, stableQuery);
      setServerItems(data);
      // Clear optimistic state on successful refresh
      setOptimisticUpdates(new Map());
      setPendingCreates([]);
      setPendingDeletes(new Set());
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load list items'));
    } finally {
      setLoading(false);
    }
  }, [listId, stableQuery]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Create item with optimistic update
  const create = useCallback(
    async (input: CreateListItemInput): Promise<ListItemDTO | null> => {
      if (!listId) return null;

      // Create optimistic item
      const tempId = `temp-${Date.now()}`;
      const optimisticItem: ListItemDTO = {
        id: tempId,
        listId,
        title: input.title,
        status: input.status || 'open',
        sortOrder: 0,
        dueAt: input.dueAt || null,
        assignedToUserId: input.assignedToUserId || null,
        fields: input.fields || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Add to pending creates (optimistic)
      setPendingCreates((prev) => [optimisticItem, ...prev]);
      setMutating(true);

      try {
        const item = await createListItem(listId, input);
        // Remove temp item and add real item
        setPendingCreates((prev) => prev.filter((i) => i.id !== tempId));
        setServerItems((prev) => [item, ...prev]);
        return item;
      } catch (err) {
        // Revert optimistic create
        setPendingCreates((prev) => prev.filter((i) => i.id !== tempId));
        const message = err instanceof Error ? err.message : 'Failed to add item';
        toast.error(message);
        return null;
      } finally {
        setMutating(false);
      }
    },
    [listId]
  );

  // Update item with optimistic update
  const update = useCallback(
    async (itemId: string, input: UpdateListItemInput): Promise<ListItemDTO | null> => {
      // Apply optimistic update immediately
      setOptimisticUpdates((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(itemId) || {};
        newMap.set(itemId, { ...existing, ...input });
        return newMap;
      });
      setMutating(true);

      try {
        const item = await updateListItem(itemId, input);
        // Update server items and clear optimistic state for this item
        setServerItems((prev) => prev.map((i) => (i.id === itemId ? item : i)));
        setOptimisticUpdates((prev) => {
          const newMap = new Map(prev);
          newMap.delete(itemId);
          return newMap;
        });
        return item;
      } catch (err) {
        // Revert optimistic update
        setOptimisticUpdates((prev) => {
          const newMap = new Map(prev);
          newMap.delete(itemId);
          return newMap;
        });
        const message = err instanceof Error ? err.message : 'Failed to update item';
        toast.error(message);
        return null;
      } finally {
        setMutating(false);
      }
    },
    []
  );

  // Delete item with optimistic update
  const remove = useCallback(async (itemId: string): Promise<boolean> => {
    // Add to pending deletes (optimistic)
    setPendingDeletes((prev) => new Set(prev).add(itemId));
    setMutating(true);

    try {
      await deleteListItem(itemId);
      // Remove from server items
      setServerItems((prev) => prev.filter((i) => i.id !== itemId));
      setPendingDeletes((prev) => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      return true;
    } catch (err) {
      // Revert optimistic delete
      setPendingDeletes((prev) => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      const message = err instanceof Error ? err.message : 'Failed to delete item';
      toast.error(message);
      return false;
    } finally {
      setMutating(false);
    }
  }, []);

  // Toggle status - convenience method with optimistic update
  const toggleStatus = useCallback(
    async (item: ListItemDTO): Promise<boolean> => {
      const newStatus = item.status === 'done' ? 'open' : 'done';
      const result = await update(item.id, { status: newStatus });
      return result !== null;
    },
    [update]
  );

  return {
    items,
    loading,
    error,
    mutating,
    refresh,
    create,
    update,
    remove,
    toggleStatus,
  };
}
