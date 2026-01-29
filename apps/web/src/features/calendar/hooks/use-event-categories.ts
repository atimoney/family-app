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
// Colors are from MUI color palette for visual distinction
// ----------------------------------------------------------------------

export const DEFAULT_CATEGORIES: Omit<EventCategoryConfig, 'id' | 'familyId' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'activity', label: 'Activity', icon: 'solar:cup-star-bold', color: '#FFB300', sortOrder: 0, isSystem: true, metadataSchema: {} }, // Amber 600
  { name: 'school', label: 'School', icon: 'mdi:school', color: '#1E88E5', sortOrder: 1, isSystem: true, metadataSchema: {} }, // Blue 600
  { name: 'sport', label: 'Sport', icon: 'solar:dumbbell-large-minimalistic-bold', color: '#43A047', sortOrder: 2, isSystem: true, metadataSchema: {} }, // Green 600
  { name: 'social', label: 'Social', icon: 'mdi:party-popper', color: '#E91E63', sortOrder: 3, isSystem: true, metadataSchema: {} }, // Pink 500
  { name: 'appointment', label: 'Appointment', icon: 'solar:calendar-date-bold', color: '#00ACC1', sortOrder: 4, isSystem: true, metadataSchema: {} }, // Cyan 600
  { name: 'work', label: 'Work', icon: 'mdi:briefcase', color: '#5E35B1', sortOrder: 5, isSystem: true, metadataSchema: {} }, // Deep Purple 600
  { name: 'travel', label: 'Travel', icon: 'mdi:airplane', color: '#FB8C00', sortOrder: 6, isSystem: true, metadataSchema: {} }, // Orange 600
  { name: 'home', label: 'Home', icon: 'mdi:home', color: '#8D6E63', sortOrder: 7, isSystem: true, metadataSchema: {} }, // Brown 400
  { name: 'admin', label: 'Admin', icon: 'solar:file-text-bold', color: '#757575', sortOrder: 8, isSystem: true, metadataSchema: {} }, // Grey 600
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
