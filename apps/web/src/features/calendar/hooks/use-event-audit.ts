import type { EventAuditInfo, EventEditSource } from '../types';

import { useMemo, useCallback } from 'react';

import { useAuthContext } from 'src/auth/hooks';

import { useAppPreferences, getStoredAppPreferences } from './use-app-preferences';

// ----------------------------------------------------------------------

export type UseEventAuditReturn = {
  /**
   * Whether the app is in dashboard mode (shared device)
   */
  isDashboardMode: boolean;
  /**
   * Create audit info for the current context.
   * When in dashboard mode, modifiedBy will be null and editSource will be 'dashboard'.
   * When in normal mode, modifiedBy will be the current user's ID.
   */
  createAuditInfo: (editSource?: EventEditSource, changeNote?: string | null) => EventAuditInfo;
  /**
   * Create audit info synchronously without hooks (for use in callbacks)
   * Uses getStoredAppPreferences() for immediate value access
   */
  getAuditInfo: (editSource?: EventEditSource, changeNote?: string | null) => EventAuditInfo;
};

/**
 * Hook to generate event audit information based on the current user
 * and dashboard mode settings.
 * 
 * When in dashboard mode:
 * - modifiedBy is set to null (we don't know who made the change)
 * - editSource is set to 'dashboard'
 * - isDashboardMode flag is set to true
 * 
 * When in normal mode:
 * - modifiedBy is set to the current user's profile ID
 * - modifiedByName is set to the user's display name or email
 * - editSource is 'user' by default
 * - isDashboardMode is false
 * 
 * This ensures proper accountability tracking for all event modifications.
 */
export function useEventAudit(): UseEventAuditReturn {
  const { user } = useAuthContext();
  const { isDashboardMode } = useAppPreferences();

  const createAuditInfo = useCallback(
    (editSource?: EventEditSource, changeNote?: string | null): EventAuditInfo => {
      const now = new Date().toISOString();

      if (isDashboardMode) {
        return {
          modifiedBy: null,
          modifiedByName: null,
          modifiedAt: now,
          editSource: editSource || 'dashboard',
          isDashboardMode: true,
          changeNote: changeNote || null,
        };
      }

      // Normal mode - attribute to current user
      return {
        modifiedBy: user?.id || null,
        modifiedByName: user?.displayName || user?.email || null,
        modifiedAt: now,
        editSource: editSource || 'user',
        isDashboardMode: false,
        changeNote: changeNote || null,
      };
    },
    [isDashboardMode, user]
  );

  /**
   * Synchronous version that reads preferences directly from localStorage.
   * Useful in callbacks where you need the latest value immediately.
   */
  const getAuditInfo = useCallback(
    (editSource?: EventEditSource, changeNote?: string | null): EventAuditInfo => {
      const now = new Date().toISOString();
      const prefs = getStoredAppPreferences();

      if (prefs.dashboardMode) {
        return {
          modifiedBy: null,
          modifiedByName: null,
          modifiedAt: now,
          editSource: editSource || 'dashboard',
          isDashboardMode: true,
          changeNote: changeNote || null,
        };
      }

      // Normal mode - attribute to current user
      return {
        modifiedBy: user?.id || null,
        modifiedByName: user?.displayName || user?.email || null,
        modifiedAt: now,
        editSource: editSource || 'user',
        isDashboardMode: false,
        changeNote: changeNote || null,
      };
    },
    [user]
  );

  return useMemo(
    () => ({
      isDashboardMode,
      createAuditInfo,
      getAuditInfo,
    }),
    [isDashboardMode, createAuditInfo, getAuditInfo]
  );
}
