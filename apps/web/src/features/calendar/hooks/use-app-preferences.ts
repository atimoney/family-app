import { useMemo, useCallback } from 'react';
import { useLocalStorage } from 'minimal-shared/hooks';
import { getStorage as getStorageValue } from 'minimal-shared/utils';

// ----------------------------------------------------------------------

const STORAGE_KEY = 'family-app-preferences';

/**
 * App-wide preferences that are persisted to localStorage
 */
export type AppPreferences = {
  /**
   * Dashboard mode indicates the device is shared (e.g., wall-mounted tablet).
   * When enabled, changes should NOT be attributed to the logged-in user automatically.
   * Users should be prompted to identify themselves or changes marked as "dashboard".
   */
  dashboardMode: boolean;
  /**
   * Optional custom name for the dashboard device (e.g., "Kitchen Display")
   */
  dashboardDeviceName: string | null;
};

const DEFAULT_PREFERENCES: AppPreferences = {
  dashboardMode: false,
  dashboardDeviceName: null,
};

/**
 * Get stored app preferences synchronously (for initial render)
 * This avoids the async loading delay of useLocalStorage
 */
export function getStoredAppPreferences(): AppPreferences {
  const stored = getStorageValue<AppPreferences>(STORAGE_KEY);
  return stored ? { ...DEFAULT_PREFERENCES, ...stored } : DEFAULT_PREFERENCES;
}

export type UseAppPreferencesReturn = {
  preferences: AppPreferences;
  isDashboardMode: boolean;
  dashboardDeviceName: string | null;
  setDashboardMode: (enabled: boolean) => void;
  setDashboardDeviceName: (name: string | null) => void;
};

/**
 * Hook to manage app-wide preferences including dashboard mode.
 * 
 * Dashboard mode is used when the app is running on a shared device
 * (like a wall-mounted tablet or family hub). When enabled:
 * - Event changes will NOT be automatically attributed to the logged-in user
 * - Changes will be marked with editSource: 'dashboard'
 * - The UI may show a reminder that it's in dashboard mode
 * 
 * This ensures accountability when multiple family members use the same device.
 */
export function useAppPreferences(): UseAppPreferencesReturn {
  const { state: preferences, setField } = useLocalStorage<AppPreferences>(
    STORAGE_KEY,
    DEFAULT_PREFERENCES
  );

  const setDashboardMode = useCallback(
    (enabled: boolean) => {
      setField('dashboardMode', enabled);
    },
    [setField]
  );

  const setDashboardDeviceName = useCallback(
    (name: string | null) => {
      setField('dashboardDeviceName', name);
    },
    [setField]
  );

  return useMemo(
    () => ({
      preferences,
      isDashboardMode: preferences.dashboardMode,
      dashboardDeviceName: preferences.dashboardDeviceName,
      setDashboardMode,
      setDashboardDeviceName,
    }),
    [preferences, setDashboardMode, setDashboardDeviceName]
  );
}
