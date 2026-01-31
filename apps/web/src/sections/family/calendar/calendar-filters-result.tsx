import type { FamilyMember, EventCategoryConfig } from '@family/shared';
import type { CalendarFiltersState } from './calendar-filters';
import type { CalendarInfo } from 'src/features/calendar/types';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { fDate } from 'src/utils/format-time';

// ----------------------------------------------------------------------

type Props = {
  filters: CalendarFiltersState;
  familyMembers: FamilyMember[];
  eventCategories: EventCategoryConfig[];
  calendars: CalendarInfo[];
  totalResults: number;
  onRemoveMember: (memberId: string) => void;
  onRemoveCategory: (categoryId: string) => void;
  onRemoveCalendar: (calendarId: string) => void;
  onRemoveDateRange?: () => void;
  onReset: () => void;
};

export function CalendarFiltersResult({
  filters,
  familyMembers,
  eventCategories,
  calendars,
  totalResults,
  onRemoveMember,
  onRemoveCategory,
  onRemoveCalendar,
  onRemoveDateRange,
  onReset,
}: Props) {
  // Get selected members for display
  const selectedMembers = familyMembers.filter((m) =>
    filters.selectedMemberIds.includes(m.id)
  );

  // Get selected categories for display
  const selectedCategories = eventCategories.filter((c) =>
    filters.selectedCategoryIds.includes(c.id)
  );

  // Get hidden calendars (calendars NOT selected) for display
  const hiddenCalendars = calendars.filter(
    (c) => !filters.selectedCalendarIds.includes(c.id)
  );

  // Check for date range filter
  const hasDateRangeFilter = !!filters.startDate && !!filters.endDate;

  // Check for calendar filter (not all calendars selected)
  const hasCalendarFilter = calendars.length > 0 && filters.selectedCalendarIds.length < calendars.length;

  // Don't show if no filters active
  const hasMemberFilter = filters.selectedMemberIds.length > 0;
  const hasCategoryFilter = filters.selectedCategoryIds.length > 0;
  const isFiltered = hasMemberFilter || hasCategoryFilter || hasCalendarFilter || hasDateRangeFilter;

  if (!isFiltered) {
    return null;
  }

  return (
    <Box
      sx={{
        py: 1.5,
        px: 2,
        mb: 2,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1,
        bgcolor: 'background.neutral',
        borderRadius: 1,
      }}
    >
      <Typography variant="body2" sx={{ color: 'text.secondary', mr: 1 }}>
        <strong>{totalResults}</strong> events
      </Typography>

      {/* Member filter indicator */}
      {filters.memberFilter !== 'all' && filters.memberFilter !== 'custom' && (
        <Chip
          size="small"
          label={filters.memberFilter === 'adults' ? 'Adults only' : 'Kids only'}
          onDelete={onReset}
          sx={{ textTransform: 'capitalize' }}
        />
      )}

      {/* Individual member chips (only show in custom mode) */}
      {filters.memberFilter === 'custom' && selectedMembers.length > 0 && (
        <>
          {selectedMembers.map((member) => {
            const memberName = member.displayName || member.profile?.displayName || 'Member';
            return (
              <Chip
                key={member.id}
                size="small"
                avatar={
                  <Avatar
                    alt={memberName}
                    src={member.profile?.avatarUrl || undefined}
                    sx={{ bgcolor: member.color || '#637381' }}
                  >
                    {memberName.charAt(0).toUpperCase()}
                  </Avatar>
                }
                label={memberName}
                onDelete={() => onRemoveMember(member.id)}
              />
            );
          })}
        </>
      )}

      {/* Category chips */}
      {selectedCategories.length > 0 && (
        <>
          {selectedCategories.map((category) => (
            <Chip
              key={category.id}
              size="small"
              icon={
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: category.color || '#637381',
                    ml: 0.5,
                  }}
                />
              }
              label={category.label}
              onDelete={() => onRemoveCategory(category.id)}
            />
          ))}
        </>
      )}

      {/* Calendar chips - show which calendars are hidden */}
      {hasCalendarFilter && (
        <>
          <Typography variant="caption" sx={{ color: 'text.secondary', mx: 0.5 }}>
            Hiding:
          </Typography>
          {hiddenCalendars.map((calendar) => (
            <Chip
              key={calendar.id}
              size="small"
              icon={
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: calendar.backgroundColor || '#637381',
                    ml: 0.5,
                  }}
                />
              }
              label={calendar.summary}
              onDelete={() => onRemoveCalendar(calendar.id)}
            />
          ))}
        </>
      )}

      {/* Date range chip */}
      {hasDateRangeFilter && (
        <Chip
          size="small"
          label={`${fDate(filters.startDate)} - ${fDate(filters.endDate)}`}
          onDelete={onRemoveDateRange}
        />
      )}

      {/* Clear all button */}
      <Button
        size="small"
        color="error"
        onClick={onReset}
        sx={{ ml: 'auto' }}
      >
        Clear all
      </Button>
    </Box>
  );
}
