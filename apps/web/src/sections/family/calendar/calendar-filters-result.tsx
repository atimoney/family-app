import type { FamilyMember, EventCategoryConfig } from '@family/shared';
import type { CalendarFiltersState } from './calendar-filters';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

type Props = {
  filters: CalendarFiltersState;
  familyMembers: FamilyMember[];
  eventCategories: EventCategoryConfig[];
  totalResults: number;
  onRemoveMember: (memberId: string) => void;
  onRemoveCategory: (categoryId: string) => void;
  onReset: () => void;
};

export function CalendarFiltersResult({
  filters,
  familyMembers,
  eventCategories,
  totalResults,
  onRemoveMember,
  onRemoveCategory,
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

  // Don't show if no filters active
  const hasMemberFilter = filters.selectedMemberIds.length > 0;
  const hasCategoryFilter = filters.selectedCategoryIds.length > 0;
  const isFiltered = hasMemberFilter || hasCategoryFilter;

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
