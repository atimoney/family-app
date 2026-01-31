import type { CalendarView } from './use-calendar';
import type { ColorMode, CalendarFiltersState } from '../calendar-filters';

import { useMemo, useCallback } from 'react';
import { useLocalStorage } from 'minimal-shared/hooks';
import { getStorage as getStorageValue } from 'minimal-shared/utils';

// ----------------------------------------------------------------------

const STORAGE_KEY = 'family-calendar-preferences';

/**
 * Preferences that are persisted to localStorage
 * Note: We don't persist member/category selection as those may change,
 * but we DO persist the colorMode and view preferences
 */
export type CalendarPreferences = {
  // View preferences (separate for mobile/desktop)
  desktopView: CalendarView;
  mobileView: CalendarView;
  // Color mode preference (shared across breakpoints)
  colorMode: ColorMode;
  // Whether to show unassigned events by default
  showUnassigned: boolean;
};

const DEFAULT_PREFERENCES: CalendarPreferences = {
  desktopView: 'timeGridWeek',
  mobileView: 'timeGridDay',
  colorMode: 'category',
  showUnassigned: true,
};

/**
 * Get stored preferences synchronously (for initial render)
 * This avoids the async loading delay of useLocalStorage
 */
export function getStoredCalendarPreferences(): CalendarPreferences {
  const stored = getStorageValue<CalendarPreferences>(STORAGE_KEY);
  return stored ? { ...DEFAULT_PREFERENCES, ...stored } : DEFAULT_PREFERENCES;
}

export type UseCalendarPreferencesReturn = {
  preferences: CalendarPreferences;
  setDesktopView: (view: CalendarView) => void;
  setMobileView: (view: CalendarView) => void;
  setColorMode: (mode: ColorMode) => void;
  setShowUnassigned: (show: boolean) => void;
  // Helper to sync filter changes that should be persisted
  syncFiltersToPreferences: (filters: CalendarFiltersState) => void;
};

/**
 * Hook to persist calendar preferences (view, color mode, etc.) to localStorage.
 * This ensures users return to their preferred calendar configuration.
 * 
 * Persisted settings:
 * - Desktop view (dayGridMonth, timeGridWeek, etc.)
 * - Mobile view (timeGridDay, listWeek, etc.)
 * - Color mode (category, member, event, calendar)
 * - Show unassigned events preference
 * 
 * NOT persisted (as these may change frequently or depend on current context):
 * - Selected member IDs
 * - Selected category IDs
 * - Date range filters
 */
export function useCalendarPreferences(): UseCalendarPreferencesReturn {
  const { state: preferences, setField } = useLocalStorage<CalendarPreferences>(
    STORAGE_KEY,
    DEFAULT_PREFERENCES
  );

  const setDesktopView = useCallback(
    (view: CalendarView) => {
      setField('desktopView', view);
    },
    [setField]
  );

  const setMobileView = useCallback(
    (view: CalendarView) => {
      setField('mobileView', view);
    },
    [setField]
  );

  const setColorMode = useCallback(
    (mode: ColorMode) => {
      setField('colorMode', mode);
    },
    [setField]
  );

  const setShowUnassigned = useCallback(
    (show: boolean) => {
      setField('showUnassigned', show);
    },
    [setField]
  );

  /**
   * Sync filter changes that should be persisted (colorMode, showUnassigned)
   */
  const syncFiltersToPreferences = useCallback(
    (filters: CalendarFiltersState) => {
      if (filters.colorMode !== preferences.colorMode) {
        setField('colorMode', filters.colorMode);
      }
      if (filters.showUnassigned !== preferences.showUnassigned) {
        setField('showUnassigned', filters.showUnassigned);
      }
    },
    [preferences.colorMode, preferences.showUnassigned, setField]
  );

  return useMemo(
    () => ({
      preferences,
      setDesktopView,
      setMobileView,
      setColorMode,
      setShowUnassigned,
      syncFiltersToPreferences,
    }),
    [
      preferences,
      setDesktopView,
      setMobileView,
      setColorMode,
      setShowUnassigned,
      syncFiltersToPreferences,
    ]
  );
}
