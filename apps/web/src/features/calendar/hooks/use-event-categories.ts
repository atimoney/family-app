import type {
  EventCategoryConfig,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@family/shared';

import { useState, useEffect, useCallback } from 'react';

import {
  getEventCategories,
  createEventCategory,
  updateEventCategory,
  deleteEventCategory,
  reorderEventCategories,
} from '../categories-api';

// ----------------------------------------------------------------------
// DEFAULT CATEGORIES (fallback when API is unavailable)
// ----------------------------------------------------------------------

export const DEFAULT_CATEGORIES: Omit<EventCategoryConfig, 'id' | 'familyId' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'activity', label: 'Activity', icon: 'solar:cup-star-bold', color: null, sortOrder: 0, isSystem: true, metadataSchema: {} },
  { name: 'school', label: 'School', icon: 'mdi:school', color: null, sortOrder: 1, isSystem: true, metadataSchema: {} },
  { name: 'sport', label: 'Sport', icon: 'solar:dumbbell-large-minimalistic-bold', color: null, sortOrder: 2, isSystem: true, metadataSchema: {} },
  { name: 'social', label: 'Social', icon: 'mdi:party-popper', color: null, sortOrder: 3, isSystem: true, metadataSchema: {} },
  { name: 'appointment', label: 'Appointment', icon: 'solar:calendar-date-bold', color: null, sortOrder: 4, isSystem: true, metadataSchema: {} },
  { name: 'work', label: 'Work', icon: 'mdi:briefcase', color: null, sortOrder: 5, isSystem: true, metadataSchema: {} },
  { name: 'travel', label: 'Travel', icon: 'mdi:airplane', color: null, sortOrder: 6, isSystem: true, metadataSchema: {} },
  { name: 'home', label: 'Home', icon: 'mdi:home', color: null, sortOrder: 7, isSystem: true, metadataSchema: {} },
  { name: 'admin', label: 'Admin', icon: 'solar:file-text-bold', color: null, sortOrder: 8, isSystem: true, metadataSchema: {} },
];

// Convert to full EventCategoryConfig format for fallback
const FALLBACK_CATEGORIES: EventCategoryConfig[] = DEFAULT_CATEGORIES.map((cat, index) => ({
  ...cat,
  id: `fallback-${cat.name}`,
  familyId: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

// ----------------------------------------------------------------------
// HOOK: useEventCategories
// ----------------------------------------------------------------------

export type UseEventCategoriesState = {
  categories: EventCategoryConfig[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  create: (data: CreateCategoryInput) => Promise<EventCategoryConfig | null>;
  update: (categoryId: string, data: UpdateCategoryInput) => Promise<EventCategoryConfig | null>;
  remove: (categoryId: string) => Promise<boolean>;
  reorder: (categoryIds: string[]) => Promise<EventCategoryConfig[] | null>;
};

export function useEventCategories(familyId: string | null): UseEventCategoriesState {
  const [categories, setCategories] = useState<EventCategoryConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch categories
  const refresh = useCallback(async () => {
    if (!familyId) {
      setCategories(FALLBACK_CATEGORIES);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getEventCategories(familyId);
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories:', err);
      setError(err instanceof Error ? err : new Error('Failed to load categories'));
      // Use fallback categories on error
      setCategories(FALLBACK_CATEGORIES);
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Create category
  const create = useCallback(
    async (data: CreateCategoryInput): Promise<EventCategoryConfig | null> => {
      if (!familyId) {
        setError(new Error('No family selected'));
        return null;
      }

      try {
        const newCategory = await createEventCategory(familyId, data);
        setCategories((prev) => [...prev, newCategory]);
        return newCategory;
      } catch (err) {
        console.error('Failed to create category:', err);
        setError(err instanceof Error ? err : new Error('Failed to create category'));
        return null;
      }
    },
    [familyId]
  );

  // Update category
  const update = useCallback(
    async (categoryId: string, data: UpdateCategoryInput): Promise<EventCategoryConfig | null> => {
      if (!familyId) {
        setError(new Error('No family selected'));
        return null;
      }

      try {
        const updated = await updateEventCategory(familyId, categoryId, data);
        setCategories((prev) =>
          prev.map((cat) => (cat.id === categoryId ? updated : cat))
        );
        return updated;
      } catch (err) {
        console.error('Failed to update category:', err);
        setError(err instanceof Error ? err : new Error('Failed to update category'));
        return null;
      }
    },
    [familyId]
  );

  // Delete category
  const remove = useCallback(
    async (categoryId: string): Promise<boolean> => {
      if (!familyId) {
        setError(new Error('No family selected'));
        return false;
      }

      try {
        await deleteEventCategory(familyId, categoryId);
        setCategories((prev) => prev.filter((cat) => cat.id !== categoryId));
        return true;
      } catch (err) {
        console.error('Failed to delete category:', err);
        setError(err instanceof Error ? err : new Error('Failed to delete category'));
        return false;
      }
    },
    [familyId]
  );

  // Reorder categories
  const reorder = useCallback(
    async (categoryIds: string[]): Promise<EventCategoryConfig[] | null> => {
      if (!familyId) {
        setError(new Error('No family selected'));
        return null;
      }

      try {
        const reordered = await reorderEventCategories(familyId, categoryIds);
        setCategories(reordered);
        return reordered;
      } catch (err) {
        console.error('Failed to reorder categories:', err);
        setError(err instanceof Error ? err : new Error('Failed to reorder categories'));
        return null;
      }
    },
    [familyId]
  );

  return {
    categories,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
    reorder,
  };
}
