import type { FamilyMember, EventCategoryConfig } from '@family/shared';
import type { CalendarFiltersState } from '../calendar-filters';
import type { CalendarEventItem, CalendarEventMetadata, EventFamilyAssignments } from 'src/features/calendar/types';

import { useMemo, useCallback } from 'react';

// ----------------------------------------------------------------------

type UseEventColoringProps = {
  events: CalendarEventItem[];
  filters: CalendarFiltersState;
  eventCategories: EventCategoryConfig[];
  memberById: Map<string, FamilyMember>;
};

/**
 * Hook to apply color based on selected color mode and compute resourceIds for Family Day View
 */
export function useEventColoring({
  events,
  filters,
  eventCategories,
  memberById,
}: UseEventColoringProps) {
  // Get all unique member colors from family assignments (for stripe pattern)
  const getMemberColors = useCallback(
    (assignments: EventFamilyAssignments | null | undefined): string[] => {
      if (!assignments) return [];
      const colors: string[] = [];

      // Add primary member color first
      if (assignments.primaryFamilyMemberId) {
        const primary = memberById.get(assignments.primaryFamilyMemberId);
        if (primary?.color) colors.push(primary.color);
      }

      // Add participant colors
      if (assignments.participantFamilyMemberIds?.length) {
        assignments.participantFamilyMemberIds.forEach((id) => {
          const member = memberById.get(id);
          if (member?.color && !colors.includes(member.color)) {
            colors.push(member.color);
          }
        });
      }

      return colors;
    },
    [memberById]
  );

  // Create diagonal split gradient for multi-member events
  // Each member gets a solid diagonal section (not repeating stripes)
  const createStripeGradient = useCallback((colors: string[]): string | null => {
    if (colors.length <= 1) return null;

    // Build gradient stops for solid diagonal sections
    // Each color gets an equal portion of the diagonal
    const gradientStops: string[] = [];
    const segmentSize = 100 / colors.length;

    colors.forEach((color, i) => {
      const start = i * segmentSize;
      const end = (i + 1) * segmentSize;
      // Use hard stops (same position for end of one color and start of next)
      // to create solid sections instead of gradual transitions
      gradientStops.push(`${color} ${start}%`);
      gradientStops.push(`${color} ${end}%`);
    });

    return `linear-gradient(
      135deg,
      ${gradientStops.join(', ')}
    )`;
  }, []);

  // Apply color based on selected color mode
  const coloredEvents = useMemo(() => {
    // Create category lookup map
    const categoryByName = new Map<string, { color: string | null }>();
    eventCategories.forEach((cat) => {
      categoryByName.set(cat.name, { color: cat.color });
      categoryByName.set(cat.label, { color: cat.color });
    });

    return events.map((event) => {
      const metadata = event.extendedProps?.metadata as CalendarEventMetadata | undefined;
      const familyAssignments = metadata?.familyAssignments;

      // Get category color
      const eventCategory = metadata?.category;
      const categoryConfig = eventCategory ? categoryByName.get(eventCategory) : null;
      const categoryColor = categoryConfig?.color || null;

      // Get all member colors for potential stripe pattern
      const memberColors = getMemberColors(familyAssignments);
      const memberColor = memberColors[0] || null;

      // Original calendar color is already on the event
      const calendarColor = event.backgroundColor || null;

      // Apply color based on mode - ALWAYS compute the final color
      let finalColor: string | null = null;
      let stripeGradient: string | null = null;

      switch (filters.colorMode) {
        case 'category':
          // Priority: Category > Member > Calendar
          finalColor = categoryColor || memberColor || calendarColor;
          break;
        case 'member':
          // Priority: Member > Category > Calendar
          // Use stripe pattern if multiple members assigned
          if (memberColors.length > 1) {
            stripeGradient = createStripeGradient(memberColors);
            finalColor = memberColors[0]; // Fallback/border color
          } else {
            finalColor = memberColor || categoryColor || calendarColor;
          }
          break;
        case 'event':
          // Use the Google event's own color (from colorId)
          finalColor = event.googleEventColor || calendarColor;
          break;
        case 'calendar':
          // Just use calendar color (original behavior)
          finalColor = calendarColor;
          break;
        default:
          finalColor = calendarColor;
      }

      // Compute resourceIds for Family Day View
      // An event can appear in multiple columns if assigned to multiple family members
      const resourceIds: string[] = [];
      if (familyAssignments) {
        // Add primary member
        if (familyAssignments.primaryFamilyMemberId) {
          resourceIds.push(familyAssignments.primaryFamilyMemberId);
        }
        // Add participants
        if (familyAssignments.participantFamilyMemberIds?.length) {
          familyAssignments.participantFamilyMemberIds.forEach((id) => {
            if (!resourceIds.includes(id)) {
              resourceIds.push(id);
            }
          });
        }
        // Add assignedTo member if different
        if (
          familyAssignments.assignedToMemberId &&
          !resourceIds.includes(familyAssignments.assignedToMemberId)
        ) {
          resourceIds.push(familyAssignments.assignedToMemberId);
        }
      }
      // If no members assigned, put in "unassigned" column
      if (resourceIds.length === 0) {
        resourceIds.push('unassigned');
      }

      // Always return with the computed color to ensure FullCalendar uses it
      return {
        ...event,
        resourceIds, // For Family Day View - event appears in all assigned member columns
        backgroundColor: finalColor || undefined,
        borderColor: finalColor || undefined,
        extendedProps: {
          ...event.extendedProps,
          stripeGradient,
          memberColors: memberColors.length > 1 ? memberColors : undefined,
        },
      };
    });
  }, [events, eventCategories, filters.colorMode, getMemberColors, createStripeGradient]);

  return { coloredEvents, getMemberColors };
}
