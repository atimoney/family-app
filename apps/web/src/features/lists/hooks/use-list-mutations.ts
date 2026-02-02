import type {
  ListDTO,
  ListItemDTO,
  CreateListInput,
  UpdateListInput,
  CreateListItemInput,
  UpdateListItemInput,
  UserListPreferencesDTO,
  UserListPreferencesInput,
} from '../types';

import { useState, useCallback } from 'react';

import {
  createList,
  updateList,
  deleteList,
  createListItem,
  updateListItem,
  deleteListItem,
  upsertListPreferences,
} from '../api';

// ----------------------------------------------------------------------
// LIST MUTATIONS
// ----------------------------------------------------------------------

export type UseListMutationsReturn = {
  create: (input: CreateListInput) => Promise<ListDTO | null>;
  update: (listId: string, input: UpdateListInput) => Promise<ListDTO | null>;
  remove: (listId: string) => Promise<boolean>;
  loading: boolean;
  error: Error | null;
};

export function useListMutations(onSuccess?: () => void): UseListMutationsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(
    async (input: CreateListInput): Promise<ListDTO | null> => {
      try {
        setLoading(true);
        setError(null);
        const list = await createList(input);
        onSuccess?.();
        return list;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to create list'));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [onSuccess]
  );

  const update = useCallback(
    async (listId: string, input: UpdateListInput): Promise<ListDTO | null> => {
      try {
        setLoading(true);
        setError(null);
        const list = await updateList(listId, input);
        onSuccess?.();
        return list;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to update list'));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [onSuccess]
  );

  const remove = useCallback(
    async (listId: string): Promise<boolean> => {
      try {
        setLoading(true);
        setError(null);
        await deleteList(listId);
        onSuccess?.();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to delete list'));
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
    loading,
    error,
  };
}

// ----------------------------------------------------------------------
// LIST ITEM MUTATIONS
// ----------------------------------------------------------------------

export type UseListItemMutationsReturn = {
  create: (listId: string, input: CreateListItemInput) => Promise<ListItemDTO | null>;
  update: (itemId: string, input: UpdateListItemInput) => Promise<ListItemDTO | null>;
  remove: (itemId: string) => Promise<boolean>;
  loading: boolean;
  error: Error | null;
};

export function useListItemMutations(onSuccess?: () => void): UseListItemMutationsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(
    async (listId: string, input: CreateListItemInput): Promise<ListItemDTO | null> => {
      try {
        setLoading(true);
        setError(null);
        const item = await createListItem(listId, input);
        onSuccess?.();
        return item;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to create list item'));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [onSuccess]
  );

  const update = useCallback(
    async (itemId: string, input: UpdateListItemInput): Promise<ListItemDTO | null> => {
      try {
        setLoading(true);
        setError(null);
        const item = await updateListItem(itemId, input);
        onSuccess?.();
        return item;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to update list item'));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [onSuccess]
  );

  const remove = useCallback(
    async (itemId: string): Promise<boolean> => {
      try {
        setLoading(true);
        setError(null);
        await deleteListItem(itemId);
        onSuccess?.();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to delete list item'));
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
    loading,
    error,
  };
}

// ----------------------------------------------------------------------
// LIST PREFERENCES MUTATIONS
// ----------------------------------------------------------------------

export type UseListPreferencesMutationsReturn = {
  upsert: (listId: string, input: UserListPreferencesInput) => Promise<UserListPreferencesDTO | null>;
  loading: boolean;
  error: Error | null;
};

export function useListPreferencesMutations(onSuccess?: () => void): UseListPreferencesMutationsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const upsert = useCallback(
    async (listId: string, input: UserListPreferencesInput): Promise<UserListPreferencesDTO | null> => {
      try {
        setLoading(true);
        setError(null);
        const prefs = await upsertListPreferences(listId, input);
        onSuccess?.();
        return prefs;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to update list preferences'));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [onSuccess]
  );

  return {
    upsert,
    loading,
    error,
  };
}
