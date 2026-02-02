import type { FamilyMember } from '@family/shared';

import { useMemo } from 'react';

// ----------------------------------------------------------------------

/**
 * Create a map for quick family member lookup by ID.
 * Useful for resolving member assignments in events, tasks, etc.
 */
export function useMemberLookup(members: FamilyMember[]): Map<string, FamilyMember> {
  return useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
}
