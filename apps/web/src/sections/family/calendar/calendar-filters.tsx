import type { FamilyMember } from '@family/shared';

import { useCallback } from 'react';

import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export type MemberFilterType = 'all' | 'adults' | 'kids' | 'custom';

export type CalendarFiltersState = {
  memberFilter: MemberFilterType;
  selectedMemberIds: string[];
};

type Props = {
  filters: CalendarFiltersState;
  familyMembers: FamilyMember[];
  onFilterChange: (filters: CalendarFiltersState) => void;
  canReset: boolean;
  onReset: () => void;
};

export function CalendarFilters({
  filters,
  familyMembers,
  onFilterChange,
  canReset,
  onReset,
}: Props) {
  // Handle quick filter change (All/Adults/Kids)
  const handleQuickFilterChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newValue: MemberFilterType | null) => {
      if (newValue === null) return;

      if (newValue === 'all') {
        onFilterChange({
          memberFilter: 'all',
          selectedMemberIds: familyMembers.map((m) => m.id),
        });
      } else if (newValue === 'adults') {
        // Filter to adults only (non-child members)
        const adultIds = familyMembers.filter((m) => !isChildMember(m)).map((m) => m.id);
        onFilterChange({
          memberFilter: 'adults',
          selectedMemberIds: adultIds,
        });
      } else if (newValue === 'kids') {
        // Filter to kids only (child members)
        const kidIds = familyMembers.filter((m) => isChildMember(m)).map((m) => m.id);
        onFilterChange({
          memberFilter: 'kids',
          selectedMemberIds: kidIds,
        });
      }
    },
    [familyMembers, onFilterChange]
  );

  // Handle individual member toggle
  const handleMemberToggle = useCallback(
    (memberId: string) => {
      const isSelected = filters.selectedMemberIds.includes(memberId);
      const newSelectedIds = isSelected
        ? filters.selectedMemberIds.filter((id) => id !== memberId)
        : [...filters.selectedMemberIds, memberId];

      // Determine the quick filter state based on selection
      let memberFilter: MemberFilterType = 'custom';
      if (newSelectedIds.length === familyMembers.length) {
        memberFilter = 'all';
      } else if (newSelectedIds.length === 0) {
        // If all deselected, default back to all
        onFilterChange({
          memberFilter: 'all',
          selectedMemberIds: familyMembers.map((m) => m.id),
        });
        return;
      }

      onFilterChange({
        memberFilter,
        selectedMemberIds: newSelectedIds,
      });
    },
    [filters.selectedMemberIds, familyMembers, onFilterChange]
  );

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      {/* Quick filter buttons */}
      <ToggleButtonGroup
        exclusive
        size="small"
        value={filters.memberFilter === 'custom' ? null : filters.memberFilter}
        onChange={handleQuickFilterChange}
        aria-label="member filter"
      >
        <ToggleButton value="all" aria-label="all members">
          <Iconify icon="solar:users-group-rounded-bold" sx={{ mr: 0.5 }} />
          All
        </ToggleButton>
        <ToggleButton value="adults" aria-label="adults only">
          <Iconify icon="solar:user-rounded-bold" sx={{ mr: 0.5 }} />
          Adults
        </ToggleButton>
        <ToggleButton value="kids" aria-label="kids only">
          <Iconify icon="solar:user-id-bold" sx={{ mr: 0.5 }} />
          Kids
        </ToggleButton>
      </ToggleButtonGroup>

      {/* Member avatar toggles */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {familyMembers.map((member) => {
          const isSelected = filters.selectedMemberIds.includes(member.id);
          const memberName = member.displayName || member.profile?.displayName || 'Member';
          const memberColor = member.color || '#637381';

          return (
            <Tooltip key={member.id} title={memberName}>
              <Box
                onClick={() => handleMemberToggle(member.id)}
                sx={{
                  cursor: 'pointer',
                  position: 'relative',
                  p: 0.25,
                  borderRadius: '50%',
                  border: '2px solid',
                  borderColor: isSelected ? memberColor : 'transparent',
                  bgcolor: isSelected ? alpha(memberColor, 0.08) : 'transparent',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    bgcolor: alpha(memberColor, 0.16),
                  },
                }}
              >
                <Avatar
                  alt={memberName}
                  src={member.profile?.avatarUrl || undefined}
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: memberColor,
                    opacity: isSelected ? 1 : 0.4,
                    transition: 'opacity 0.2s ease-in-out',
                    fontSize: '0.875rem',
                  }}
                >
                  {memberName.charAt(0).toUpperCase()}
                </Avatar>
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      {/* Reset button */}
      {canReset && (
        <Tooltip title="Reset filters">
          <IconButton size="small" onClick={onReset}>
            <Badge color="error" variant="dot">
              <Iconify icon="solar:restart-bold" width={18} />
            </Badge>
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

// ----------------------------------------------------------------------
// Helper function to determine if a member is a child
// This can be enhanced later with an actual isChild field on FamilyMember
// For now, we use the role: 'member' + no profile email as a heuristic
// or you can add an isChild field to the FamilyMember type
// ----------------------------------------------------------------------

function isChildMember(member: FamilyMember): boolean {
  // TODO: Replace with actual isChild field when available
  // For now, return false - all members are treated as adults
  // You can customize this logic based on your requirements:
  // - Check for a specific role
  // - Check displayName patterns
  // - Add isChild field to FamilyMember model
  return false;
}

// Export for use in other components
export { isChildMember };
