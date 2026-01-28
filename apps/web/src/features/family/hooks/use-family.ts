import type { FamilyRole, FamilyMember, FamilyInvite, FamilyWithMembers } from '@family/shared';

import { useState, useEffect, useCallback } from 'react';

import {
  getFamily,
  leaveFamily,
  createFamily,
  updateFamily,
  deleteFamily,
  updateMember,
  removeMember,
  createInvite,
  revokeInvite,
  getFamilyInvites,
  transferOwnership,
} from '../api';

// ----------------------------------------------------------------------

type UseFamilyReturn = {
  family: FamilyWithMembers | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  create: (name: string) => Promise<FamilyWithMembers | null>;
  update: (name: string) => Promise<boolean>;
  remove: () => Promise<boolean>;
  leave: () => Promise<boolean>;
  transfer: (newOwnerId: string) => Promise<boolean>;
};

export function useFamily(): UseFamilyReturn {
  const [family, setFamily] = useState<FamilyWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchFamily = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getFamily();
      setFamily(result.family);
    } catch (err) {
      console.error('Failed to fetch family:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch family'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFamily();
  }, [fetchFamily]);

  const create = useCallback(async (name: string): Promise<FamilyWithMembers | null> => {
    try {
      setError(null);
      const newFamily = await createFamily(name);
      setFamily(newFamily);
      return newFamily;
    } catch (err) {
      console.error('Failed to create family:', err);
      setError(err instanceof Error ? err : new Error('Failed to create family'));
      return null;
    }
  }, []);

  const update = useCallback(
    async (name: string): Promise<boolean> => {
      if (!family) return false;
      try {
        setError(null);
        await updateFamily(family.id, name);
        setFamily((prev) => (prev ? { ...prev, name } : null));
        return true;
      } catch (err) {
        console.error('Failed to update family:', err);
        setError(err instanceof Error ? err : new Error('Failed to update family'));
        return false;
      }
    },
    [family]
  );

  const remove = useCallback(async (): Promise<boolean> => {
    if (!family) return false;
    try {
      setError(null);
      await deleteFamily(family.id);
      setFamily(null);
      return true;
    } catch (err) {
      console.error('Failed to delete family:', err);
      setError(err instanceof Error ? err : new Error('Failed to delete family'));
      return false;
    }
  }, [family]);

  const leave = useCallback(async (): Promise<boolean> => {
    if (!family) return false;
    try {
      setError(null);
      await leaveFamily(family.id);
      setFamily(null);
      return true;
    } catch (err) {
      console.error('Failed to leave family:', err);
      setError(err instanceof Error ? err : new Error('Failed to leave family'));
      return false;
    }
  }, [family]);

  const transfer = useCallback(
    async (newOwnerId: string): Promise<boolean> => {
      if (!family) return false;
      try {
        setError(null);
        await transferOwnership(family.id, newOwnerId);
        await fetchFamily(); // Refresh to get updated roles
        return true;
      } catch (err) {
        console.error('Failed to transfer ownership:', err);
        setError(err instanceof Error ? err : new Error('Failed to transfer ownership'));
        return false;
      }
    },
    [family, fetchFamily]
  );

  return {
    family,
    loading,
    error,
    refresh: fetchFamily,
    create,
    update,
    remove,
    leave,
    transfer,
  };
}

// ----------------------------------------------------------------------

type UseFamilyMembersReturn = {
  members: FamilyMember[];
  loading: boolean;
  error: Error | null;
  updateMemberRole: (memberId: string, role: Exclude<FamilyRole, 'owner'>) => Promise<boolean>;
  updateMemberDetails: (
    memberId: string,
    data: { displayName?: string | null; color?: string | null }
  ) => Promise<boolean>;
  removeMember: (memberId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
};

export function useFamilyMembers(familyId: string | null): UseFamilyMembersReturn {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!familyId) {
      setMembers([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      // Members are already included in family response, but this allows independent refresh
      const result = await getFamily();
      if (result.family) {
        setMembers(result.family.members);
      }
    } catch (err) {
      console.error('Failed to fetch members:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch members'));
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    if (familyId) {
      fetchMembers();
    }
  }, [familyId, fetchMembers]);

  const handleUpdateRole = useCallback(
    async (memberId: string, role: Exclude<FamilyRole, 'owner'>): Promise<boolean> => {
      if (!familyId) return false;
      try {
        setError(null);
        const updated = await updateMember(familyId, memberId, { role });
        setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
        return true;
      } catch (err) {
        console.error('Failed to update member role:', err);
        setError(err instanceof Error ? err : new Error('Failed to update member role'));
        return false;
      }
    },
    [familyId]
  );

  const handleUpdateDetails = useCallback(
    async (
      memberId: string,
      data: { displayName?: string | null; color?: string | null }
    ): Promise<boolean> => {
      if (!familyId) return false;
      try {
        setError(null);
        const updated = await updateMember(familyId, memberId, data);
        setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
        return true;
      } catch (err) {
        console.error('Failed to update member:', err);
        setError(err instanceof Error ? err : new Error('Failed to update member'));
        return false;
      }
    },
    [familyId]
  );

  const handleRemove = useCallback(
    async (memberId: string): Promise<boolean> => {
      if (!familyId) return false;
      try {
        setError(null);
        await removeMember(familyId, memberId);
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
        return true;
      } catch (err) {
        console.error('Failed to remove member:', err);
        setError(err instanceof Error ? err : new Error('Failed to remove member'));
        return false;
      }
    },
    [familyId]
  );

  return {
    members,
    loading,
    error,
    updateMemberRole: handleUpdateRole,
    updateMemberDetails: handleUpdateDetails,
    removeMember: handleRemove,
    refresh: fetchMembers,
  };
}

// ----------------------------------------------------------------------

type UseFamilyInvitesReturn = {
  invites: FamilyInvite[];
  loading: boolean;
  error: Error | null;
  create: (data: {
    email?: string | null;
    role?: Exclude<FamilyRole, 'owner'>;
    expiresInDays?: number;
  }) => Promise<FamilyInvite | null>;
  revoke: (inviteId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
};

export function useFamilyInvites(familyId: string | null): UseFamilyInvitesReturn {
  const [invites, setInvites] = useState<FamilyInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchInvites = useCallback(async () => {
    if (!familyId) {
      setInvites([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await getFamilyInvites(familyId);
      setInvites(result);
    } catch (err) {
      console.error('Failed to fetch invites:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch invites'));
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    if (familyId) {
      fetchInvites();
    }
  }, [familyId, fetchInvites]);

  const create = useCallback(
    async (data: {
      email?: string | null;
      role?: Exclude<FamilyRole, 'owner'>;
      expiresInDays?: number;
    }): Promise<FamilyInvite | null> => {
      if (!familyId) return null;
      try {
        setError(null);
        const invite = await createInvite(familyId, data);
        setInvites((prev) => [invite, ...prev]);
        return invite;
      } catch (err) {
        console.error('Failed to create invite:', err);
        setError(err instanceof Error ? err : new Error('Failed to create invite'));
        return null;
      }
    },
    [familyId]
  );

  const revoke = useCallback(
    async (inviteId: string): Promise<boolean> => {
      if (!familyId) return false;
      try {
        setError(null);
        await revokeInvite(familyId, inviteId);
        setInvites((prev) => prev.filter((i) => i.id !== inviteId));
        return true;
      } catch (err) {
        console.error('Failed to revoke invite:', err);
        setError(err instanceof Error ? err : new Error('Failed to revoke invite'));
        return false;
      }
    },
    [familyId]
  );

  return {
    invites,
    loading,
    error,
    create,
    revoke,
    refresh: fetchInvites,
  };
}
