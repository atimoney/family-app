import type { InviteValidation } from '@family/shared';

import { useState, useEffect, useCallback } from 'react';

import { acceptInvite, declineInvite, validateInvite } from '../api';

// ----------------------------------------------------------------------

type UseInviteValidationReturn = {
  validation: InviteValidation | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  accept: () => Promise<{ success: boolean; familyId?: string }>;
  decline: () => Promise<boolean>;
  accepting: boolean;
  declining: boolean;
};

export function useInviteValidation(token: string | null): UseInviteValidationReturn {
  const [validation, setValidation] = useState<InviteValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  const fetchValidation = useCallback(async () => {
    if (!token) {
      setValidation(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await validateInvite(token);
      setValidation(result);
    } catch (err) {
      console.error('Failed to validate invite:', err);
      setError(err instanceof Error ? err : new Error('Failed to validate invite'));
      setValidation({ valid: false, reason: 'not_found' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchValidation();
  }, [fetchValidation]);

  const accept = useCallback(async (): Promise<{ success: boolean; familyId?: string }> => {
    if (!token) return { success: false };
    try {
      setAccepting(true);
      setError(null);
      const result = await acceptInvite(token);
      return result;
    } catch (err) {
      console.error('Failed to accept invite:', err);
      setError(err instanceof Error ? err : new Error('Failed to accept invite'));
      return { success: false };
    } finally {
      setAccepting(false);
    }
  }, [token]);

  const decline = useCallback(async (): Promise<boolean> => {
    if (!token) return false;
    try {
      setDeclining(true);
      setError(null);
      await declineInvite(token);
      return true;
    } catch (err) {
      console.error('Failed to decline invite:', err);
      setError(err instanceof Error ? err : new Error('Failed to decline invite'));
      return false;
    } finally {
      setDeclining(false);
    }
  }, [token]);

  return {
    validation,
    loading,
    error,
    refresh: fetchValidation,
    accept,
    decline,
    accepting,
    declining,
  };
}
