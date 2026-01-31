import '@fullcalendar/core';

import type { FamilyMember } from '@family/shared';
import type { EventContentArg } from '@fullcalendar/core';
import type { Theme, SxProps } from '@mui/material/styles';
import type { CalendarEventItem, EventFamilyAssignments, CalendarEventMetadata } from 'src/features/calendar/types';

import Calendar from '@fullcalendar/react';
import listPlugin from '@fullcalendar/list';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useMemo, useState, useCallback, startTransition } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import AvatarGroup from '@mui/material/AvatarGroup';
import DialogTitle from '@mui/material/DialogTitle';
import CircularProgress from '@mui/material/CircularProgress';

import { DashboardContent } from 'src/layouts/dashboard';
import { useFamily } from 'src/features/family/hooks/use-family';
import { useSelectedCalendars } from 'src/features/calendar/hooks/use-calendars';
import { useEventCategories } from 'src/features/calendar/hooks/use-event-categories';
import {
  useCalendarEvents,
  useCalendarMutations,
} from 'src/features/calendar/hooks/use-calendar-events';

import { Iconify } from 'src/components/iconify';

import { CalendarRoot } from '../styles';
import { CalendarForm } from '../calendar-form';
import { useCalendar } from '../hooks/use-calendar';
import { CalendarToolbar } from '../calendar-toolbar';
import { CalendarFiltersResult } from '../calendar-filters-result';
import { CalendarFilters, type CalendarFiltersState } from '../calendar-filters';

// ----------------------------------------------------------------------

export function CalendarView() {
  const theme = useTheme();

  const { events, loading, syncing, error, refresh, sync } = useCalendarEvents();
  const { calendars } = useSelectedCalendars();
  const { family } = useFamily();
  const [localEvents, setLocalEvents] = useState<CalendarEventItem[]>([]);

  // E1: Load event categories for the family
  const { categories: eventCategories } = useEventCategories(family?.id ?? null);

  // E2: Get family members for event assignment
  const familyMembers = useMemo(() => family?.members ?? [], [family?.members]);

  // Filter state - empty selectedMemberIds means "show all"
  const [filters, setFilters] = useState<CalendarFiltersState>(() => ({
    memberFilter: 'all',
    selectedMemberIds: [],
    showUnassigned: true,
    selectedCategoryIds: [],
    colorMode: 'category',
  }));

  const mergedEvents = localEvents.length ? localEvents : events;

  // E2: Create a map for quick member lookup by ID
  const memberById = useMemo(() => {
    const map = new Map<string, FamilyMember>();
    familyMembers.forEach((m) => map.set(m.id, m));
    return map;
  }, [familyMembers]);

  // E2: Get assigned members from familyAssignments
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

  // E2: Get all unique member colors from family assignments (for stripe pattern)
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

  // E2: Create diagonal split gradient for multi-member events
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

  // Filter events by selected family members and categories
  const filteredEvents = useMemo(() => {
    let result = mergedEvents;

    // Filter by category first (if any selected)
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
      const isUnassigned = !familyAssignments || 
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
        if (familyAssignments.participantFamilyMemberIds.some((id) =>
          filters.selectedMemberIds.includes(id)
        )) {
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
  }, [mergedEvents, filters.selectedMemberIds, filters.showUnassigned, filters.memberFilter, filters.selectedCategoryIds, familyMembers.length, eventCategories]);

  // Apply color based on selected color mode
  const coloredEvents = useMemo(() => {
    // Create category lookup map
    const categoryByName = new Map<string, { color: string | null }>();
    eventCategories.forEach((cat) => {
      categoryByName.set(cat.name, { color: cat.color });
      categoryByName.set(cat.label, { color: cat.color });
    });

    return filteredEvents.map((event) => {
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

      // Always return with the computed color to ensure FullCalendar uses it
      return {
        ...event,
        backgroundColor: finalColor || undefined,
        borderColor: finalColor || undefined,
        extendedProps: {
          ...event.extendedProps,
          stripeGradient,
          memberColors: memberColors.length > 1 ? memberColors : undefined,
        },
      };
    });
  }, [filteredEvents, eventCategories, memberById, filters.colorMode, getMemberColors, createStripeGradient]);

  // Filter handlers
  const handleFilterChange = useCallback((newFilters: CalendarFiltersState) => {
    setFilters(newFilters);
  }, []);

  const handleFilterReset = useCallback(() => {
    setFilters((prev) => ({
      memberFilter: 'all',
      selectedMemberIds: [],
      showUnassigned: true,
      selectedCategoryIds: [],
      colorMode: prev.colorMode, // Preserve color mode on reset
    }));
  }, []);

  const handleRemoveMemberFilter = useCallback(
    (memberId: string) => {
      const newSelectedIds = filters.selectedMemberIds.filter((id) => id !== memberId);
      // If removing last member, reset members to all (empty selection)
      if (newSelectedIds.length === 0) {
        setFilters((prev) => ({
          ...prev,
          memberFilter: 'all',
          selectedMemberIds: [],
          showUnassigned: true,
        }));
        return;
      }
      setFilters((prev) => ({
        ...prev,
        memberFilter: 'custom',
        selectedMemberIds: newSelectedIds,
      }));
    },
    [filters.selectedMemberIds]
  );

  const handleRemoveCategoryFilter = useCallback(
    (categoryId: string) => {
      const newSelectedIds = filters.selectedCategoryIds.filter((id) => id !== categoryId);
      setFilters((prev) => ({
        ...prev,
        selectedCategoryIds: newSelectedIds,
      }));
    },
    [filters.selectedCategoryIds]
  );

  // Can reset if any filters are active
  const canResetFilters = filters.selectedMemberIds.length > 0 || filters.selectedCategoryIds.length > 0;

  // E2: Custom event content renderer with avatars
  const renderEventContent = useCallback(
    (eventInfo: EventContentArg) => {
      const event = eventInfo.event;
      const familyAssignments = event.extendedProps?.metadata?.familyAssignments as
        | EventFamilyAssignments
        | undefined;
      const assignedMembers = getAssignedMembers(familyAssignments);
      
      // E2: Get stripe gradient for multi-member events
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
    },
    [getAssignedMembers]
  );

  // Mutations with auto-sync
  const { createEvent, updateEvent, deleteEvent, loading: mutating } = useCalendarMutations(refresh);

  const {
    calendarRef,
    /********/
    view,
    title,
    /********/
    onDropEvent,
    onChangeView,
    onSelectRange,
    onClickEvent,
    onResizeEvent,
    onDatesSet,
    onDateNavigation,
    /********/
    openForm,
    onOpenForm,
    onCloseForm,
    /********/
    selectedRange,
    selectedEventId,
  } = useCalendar({ defaultDesktopView: 'timeGridWeek' });

  // Find current event for editing
  const currentEvent = selectedEventId ? mergedEvents.find((e) => e.id === selectedEventId) : null;

  // Event handlers
  const handleCreateEvent = useCallback(
    async (eventData: CalendarEventItem) => {
      try {
        // E1: Build extraData with both E2 family assignments and E1 metadata
        const extraData: Record<string, unknown> = {};
        
        // E2: Family assignments
        if (eventData.familyAssignments) {
          extraData.familyAssignments = eventData.familyAssignments;
        }
        
        // E1: Event metadata
        if (eventData.category) {
          extraData.category = eventData.category;
        }
        if (eventData.audience) {
          extraData.audience = eventData.audience;
        }
        if (eventData.tags && eventData.tags.length > 0) {
          extraData.tags = eventData.tags;
        }
        if (eventData.categoryMetadata) {
          extraData.metadata = eventData.categoryMetadata;
        }

        await createEvent({
          title: eventData.title,
          start: eventData.start,
          end: eventData.end,
          allDay: eventData.allDay,
          calendarId: eventData.calendarId,
          description: eventData.description,
          location: eventData.location,
          color: eventData.color,
          recurrence: eventData.recurrence,
          reminders: eventData.reminders,
          extraData: Object.keys(extraData).length > 0 ? extraData : undefined,
        });
        onCloseForm();
      } catch (err) {
        console.error('Failed to create event:', err);
      }
    },
    [createEvent, onCloseForm]
  );

  const handleUpdateEvent = useCallback(
    async (updatedEvent: CalendarEventItem) => {
      try {
        // Find the existing event to get the googleEventId
        const existingEvent = mergedEvents.find((e) => e.id === updatedEvent.id);
        const googleEventId = existingEvent?.extendedProps?.googleEventId;
        
        if (!googleEventId) {
          throw new Error('Event not found or missing Google Event ID');
        }

        // Optimistically update local state
        setLocalEvents((prev) => prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)));

        // E1: Build extraData with both E2 family assignments and E1 metadata
        const extraData: Record<string, unknown> = {};
        
        // E2: Family assignments
        if (updatedEvent.familyAssignments) {
          extraData.familyAssignments = updatedEvent.familyAssignments;
        }
        
        // E1: Event metadata
        if (updatedEvent.category) {
          extraData.category = updatedEvent.category;
        }
        if (updatedEvent.audience) {
          extraData.audience = updatedEvent.audience;
        }
        if (updatedEvent.tags && updatedEvent.tags.length > 0) {
          extraData.tags = updatedEvent.tags;
        }
        if (updatedEvent.categoryMetadata) {
          extraData.metadata = updatedEvent.categoryMetadata;
        }

        // Persist to Google Calendar
        await updateEvent(googleEventId, {
          title: updatedEvent.title,
          start: updatedEvent.start,
          end: updatedEvent.end,
          allDay: updatedEvent.allDay,
          calendarId: updatedEvent.calendarId,
          description: updatedEvent.description,
          location: updatedEvent.location,
          color: updatedEvent.color,
          recurrence: updatedEvent.recurrence,
          reminders: updatedEvent.reminders,
          extraData: Object.keys(extraData).length > 0 ? extraData : undefined,
        });
      } catch (err) {
          console.error('Failed to update event:', err);
        // Revert on failure
        await refresh();
      }
    },
    [mergedEvents, updateEvent, refresh]
  );

  const handleDeleteEvent = useCallback(
    async (eventId: string) => {
      try {
        const event = mergedEvents.find((e) => e.id === eventId);
        // Use googleEventId for the API call (Google Calendar needs this, not the local Prisma ID)
        const googleEventId = event?.extendedProps?.googleEventId;
        if (!googleEventId) {
          throw new Error('Event not found or missing Google Event ID');
        }
        await deleteEvent(googleEventId, event?.calendarId);
        onCloseForm();
      } catch (err) {
        console.error('Failed to delete event:', err);
      }
    },
    [deleteEvent, mergedEvents, onCloseForm]
  );

  // Manual sync handler
  const handleSync = useCallback(async () => {
    try {
      await sync({ force: false });
    } catch (err) {
      console.error('Sync failed:', err);
    }
  }, [sync]);

  // Update event on drag/resize
  const updateEventFromDragResize = useCallback(
    async (eventData: Partial<CalendarEventItem>) => {
      // Optimistic update
      setLocalEvents((prev) =>
        prev.map((e) =>
          e.id === eventData.id
            ? {
                ...e,
                start: eventData.start || e.start,
                end: eventData.end || e.end,
                allDay: eventData.allDay ?? e.allDay,
              }
            : e
        )
      );

      // Persist to Google Calendar
      if (eventData.id && (eventData.start || eventData.end)) {
        const event = mergedEvents.find((e) => e.id === eventData.id);
        const googleEventId = event?.extendedProps?.googleEventId;
        if (!googleEventId) {
          console.error('Event not found or missing Google Event ID');
          return;
        }
        try {
          await updateEvent(googleEventId, {
            start: eventData.start,
            end: eventData.end,
            allDay: eventData.allDay,
            calendarId: event?.calendarId,
          });
        } catch (err) {
          console.error('Failed to update event:', err);
          // Revert on failure
          await refresh();
        }
      }
    },
    [mergedEvents, updateEvent, refresh]
  );

  const flexStyles: SxProps<Theme> = {
    flex: '1 1 auto',
    display: 'flex',
    flexDirection: 'column',
  };

  const renderCreateFormDialog = () => (
    <Dialog
      fullWidth
      maxWidth="xs"
      open={openForm}
      onClose={onCloseForm}
      transitionDuration={{
        enter: theme.transitions.duration.shortest,
        exit: theme.transitions.duration.shortest - 80,
      }}
      slotProps={{
        paper: {
          sx: {
            display: 'flex',
            overflow: 'hidden',
            flexDirection: 'column',
            '& form': { ...flexStyles, minHeight: 0 },
          },
        },
      }}
    >
      <DialogTitle sx={{ minHeight: 76 }}>
        {openForm && <> {currentEvent?.id ? 'Edit' : 'Add'} event</>}
      </DialogTitle>

      <CalendarForm
        currentEvent={currentEvent}
        selectedRange={selectedRange}
        calendars={calendars}
        familyMembers={familyMembers}
        eventCategories={eventCategories}
        onClose={onCloseForm}
        onCreateEvent={handleCreateEvent}
        onUpdateEvent={handleUpdateEvent}
        onDeleteEvent={handleDeleteEvent}
      />
    </Dialog>
  );

  // Loading state
  if (loading && events.length === 0) {
    return (
      <DashboardContent maxWidth="xl" sx={{ ...flexStyles }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
          }}
        >
          <CircularProgress />
        </Box>
      </DashboardContent>
    );
  }

  return (
    <>
      <DashboardContent maxWidth="xl" sx={{ ...flexStyles }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: { xs: 3, md: 5 },
          }}
        >
          <Typography variant="h4">Calendar</Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title={syncing ? 'Syncing...' : 'Sync with Google Calendar'}>
              <span>
                <IconButton
                  onClick={handleSync}
                  disabled={syncing || mutating}
                  color={syncing ? 'primary' : 'default'}
                >
                  {syncing ? (
                    <CircularProgress size={20} />
                  ) : (
                    <Iconify icon="solar:restart-bold" />
                  )}
                </IconButton>
              </span>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={onOpenForm}
              disabled={mutating}
            >
              Add event
            </Button>
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error.message}
          </Alert>
        )}

        {/* Family member filters */}
        {familyMembers.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <CalendarFilters
              filters={filters}
              familyMembers={familyMembers}
              eventCategories={eventCategories}
              onFilterChange={handleFilterChange}
              canReset={canResetFilters}
              onReset={handleFilterReset}
            />
          </Box>
        )}

        {/* Active filter results */}
        <CalendarFiltersResult
          filters={filters}
          familyMembers={familyMembers}
          eventCategories={eventCategories}
          totalResults={filteredEvents.length}
          onRemoveMember={handleRemoveMemberFilter}
          onRemoveCategory={handleRemoveCategoryFilter}
          onReset={handleFilterReset}
        />

        <Card sx={{ ...flexStyles, minHeight: '50vh' }}>
          <CalendarRoot sx={{ ...flexStyles }}>
            <CalendarToolbar
              view={view}
              title={title}
              loading={loading || syncing}
              onChangeView={onChangeView}
              onDateNavigation={onDateNavigation}
              viewOptions={[
                { value: 'dayGridMonth', label: 'Month', icon: 'mingcute:calendar-month-line' },
                { value: 'timeGridWeek', label: 'Week', icon: 'mingcute:calendar-week-line' },
                { value: 'timeGridDay', label: 'Day', icon: 'mingcute:calendar-day-line' },
                { value: 'listWeek', label: 'Agenda', icon: 'custom:calendar-agenda-outline' },
              ]}
            />

            <Calendar
              weekends
              editable
              droppable
              selectable
              allDayMaintainDuration
              eventResizableFromStart
              firstDay={1}
              aspectRatio={3}
              dayMaxEvents={3}
              eventMaxStack={2}
              rerenderDelay={10}
              headerToolbar={false}
              eventDisplay="block"
              ref={calendarRef}
              initialView={view}
              events={coloredEvents}
              select={onSelectRange}
              eventClick={onClickEvent}
              datesSet={onDatesSet}
              eventContent={renderEventContent}
              businessHours={{
                daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
              }}
              eventDrop={(arg) => {
                startTransition(() => {
                  onDropEvent(arg, updateEventFromDragResize);
                });
              }}
              eventResize={(arg) => {
                startTransition(() => {
                  onResizeEvent(arg, updateEventFromDragResize);
                });
              }}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            />
          </CalendarRoot>
        </Card>
      </DashboardContent>

      {renderCreateFormDialog()}
    </>
  );
}
