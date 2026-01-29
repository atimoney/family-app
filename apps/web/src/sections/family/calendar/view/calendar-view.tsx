import '@fullcalendar/core';

import type { FamilyMember } from '@family/shared';
import type { EventContentArg } from '@fullcalendar/core';
import type { Theme, SxProps } from '@mui/material/styles';
import type { CalendarEventItem, EventFamilyAssignments } from 'src/features/calendar/types';

import Calendar from '@fullcalendar/react';
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

  // Filter state
  const [filters, setFilters] = useState<CalendarFiltersState>(() => ({
    memberFilter: 'all',
    selectedMemberIds: [],
  }));

  // Initialize filter with all members when family loads
  useMemo(() => {
    if (familyMembers.length > 0 && filters.selectedMemberIds.length === 0) {
      setFilters((prev) => ({
        ...prev,
        selectedMemberIds: familyMembers.map((m) => m.id),
      }));
    }
  }, [familyMembers, filters.selectedMemberIds.length]);

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

  // Filter events by selected family members
  const filteredEvents = useMemo(() => {
    // If no members selected or all members selected, show all events
    if (
      filters.selectedMemberIds.length === 0 ||
      filters.selectedMemberIds.length === familyMembers.length
    ) {
      return mergedEvents;
    }

    return mergedEvents.filter((event) => {
      const familyAssignments = event.extendedProps?.metadata?.familyAssignments as
        | EventFamilyAssignments
        | undefined;

      // If no assignments, show the event (unassigned events are visible to all)
      if (!familyAssignments) return true;

      // Check if primary member is in selected members
      if (
        familyAssignments.primaryFamilyMemberId &&
        filters.selectedMemberIds.includes(familyAssignments.primaryFamilyMemberId)
      ) {
        return true;
      }

      // Check if any participant is in selected members
      if (familyAssignments.participantFamilyMemberIds?.length) {
        return familyAssignments.participantFamilyMemberIds.some((id) =>
          filters.selectedMemberIds.includes(id)
        );
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
  }, [mergedEvents, filters.selectedMemberIds, familyMembers.length]);

  // Filter handlers
  const handleFilterChange = useCallback((newFilters: CalendarFiltersState) => {
    setFilters(newFilters);
  }, []);

  const handleFilterReset = useCallback(() => {
    setFilters({
      memberFilter: 'all',
      selectedMemberIds: familyMembers.map((m) => m.id),
    });
  }, [familyMembers]);

  const handleRemoveMemberFilter = useCallback(
    (memberId: string) => {
      const newSelectedIds = filters.selectedMemberIds.filter((id) => id !== memberId);
      // If removing last member, reset to all
      if (newSelectedIds.length === 0) {
        handleFilterReset();
        return;
      }
      setFilters((prev) => ({
        ...prev,
        memberFilter: 'custom',
        selectedMemberIds: newSelectedIds,
      }));
    },
    [filters.selectedMemberIds, handleFilterReset]
  );

  const canResetFilters = filters.selectedMemberIds.length < familyMembers.length;

  // E2: Custom event content renderer with avatars
  const renderEventContent = useCallback(
    (eventInfo: EventContentArg) => {
      const event = eventInfo.event;
      const familyAssignments = event.extendedProps?.metadata?.familyAssignments as
        | EventFamilyAssignments
        | undefined;
      const assignedMembers = getAssignedMembers(familyAssignments);

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
                    <Avatar
                      alt={member.displayName || member.profile?.displayName || ''}
                      src={member.profile?.avatarUrl || undefined}
                    />
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
          totalResults={filteredEvents.length}
          onRemoveMember={handleRemoveMemberFilter}
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
                { value: 'timeGridWeek', label: 'Week', icon: 'mingcute:calendar-week-line' },
                { value: 'timeGridDay', label: 'Day', icon: 'mingcute:calendar-day-line' },
                { value: 'dayGridMonth', label: 'Month', icon: 'mingcute:calendar-month-line' },
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
              events={filteredEvents}
              select={onSelectRange}
              eventClick={onClickEvent}
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
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            />
          </CalendarRoot>
        </Card>
      </DashboardContent>

      {renderCreateFormDialog()}
    </>
  );
}
