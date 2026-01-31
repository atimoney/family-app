import type { FamilyMember, EventCategoryConfig } from '@family/shared';
import type { CalendarFiltersState } from '../calendar-filters';
import type { CalendarEventItem, EventFamilyAssignments } from 'src/features/calendar/types';

import { useMemo } from 'react';

import { fIsAfter, fIsBetween } from 'src/utils/format-time';

// ----------------------------------------------------------------------

type UseEventFilteringProps = {
  events: CalendarEventItem[];
  filters: CalendarFiltersState;
  eventCategories: EventCategoryConfig[];
};

type UseEventFilteringReturn = {
  filteredEvents: CalendarEventItem[];
  dateError: boolean;
};

/**
 * Hook to filter events by family members, categories, and date range
 */
export function useEventFiltering({
  events,
  filters,
  eventCategories,
}: UseEventFilteringProps): UseEventFilteringReturn {
  // Date range filter validation
  const dateError = fIsAfter(filters.startDate, filters.endDate);

  const filteredEvents = useMemo(() => {
    let result = events;

    // Filter by date range (if specified and valid)
    if (!dateError && filters.startDate && filters.endDate) {
      result = result.filter((event) => fIsBetween(event.start, filters.startDate, filters.endDate));
    }

    // Filter by category (if any selected)
    if (filters.selectedCategoryIds.length > 0) {
      result = result.filter((event) => {
        const eventCategory = event.extendedProps?.metadata?.category as string | undefined;
        if (!eventCategory) return false; // No category = don't show when filtering by category

        // Check if event's category matches any selected category
        // Match by category name (from EventCategoryConfig)
        return eventCategories.some(
          (cat) =>
            filters.selectedCategoryIds.includes(cat.id) &&
            (cat.name === eventCategory || cat.label === eventCategory)
        );
      });
    }

    // If no members selected (empty array), return result (all events or category-filtered)
    if (filters.selectedMemberIds.length === 0) {
      return result;
    }

    // Filter by members
    return result.filter((event) => {
      const familyAssignments = event.extendedProps?.metadata?.familyAssignments as
        | EventFamilyAssignments
        | undefined;

      // Check if event is unassigned (no family assignments at all)
      const isUnassigned =
        !familyAssignments ||
        (!familyAssignments.primaryFamilyMemberId &&
          !familyAssignments.participantFamilyMemberIds?.length &&
          !familyAssignments.assignedToMemberId);

      // If unassigned, show based on showUnassigned flag
      if (isUnassigned) {
        return filters.showUnassigned;
      }

      // Check if primary member is in selected members
      if (
        familyAssignments.primaryFamilyMemberId &&
        filters.selectedMemberIds.includes(familyAssignments.primaryFamilyMemberId)
      ) {
        return true;
      }

      // Check if any participant is in selected members
      if (familyAssignments.participantFamilyMemberIds?.length) {
        if (
          familyAssignments.participantFamilyMemberIds.some((id) =>
            filters.selectedMemberIds.includes(id)
          )
        ) {
          return true;
        }
      }

      // Check assignedTo member
      if (
        familyAssignments.assignedToMemberId &&
        filters.selectedMemberIds.includes(familyAssignments.assignedToMemberId)
      ) {
        return true;
      }

      // No matching members found - hide the event
      return false;
    });
  }, [
    events,
    filters.selectedMemberIds,
    filters.showUnassigned,
    filters.selectedCategoryIds,
    filters.startDate,
    filters.endDate,
    dateError,
    eventCategories,
  ]);

  return { filteredEvents, dateError };
}

// ----------------------------------------------------------------------

/**
 * Create a map for quick member lookup by ID
 */
export function useMemberLookup(familyMembers: FamilyMember[]) {
  return useMemo(() => {
    const map = new Map<string, FamilyMember>();
    familyMembers.forEach((m) => map.set(m.id, m));
    return map;
  }, [familyMembers]);
}
