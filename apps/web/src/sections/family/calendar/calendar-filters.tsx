import type { FamilyMember, EventCategoryConfig } from '@family/shared';

import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export type MemberFilterType = 'all' | 'adults' | 'kids' | 'custom';

export type ColorMode = 'category' | 'member' | 'event' | 'calendar';

export type CalendarFiltersState = {
  memberFilter: MemberFilterType;
  selectedMemberIds: string[];
  showUnassigned: boolean;
  selectedCategoryIds: string[];
  colorMode: ColorMode;
};

type Props = {
  filters: CalendarFiltersState;
  familyMembers: FamilyMember[];
  eventCategories: EventCategoryConfig[];
  onFilterChange: (filters: CalendarFiltersState) => void;
  canReset: boolean;
  onReset: () => void;
};

export function CalendarFilters({
  filters,
  familyMembers,
  eventCategories,
  onFilterChange,
  canReset,
  onReset,
}: Props) {
  // Category popover state
  const [categoryAnchorEl, setCategoryAnchorEl] = useState<HTMLElement | null>(null);
  const categoryPopoverOpen = Boolean(categoryAnchorEl);

  // Color mode popover state
  const [colorModeAnchorEl, setColorModeAnchorEl] = useState<HTMLElement | null>(null);
  const colorModePopoverOpen = Boolean(colorModeAnchorEl);

  // Color mode options
  const colorModeOptions: { value: ColorMode; label: string; icon: 'mdi:tag' | 'solar:user-rounded-bold' | 'solar:calendar-date-bold' | 'mdi:palette' }[] = [
    { value: 'category', label: 'By Category', icon: 'mdi:tag' },
    { value: 'member', label: 'By Member', icon: 'solar:user-rounded-bold' },
    { value: 'event', label: 'By Google Event Color', icon: 'mdi:palette' },
    { value: 'calendar', label: 'By Calendar', icon: 'solar:calendar-date-bold' },
  ];

  // Handle color mode change
  const handleColorModeChange = useCallback(
    (mode: ColorMode) => {
      onFilterChange({
        ...filters,
        colorMode: mode,
      });
      setColorModeAnchorEl(null);
    },
    [filters, onFilterChange]
  );

  // Handle quick filter change (All/Adults/Kids)
  const handleQuickFilterChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newValue: MemberFilterType | null) => {
      if (newValue === null) return;

      if (newValue === 'all') {
        // Empty selection = show all
        onFilterChange({
          ...filters,
          memberFilter: 'all',
          selectedMemberIds: [],
          showUnassigned: true,
        });
      } else if (newValue === 'adults') {
        // Filter to adults only (non-child members)
        const adultIds = familyMembers.filter((m) => !isChildMember(m)).map((m) => m.id);
        onFilterChange({
          ...filters,
          memberFilter: 'adults',
          selectedMemberIds: adultIds,
          showUnassigned: false,
        });
      } else if (newValue === 'kids') {
        // Filter to kids only (child members)
        const kidIds = familyMembers.filter((m) => isChildMember(m)).map((m) => m.id);
        onFilterChange({
          ...filters,
          memberFilter: 'kids',
          selectedMemberIds: kidIds,
          showUnassigned: false,
        });
      }
    },
    [familyMembers, filters, onFilterChange]
  );

  // Handle individual member click - toggles selection (multi-select)
  const handleMemberToggle = useCallback(
    (memberId: string) => {
      const isSelected = filters.selectedMemberIds.includes(memberId);
      
      let newSelectedIds: string[];
      if (isSelected) {
        // Deselect this member
        newSelectedIds = filters.selectedMemberIds.filter((id) => id !== memberId);
      } else {
        // Add this member to selection
        newSelectedIds = [...filters.selectedMemberIds, memberId];
      }

      // If no one selected, go back to "all" (shows everything)
      if (newSelectedIds.length === 0) {
        onFilterChange({
          ...filters,
          memberFilter: 'all',
          selectedMemberIds: [],
          showUnassigned: true,
        });
        return;
      }

      // Custom selection
      onFilterChange({
        ...filters,
        memberFilter: 'custom',
        selectedMemberIds: newSelectedIds,
      });
    },
    [filters, onFilterChange]
  );

  // Handle category toggle
  const handleCategoryToggle = useCallback(
    (categoryId: string) => {
      const isSelected = filters.selectedCategoryIds.includes(categoryId);
      
      let newSelectedIds: string[];
      if (isSelected) {
        newSelectedIds = filters.selectedCategoryIds.filter((id) => id !== categoryId);
      } else {
        newSelectedIds = [...filters.selectedCategoryIds, categoryId];
      }

      onFilterChange({
        ...filters,
        selectedCategoryIds: newSelectedIds,
      });
    },
    [filters, onFilterChange]
  );

  // Handle "All Categories" click
  const handleAllCategories = useCallback(() => {
    onFilterChange({
      ...filters,
      selectedCategoryIds: [],
    });
    setCategoryAnchorEl(null);
  }, [filters, onFilterChange]);

  // Get selected category count for badge
  const selectedCategoryCount = filters.selectedCategoryIds.length;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      {/* Member avatar toggles - LEFT */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {familyMembers.map((member) => {
          const isSelected = filters.selectedMemberIds.includes(member.id);
          const noOneSelected = filters.selectedMemberIds.length === 0;
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
                    // Full opacity when no one selected (showing all) or when this member is selected
                    opacity: noOneSelected || isSelected ? 1 : 0.4,
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

      {/* Quick filter buttons - RIGHT */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Category dropdown */}
        <Button
          size="small"
          color="inherit"
          onClick={(e) => setCategoryAnchorEl(e.currentTarget)}
          endIcon={
            <Badge 
              badgeContent={selectedCategoryCount} 
              color="primary"
              sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }}
            >
              <Iconify icon="eva:chevron-down-fill" width={16} />
            </Badge>
          }
          sx={{
            px: 1.5,
            py: 0.5,
            bgcolor: selectedCategoryCount > 0 ? 'action.selected' : 'transparent',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <Iconify icon="mdi:tag" width={18} sx={{ mr: 0.5 }} />
          Categories
        </Button>

        <Popover
          open={categoryPopoverOpen}
          anchorEl={categoryAnchorEl}
          onClose={() => setCategoryAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{
            paper: {
              sx: { p: 1, minWidth: 200, maxWidth: 280 },
            },
          }}
        >
          {/* All Categories button */}
          <Button
            fullWidth
            size="small"
            onClick={handleAllCategories}
            sx={{
              justifyContent: 'flex-start',
              px: 1,
              py: 0.75,
              mb: 0.5,
              bgcolor: selectedCategoryCount === 0 ? 'action.selected' : 'transparent',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Iconify icon="solar:check-circle-bold" width={20} sx={{ mr: 1, opacity: selectedCategoryCount === 0 ? 1 : 0 }} />
            All Categories
          </Button>

          {/* Category list */}
          {eventCategories.map((category) => {
            const isSelected = filters.selectedCategoryIds.includes(category.id);
            return (
              <Box
                key={category.id}
                onClick={() => handleCategoryToggle(category.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  px: 1,
                  py: 0.75,
                  borderRadius: 1,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Checkbox
                  size="small"
                  checked={isSelected}
                  sx={{ p: 0, mr: 1 }}
                />
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: category.color || '#637381',
                    mr: 1,
                    flexShrink: 0,
                  }}
                />
                <Typography variant="body2" noWrap>
                  {category.label}
                </Typography>
              </Box>
            );
          })}
        </Popover>

        {/* Color mode dropdown */}
        <Button
          size="small"
          color="inherit"
          onClick={(e) => setColorModeAnchorEl(e.currentTarget)}
          endIcon={<Iconify icon="eva:chevron-down-fill" width={16} />}
          sx={{
            px: 1.5,
            py: 0.5,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <Iconify icon="mdi:palette" width={18} sx={{ mr: 0.5 }} />
          Color
        </Button>

        <Popover
          open={colorModePopoverOpen}
          anchorEl={colorModeAnchorEl}
          onClose={() => setColorModeAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{
            paper: {
              sx: { p: 1, minWidth: 160 },
            },
          }}
        >
          {colorModeOptions.map((option) => (
            <Box
              key={option.value}
              onClick={() => handleColorModeChange(option.value)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                px: 1.5,
                py: 1,
                borderRadius: 1,
                cursor: 'pointer',
                bgcolor: filters.colorMode === option.value ? 'action.selected' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Iconify
                icon={filters.colorMode === option.value ? 'solar:check-circle-bold' : option.icon}
                width={20}
                sx={{ mr: 1.5, color: filters.colorMode === option.value ? 'primary.main' : 'text.secondary' }}
              />
              <Typography variant="body2">
                {option.label}
              </Typography>
            </Box>
          ))}
        </Popover>

        <ToggleButtonGroup
          exclusive
          size="small"
          value={filters.memberFilter === 'custom' ? null : filters.memberFilter}
          onChange={handleQuickFilterChange}
          aria-label="member filter"
        >
          <ToggleButton value="all" aria-label="all members">
            <Iconify icon="solar:users-group-rounded-bold" width={18} />
            All
          </ToggleButton>
          <ToggleButton value="adults" aria-label="adults only">
            <Iconify icon="solar:user-rounded-bold" width={18} />
            Adults
          </ToggleButton>
          <ToggleButton value="kids" aria-label="kids only">
            <Iconify icon="solar:user-id-bold" width={18} />
            Kids
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Unassigned toggle - only show when not in "All" mode */}
        {filters.memberFilter !== 'all' && (
          <ToggleButton
            size="small"
            value="unassigned"
            selected={filters.showUnassigned}
            onChange={() => {
              onFilterChange({
                ...filters,
                showUnassigned: !filters.showUnassigned,
              });
            }}
            aria-label="show unassigned"
          >
            <Iconify icon="solar:info-circle-bold" width={18} />
            Unassigned
          </ToggleButton>
        )}

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
    </Box>
  );
}

// ----------------------------------------------------------------------
// Helper function to determine if a member is a child
// Uses the isChild field on FamilyMember
// ----------------------------------------------------------------------

function isChildMember(member: FamilyMember): boolean {
  return member.isChild;
}

// Export for use in other components
export { isChildMember };
