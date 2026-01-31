import type { FamilyMember } from '@family/shared';
import type { EventContentArg } from '@fullcalendar/core';
import type { EventFamilyAssignments } from 'src/features/calendar/types';

import { useCallback } from 'react';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import AvatarGroup from '@mui/material/AvatarGroup';

// ----------------------------------------------------------------------

type UseEventContentProps = {
  memberById: Map<string, FamilyMember>;
};

/**
 * Hook to get assigned members from familyAssignments
 */
export function useEventAssignments({ memberById }: UseEventContentProps) {
  const getAssignedMembers = useCallback(
    (assignments: EventFamilyAssignments | null | undefined): FamilyMember[] => {
      if (!assignments) return [];
      const members: FamilyMember[] = [];

      // Add primary member first
      if (assignments.primaryFamilyMemberId) {
        const primary = memberById.get(assignments.primaryFamilyMemberId);
        if (primary) members.push(primary);
      }

      // Add participants
      if (assignments.participantFamilyMemberIds?.length) {
        assignments.participantFamilyMemberIds.forEach((id) => {
          const member = memberById.get(id);
          if (member && !members.some((m) => m.id === member.id)) {
            members.push(member);
          }
        });
      }

      return members;
    },
    [memberById]
  );

  return { getAssignedMembers };
}

// ----------------------------------------------------------------------

type CalendarEventContentProps = {
  eventInfo: EventContentArg;
  getAssignedMembers: (assignments: EventFamilyAssignments | null | undefined) => FamilyMember[];
};

/**
 * Custom event content renderer with avatars for FullCalendar
 */
export function CalendarEventContent({ eventInfo, getAssignedMembers }: CalendarEventContentProps) {
  const event = eventInfo.event;
  const familyAssignments = event.extendedProps?.metadata?.familyAssignments as
    | EventFamilyAssignments
    | undefined;
  const assignedMembers = getAssignedMembers(familyAssignments);

  // Get stripe gradient for multi-member events
  const stripeGradient = event.extendedProps?.stripeGradient as string | undefined;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        px: 0.5,
        py: 0.25,
        // Apply diagonal stripe gradient for multi-member events
        ...(stripeGradient && {
          background: stripeGradient,
          borderRadius: 'inherit',
          // Ensure text remains readable with a subtle text shadow
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }),
      }}
    >
      {/* Title row */}
      <Box
        component="span"
        sx={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: 600,
          lineHeight: 1.2,
        }}
      >
        {event.title}
      </Box>

      {/* Time (left) and Avatars (right) row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mt: 0.25,
        }}
      >
        {eventInfo.timeText && (
          <Box component="span" sx={{ fontSize: '0.75em', opacity: 0.85 }}>
            {eventInfo.timeText}
          </Box>
        )}
        {!eventInfo.timeText && <Box />}

        {assignedMembers.length > 0 && (
          <AvatarGroup
            max={3}
            sx={{
              '& .MuiAvatar-root': {
                width: 16,
                height: 16,
                fontSize: '0.5rem',
                border: '1px solid currentColor',
              },
            }}
          >
            {assignedMembers.map((member) => (
              <Tooltip key={member.id} title={member.displayName || member.profile?.displayName || ''}>
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                  <Avatar
                    alt={member.displayName || member.profile?.displayName || ''}
                    src={member.profile?.avatarUrl || undefined}
                  />
                  {member.color && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: -1,
                        right: -1,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: member.color,
                        border: '1px solid',
                        borderColor: 'background.paper',
                      }}
                    />
                  )}
                </Box>
              </Tooltip>
            ))}
          </AvatarGroup>
        )}
      </Box>
    </Box>
  );
}
