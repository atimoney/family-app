import { useMemo, useCallback } from 'react';
import { useLocalStorage } from 'minimal-shared/hooks';
import { getStorage as getStorageValue } from 'minimal-shared/utils';

// ----------------------------------------------------------------------

const STORAGE_KEY = 'family-tasks-preferences';

/**
 * Task view types - mirrors calendar views plus kanban
 */
export type TaskView =
  | 'agenda'              // List view (default) - similar to calendar listWeek
  | 'dayGridMonth'        // Month view
  | 'timeGridWeek'        // Week view  
  | 'timeGridDay'         // Day view
  | 'resourceTimeGridDay' // Resource view (by family member)
  | 'kanban';             // Kanban board view

/**
 * Preferences that are persisted to localStorage
 * Mirrors CalendarPreferences structure for consistency
 */
export type TasksPreferences = {
  // View preferences (separate for mobile/desktop)
  desktopView: TaskView;
  mobileView: TaskView;
  // Whether to show completed tasks
  showCompleted: boolean;
  // Whether to show unassigned tasks
  showUnassigned: boolean;
};

const DEFAULT_PREFERENCES: TasksPreferences = {
  desktopView: 'agenda',
  mobileView: 'agenda',
  showCompleted: false,
  showUnassigned: true,
};

/**
 * Get stored preferences synchronously (for initial render)
 * This avoids the async loading delay of useLocalStorage
 */
export function getStoredTasksPreferences(): TasksPreferences {
  const stored = getStorageValue<TasksPreferences>(STORAGE_KEY);
  return stored ? { ...DEFAULT_PREFERENCES, ...stored } : DEFAULT_PREFERENCES;
}

export type UseTasksPreferencesReturn = {
  preferences: TasksPreferences;
  setDesktopView: (view: TaskView) => void;
  setMobileView: (view: TaskView) => void;
  setShowCompleted: (show: boolean) => void;
  setShowUnassigned: (show: boolean) => void;
};

/**
 * Hook to persist tasks preferences (view, filters, etc.) to localStorage.
 * This ensures users return to their preferred tasks configuration.
 * 
 * Uses the SAME pattern as useCalendarPreferences for consistency.
 * 
 * Persisted settings:
 * - Desktop view (agenda, dayGridMonth, timeGridWeek, etc.)
 * - Mobile view (agenda, timeGridDay, etc.)
 * - Show completed tasks preference
 * - Show unassigned tasks preference
 * 
 * NOT persisted (as these may change frequently or depend on current context):
 * - Selected member IDs for filtering
 * - Date range filters
 * - Search query
 */
export function useTasksPreferences(): UseTasksPreferencesReturn {
  const { state: preferences, setField } = useLocalStorage<TasksPreferences>(
    STORAGE_KEY,
    DEFAULT_PREFERENCES
  );

  const setDesktopView = useCallback(
    (view: TaskView) => {
      setField('desktopView', view);
    },
    [setField]
  );

  const setMobileView = useCallback(
    (view: TaskView) => {
      setField('mobileView', view);
    },
    [setField]
  );

  const setShowCompleted = useCallback(
    (show: boolean) => {
      setField('showCompleted', show);
    },
    [setField]
  );

  const setShowUnassigned = useCallback(
    (show: boolean) => {
      setField('showUnassigned', show);
    },
    [setField]
  );

  return useMemo(
    () => ({
      preferences,
      setDesktopView,
      setMobileView,
      setShowCompleted,
      setShowUnassigned,
    }),
    [preferences, setDesktopView, setMobileView, setShowCompleted, setShowUnassigned]
  );
}
