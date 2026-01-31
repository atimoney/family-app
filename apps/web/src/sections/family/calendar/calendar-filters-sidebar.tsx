import type { FamilyMember, EventCategoryConfig } from '@family/shared';
import type { IDatePickerControl } from 'src/types/common';
import type { CalendarEventItem } from 'src/features/calendar/types';

import { orderBy } from 'es-toolkit';
import { useMemo, useCallback } from 'react';

import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Switch from '@mui/material/Switch';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { fDate, fIsAfter, fDateTime } from 'src/utils/format-time';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';

import { isChildMember, type ColorMode, type MemberFilterType, type CalendarFiltersState } from './calendar-filters';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: () => void;
  filters: CalendarFiltersState;
  familyMembers: FamilyMember[];
  eventCategories: EventCategoryConfig[];
  events: CalendarEventItem[];
  canReset: boolean;
  onFilterChange: (filters: CalendarFiltersState) => void;
  onReset: () => void;
  onClickEvent: (eventId: string) => void;
};

export function CalendarFiltersSidebar({
  open,
  onClose,
  filters,
  familyMembers,
  eventCategories,
  events,
  canReset,
  onFilterChange,
  onReset,
  onClickEvent,
}: Props) {
  const dateError = fIsAfter(filters.startDate, filters.endDate);

  // Handle date range changes
  const handleFilterStartDate = useCallback(
    (newValue: IDatePickerControl) => {
      onFilterChange({ ...filters, startDate: newValue });
    },
    [filters, onFilterChange]
  );

  const handleFilterEndDate = useCallback(
    (newValue: IDatePickerControl) => {
      onFilterChange({ ...filters, endDate: newValue });
    },
    [filters, onFilterChange]
  );

  // Handle category toggle
  const handleCategoryToggle = useCallback(
    (categoryId: string) => {
      const isSelected = filters.selectedCategoryIds.includes(categoryId);
      const newSelectedIds = isSelected
        ? filters.selectedCategoryIds.filter((id) => id !== categoryId)
        : [...filters.selectedCategoryIds, categoryId];
      
      onFilterChange({ ...filters, selectedCategoryIds: newSelectedIds });
    },
    [filters, onFilterChange]
  );

  // Handle show unassigned toggle
  const handleShowUnassignedToggle = useCallback(() => {
    onFilterChange({ ...filters, showUnassigned: !filters.showUnassigned });
  }, [filters, onFilterChange]);

  // Get member info for event display
  const getMemberForEvent = useCallback(
    (event: CalendarEventItem): FamilyMember | null => {
      const assignments = event.extendedProps?.metadata?.familyAssignments;
      if (!assignments?.primaryFamilyMemberId) return null;
      return familyMembers.find((m) => m.id === assignments.primaryFamilyMemberId) || null;
    },
    [familyMembers]
  );

  // Sorted events for display
  const sortedEvents = useMemo(
    () => orderBy(events, ['start'], ['desc']),
    [events]
  );

  // Handle quick filter change (All/Adults/Kids)
  const handleQuickFilterChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newValue: MemberFilterType | null) => {
      if (newValue === null) return;

      if (newValue === 'all') {
        onFilterChange({
          ...filters,
          memberFilter: 'all',
          selectedMemberIds: [],
          showUnassigned: true,
        });
      } else if (newValue === 'adults') {
        const adultIds = familyMembers.filter((m) => !isChildMember(m)).map((m) => m.id);
        onFilterChange({
          ...filters,
          memberFilter: 'adults',
          selectedMemberIds: adultIds,
          showUnassigned: false,
        });
      } else if (newValue === 'kids') {
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
        newSelectedIds = filters.selectedMemberIds.filter((id) => id !== memberId);
      } else {
        newSelectedIds = [...filters.selectedMemberIds, memberId];
      }

      if (newSelectedIds.length === 0) {
        onFilterChange({
          ...filters,
          memberFilter: 'all',
          selectedMemberIds: [],
          showUnassigned: true,
        });
        return;
      }

      onFilterChange({
        ...filters,
        memberFilter: 'custom',
        selectedMemberIds: newSelectedIds,
      });
    },
    [filters, onFilterChange]
  );

  const renderHead = () => (
    <>
      <Box
        sx={{
          py: 2,
          pr: 1,
          pl: 2.5,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Filters
        </Typography>

        <Tooltip title="Reset all filters">
          <IconButton onClick={onReset}>
            <Badge color="error" variant="dot" invisible={!canReset}>
              <Iconify icon="solar:restart-bold" />
            </Badge>
          </IconButton>
        </Tooltip>

        <IconButton onClick={onClose}>
          <Iconify icon="mingcute:close-line" />
        </IconButton>
      </Box>

      <Divider sx={{ borderStyle: 'dashed' }} />
    </>
  );

  // Mobile-only: Quick member filters (shown in sidebar on mobile, hidden on desktop)
  const renderMemberFilters = () => (
    <Box
      sx={{
        my: 3,
        px: 2.5,
        display: { xs: 'block', sm: 'none' },
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
        Family Members
      </Typography>

      {/* Member avatars */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
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
                    width: 40,
                    height: 40,
                    bgcolor: memberColor,
                    opacity: noOneSelected || isSelected ? 1 : 0.4,
                    transition: 'opacity 0.2s ease-in-out',
                    fontSize: '1rem',
                  }}
                >
                  {memberName.charAt(0).toUpperCase()}
                </Avatar>
                {member.color && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      bgcolor: member.color,
                      border: '2px solid',
                      borderColor: 'background.paper',
                    }}
                  />
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      {/* Quick filter toggle buttons */}
      <ToggleButtonGroup
        exclusive
        size="small"
        fullWidth
        value={filters.memberFilter === 'custom' ? null : filters.memberFilter}
        onChange={handleQuickFilterChange}
        aria-label="member filter"
        sx={{ mb: 1 }}
      >
        <ToggleButton value="all" aria-label="all members">
          All
        </ToggleButton>
        <ToggleButton value="adults" aria-label="adults only">
          Adults
        </ToggleButton>
        <ToggleButton value="kids" aria-label="kids only">
          Kids
        </ToggleButton>
      </ToggleButtonGroup>

      {/* Unassigned toggle - only show when not in "All" mode */}
      {filters.memberFilter !== 'all' && (
        <ToggleButton
          size="small"
          fullWidth
          value="unassigned"
          selected={filters.showUnassigned}
          onChange={() => {
            onFilterChange({
              ...filters,
              showUnassigned: !filters.showUnassigned,
            });
          }}
          aria-label="show unassigned"
          sx={{ mt: 1 }}
        >
          <Iconify icon="solar:info-circle-bold" width={18} sx={{ mr: 0.5 }} />
          Show Unassigned
        </ToggleButton>
      )}
    </Box>
  );

  // Color mode options for mobile
  const colorModeOptions: { value: ColorMode; label: string; icon: 'mdi:tag' | 'solar:user-rounded-bold' | 'solar:calendar-date-bold' | 'mdi:palette' }[] = [
    { value: 'category', label: 'By Category', icon: 'mdi:tag' },
    { value: 'member', label: 'By Member', icon: 'solar:user-rounded-bold' },
    { value: 'event', label: 'By Google Event Color', icon: 'mdi:palette' },
    { value: 'calendar', label: 'By Calendar', icon: 'solar:calendar-date-bold' },
  ];

  const handleColorModeChange = useCallback(
    (mode: ColorMode) => {
      onFilterChange({
        ...filters,
        colorMode: mode,
      });
    },
    [filters, onFilterChange]
  );

  // Mobile-only: Color mode selector
  const renderColorMode = () => (
    <Box
      sx={{
        mb: 3,
        px: 2.5,
        display: { xs: 'block', sm: 'none' },
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
        Event Colors
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
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
      </Box>
    </Box>
  );

  const renderDateRange = () => (
    <Box
      sx={{
        my: 3,
        px: 2.5,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
        Date Range
      </Typography>

      <DatePicker
        label="Start date"
        value={filters.startDate}
        onChange={handleFilterStartDate}
        sx={{ mb: 2.5 }}
      />

      <DatePicker
        label="End date"
        value={filters.endDate}
        onChange={handleFilterEndDate}
        slotProps={{
          textField: {
            error: dateError,
            helperText: dateError ? 'End date must be later than start date' : null,
          },
        }}
      />
    </Box>
  );

  const renderCategories = () => (
    <Box
      sx={{
        mb: 3,
        px: 2.5,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
        Categories
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
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
                sx={{ p: 0, mr: 1.5 }}
              />
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  bgcolor: category.color || '#637381',
                  mr: 1.5,
                  flexShrink: 0,
                }}
              />
              <Typography variant="body2" noWrap>
                {category.label}
              </Typography>
            </Box>
          );
        })}

        {eventCategories.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary', py: 1 }}>
            No categories configured
          </Typography>
        )}
      </Box>
    </Box>
  );

  const renderOptions = () => (
    <Box
      sx={{
        mb: 3,
        px: 2.5,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Options
      </Typography>

      <FormControlLabel
        control={
          <Switch
            checked={filters.showUnassigned}
            onChange={handleShowUnassignedToggle}
          />
        }
        label="Show unassigned events"
        sx={{ ml: 0 }}
      />
    </Box>
  );

  const renderEvents = () => (
    <Box sx={{ px: 2.5 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Events ({events.length})
      </Typography>

      <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {sortedEvents.slice(0, 50).map((event) => {
          const member = getMemberForEvent(event);
          const eventColor = event.backgroundColor || event.extendedProps?.metadata?.category 
            ? eventCategories.find((c) => c.name === event.extendedProps?.metadata?.category)?.color 
            : null;

          return (
            <li key={event.id}>
              <ListItemButton
                onClick={() => {
                  onClickEvent(event.id);
                  onClose();
                }}
                sx={[
                  (theme) => ({ 
                    py: 1.5, 
                    px: 1,
                    borderBottom: `dashed 1px ${theme.vars.palette.divider}`,
                    borderRadius: 0,
                  }),
                ]}
              >
                <Box
                  sx={{
                    top: 16,
                    left: 0,
                    width: 0,
                    height: 0,
                    position: 'absolute',
                    borderRight: '10px solid transparent',
                    borderTop: `10px solid ${eventColor || event.backgroundColor || '#637381'}`,
                  }}
                />

                {member && (
                  <Avatar
                    alt={member.displayName || 'Member'}
                    src={member.profile?.avatarUrl || undefined}
                    sx={{
                      width: 28,
                      height: 28,
                      mr: 1.5,
                      bgcolor: member.color || 'grey.400',
                      fontSize: '0.75rem',
                    }}
                  >
                    {(member.displayName || 'M').charAt(0).toUpperCase()}
                  </Avatar>
                )}

                <ListItemText
                  primary={
                    event.allDay
                      ? fDate(event.start)
                      : `${fDateTime(event.start)}${event.end ? ` - ${fDateTime(event.end)}` : ''}`
                  }
                  secondary={event.title}
                  slotProps={{
                    primary: {
                      sx: { typography: 'caption', color: 'text.disabled' },
                    },
                    secondary: {
                      sx: { mt: 0.5, color: 'text.primary', typography: 'subtitle2' },
                    },
                  }}
                />
              </ListItemButton>
            </li>
          );
        })}

        {events.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}>
            No events found
          </Typography>
        )}

        {events.length > 50 && (
          <Typography variant="caption" sx={{ color: 'text.secondary', py: 1, display: 'block', textAlign: 'center' }}>
            Showing first 50 of {events.length} events
          </Typography>
        )}
      </Box>
    </Box>
  );

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        backdrop: { invisible: true },
        paper: { sx: { width: 320 } },
      }}
    >
      {renderHead()}

      <Scrollbar>
        {renderMemberFilters()}
        <Divider sx={{ borderStyle: 'dashed', display: { xs: 'block', sm: 'none' } }} />
        {renderColorMode()}
        <Divider sx={{ borderStyle: 'dashed', display: { xs: 'block', sm: 'none' } }} />
        {renderDateRange()}
        <Divider sx={{ borderStyle: 'dashed' }} />
        {renderCategories()}
        <Divider sx={{ borderStyle: 'dashed' }} />
        {renderOptions()}
        <Divider sx={{ borderStyle: 'dashed' }} />
        {renderEvents()}
      </Scrollbar>
    </Drawer>
  );
}
