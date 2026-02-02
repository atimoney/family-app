import '@fullcalendar/core';

import type { EventContentArg } from '@fullcalendar/core';
import type { Theme, SxProps } from '@mui/material/styles';
import type { ResourceInput } from '@fullcalendar/resource';
import type { CalendarFiltersState } from '../calendar-filters';
import type { CalendarView as CalendarViewType } from '../hooks/use-calendar';
import type { CalendarEventItem, CalendarEventMetadata } from 'src/features/calendar/types';

import Calendar from '@fullcalendar/react';
import listPlugin from '@fullcalendar/list';
import dayGridPlugin from '@fullcalendar/daygrid';
import { useBoolean } from 'minimal-shared/hooks';
import timeGridPlugin from '@fullcalendar/timegrid';
import resourcePlugin from '@fullcalendar/resource';
import interactionPlugin from '@fullcalendar/interaction';
import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid';
import { useMemo, useState, useEffect, useCallback, startTransition } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import AlertTitle from '@mui/material/AlertTitle';
import DialogTitle from '@mui/material/DialogTitle';
import CircularProgress from '@mui/material/CircularProgress';

import { DashboardContent } from 'src/layouts/dashboard';
import { useFamily } from 'src/features/family/hooks/use-family';
import { useEventAudit } from 'src/features/calendar/hooks/use-event-audit';
import { useSelectedCalendars } from 'src/features/calendar/hooks/use-calendars';
import { useAppPreferences } from 'src/features/calendar/hooks/use-app-preferences';
import { useEventCategories } from 'src/features/calendar/hooks/use-event-categories';
import { useSharedCalendarAccess } from 'src/features/family/hooks/use-shared-calendar-access';
import {
  useCalendarEvents,
  useCalendarMutations,
} from 'src/features/calendar/hooks/use-calendar-events';

import { CalendarRoot } from '../styles';
import { CalendarForm } from '../calendar-form';
import { useCalendar } from '../hooks/use-calendar';
import { CalendarHeader } from '../calendar-header';
import { CalendarFilters } from '../calendar-filters';
import { CalendarToolbar } from '../calendar-toolbar';
import { useEventColoring } from '../hooks/use-event-coloring';
import { CalendarResourceLabel } from '../calendar-resource-label';
import { CalendarFiltersResult } from '../calendar-filters-result';
import { CalendarFiltersSidebar } from '../calendar-filters-sidebar';
import { useMemberLookup, useEventFiltering } from '../hooks/use-event-filtering';
import { useEventAssignments, CalendarEventContent } from '../calendar-event-content';
import { useCalendarPreferences, getStoredCalendarPreferences } from '../hooks/use-calendar-preferences';

// ----------------------------------------------------------------------

export function CalendarView() {
  const theme = useTheme();

  const openFilters = useBoolean();

  const { events, loading, syncing, error, refresh, sync } = useCalendarEvents();
  const { calendars } = useSelectedCalendars();
  const { family } = useFamily();
  const [localEvents, setLocalEvents] = useState<CalendarEventItem[]>([]);
  
  // Check shared calendar access for family members
  const {
    hasAccess: hasSharedCalendarAccess,
    hasSharedCalendar,
    loading: sharedCalendarLoading,
  } = useSharedCalendarAccess(family?.id ?? null);

  // Determine if we should show the shared calendar warning
  const isOwner = family?.myMembership?.role === 'owner';
  const showSharedCalendarWarning = family && !sharedCalendarLoading && (
    !hasSharedCalendar || (!isOwner && !hasSharedCalendarAccess)
  );
  
  // Dashboard mode indicator
  const { isDashboardMode, dashboardDeviceName } = useAppPreferences();
  
  // Audit tracking for event changes
  const { getAuditInfo } = useEventAudit();
  
  // Read stored preferences fresh on each mount (lazy initializer runs once per mount)
  const [initialPrefs] = useState(() => getStoredCalendarPreferences());

  // Load calendar preferences mutation handlers
  const { setDesktopView, setMobileView, syncFiltersToPreferences } = useCalendarPreferences();

  // E1: Load event categories for the family
  const { categories: eventCategories } = useEventCategories(family?.id ?? null);

  // E2: Get family members for event assignment
  const familyMembers = useMemo(() => family?.members ?? [], [family?.members]);

  // Create member lookup map
  const memberById = useMemberLookup(familyMembers);

  // Filter state - initialized from localStorage preferences
  const [filters, setFilters] = useState<CalendarFiltersState>(() => ({
    memberFilter: 'all',
    selectedMemberIds: [],
    showUnassigned: initialPrefs.showUnassigned,
    selectedCategoryIds: [],
    selectedCalendarIds: [], // Will be populated when calendars load
    colorMode: initialPrefs.colorMode,
    startDate: null,
    endDate: null,
  }));

  // Initialize selected calendars when calendars load (select all by default)
  useEffect(() => {
    if (calendars.length > 0 && filters.selectedCalendarIds.length === 0) {
      setFilters((prev) => ({
        ...prev,
        selectedCalendarIds: calendars.map((c) => c.id),
      }));
    }
  }, [calendars, filters.selectedCalendarIds.length]);

  const mergedEvents = localEvents.length ? localEvents : events;

  // Use event filtering hook
  const { filteredEvents } = useEventFiltering({
    events: mergedEvents,
    filters,
    eventCategories,
  });

  // Use event coloring hook
  const { coloredEvents } = useEventColoring({
    events: filteredEvents,
    filters,
    eventCategories,
    memberById,
  });

  // Use event assignments hook for content rendering
  const { getAssignedMembers } = useEventAssignments({ memberById });

  // Create resources for the Family Day View (columns for each family member + unassigned)
  const resources: ResourceInput[] = useMemo(() => {
    const memberResources = familyMembers.map((member) => ({
      id: member.id,
      title: member.displayName || member.profile?.displayName || 'Member',
      extendedProps: {
        color: member.color,
        avatarUrl: member.profile?.avatarUrl,
      },
    }));

    // Add "Unassigned" resource at the end
    return [
      ...memberResources,
      {
        id: 'unassigned',
        title: 'Unassigned',
        extendedProps: {
          color: null,
          avatarUrl: null,
        },
      },
    ];
  }, [familyMembers]);

  // Filter handlers - sync preferences to localStorage for persistence
  const handleFilterChange = useCallback(
    (newFilters: CalendarFiltersState) => {
      setFilters(newFilters);
      // Persist colorMode and showUnassigned to localStorage
      syncFiltersToPreferences(newFilters);
    },
    [syncFiltersToPreferences]
  );

  const handleFilterReset = useCallback(() => {
    setFilters((prev) => ({
      memberFilter: 'all',
      selectedMemberIds: [],
      showUnassigned: true,
      selectedCategoryIds: [],
      selectedCalendarIds: calendars.map((c) => c.id), // Reset to all calendars selected
      colorMode: prev.colorMode, // Preserve color mode on reset
      startDate: null,
      endDate: null,
    }));
  }, [calendars]);

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

  const handleRemoveCalendarFilter = useCallback(
    (calendarId: string) => {
      // This is called when user wants to "un-hide" a calendar (add it back to selection)
      if (filters.selectedCalendarIds.includes(calendarId)) {
        return; // Already selected, nothing to do
      }
      setFilters((prev) => ({
        ...prev,
        selectedCalendarIds: [...prev.selectedCalendarIds, calendarId],
      }));
    },
    [filters.selectedCalendarIds]
  );

  const handleRemoveDateRangeFilter = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      startDate: null,
      endDate: null,
    }));
  }, []);

  // Can reset if any filters are active (members, categories, calendars, or date range)
  const hasCalendarFilter = calendars.length > 0 && filters.selectedCalendarIds.length < calendars.length;
  const canResetFilters =
    filters.selectedMemberIds.length > 0 ||
    filters.selectedCategoryIds.length > 0 ||
    hasCalendarFilter ||
    (!!filters.startDate && !!filters.endDate);

  // Event content renderer
  const renderEventContent = useCallback(
    (eventInfo: EventContentArg) => (
      <CalendarEventContent eventInfo={eventInfo} getAssignedMembers={getAssignedMembers} />
    ),
    [getAssignedMembers]
  );

  // Mutations with auto-sync
  const { createEvent, updateEvent, deleteEvent, loading: mutating } = useCalendarMutations(refresh);

  // Handle view changes - persist to localStorage
  const handleViewChange = useCallback(
    (newView: CalendarViewType, isMobile: boolean) => {
      if (isMobile) {
        setMobileView(newView);
      } else {
        setDesktopView(newView);
      }
    },
    [setDesktopView, setMobileView]
  );

  const {
    calendarRef,
    view,
    title,
    onDropEvent,
    onChangeView,
    onSelectRange,
    onClickEvent,
    onResizeEvent,
    onDatesSet,
    onDateNavigation,
    openForm,
    onOpenForm,
    onCloseForm,
    selectedRange,
    selectedEventId,
  } = useCalendar({
    // Use initialPrefs for initial values (read fresh from localStorage on mount)
    defaultDesktopView: initialPrefs.desktopView,
    defaultMobileView: initialPrefs.mobileView,
    onViewChange: handleViewChange,
  });

  // Find current event for editing
  const currentEvent = selectedEventId ? mergedEvents.find((e) => e.id === selectedEventId) : null;

  // Handler for clicking an event in the sidebar
  const handleClickEventInSidebar = useCallback(
    (eventId: string) => {
      // Open the event form for editing
      onClickEvent({ event: { id: eventId } } as any);
    },
    [onClickEvent]
  );

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
        // Always include tags (even empty array) so backend can clear them
        extraData.tags = eventData.tags || [];
        if (eventData.categoryMetadata) {
          extraData.metadata = eventData.categoryMetadata;
        }

        // Add audit info for tracking who created the event
        const auditInfo = getAuditInfo('user');
        extraData.createdAudit = auditInfo;
        extraData.lastModifiedAudit = auditInfo;

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
    [createEvent, onCloseForm, getAuditInfo]
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
        // Merge the updated data with existing event to preserve extendedProps
        setLocalEvents((prev) => {
          const currentEvents = prev.length > 0 ? prev : events;
          return currentEvents.map((e) => {
            if (e.id !== updatedEvent.id) return e;
            // Merge: keep extendedProps from existing, update top-level fields
            // Also update the metadata inside extendedProps to stay in sync
            const updatedMetadata: CalendarEventMetadata = {
              ...(e.extendedProps?.metadata || { tags: [], notes: null, color: null }),
              tags: updatedEvent.tags || [],
              category: updatedEvent.category || null,
              audience: updatedEvent.audience || 'family',
              categoryMetadata: updatedEvent.categoryMetadata || null,
              familyAssignments: updatedEvent.familyAssignments || null,
              // Preserve createdAudit, update lastModifiedAudit
              createdAudit: e.extendedProps?.metadata?.createdAudit || null,
              lastModifiedAudit: getAuditInfo('user'),
            };
            return {
              ...e,
              ...updatedEvent,
              extendedProps: {
                ...e.extendedProps,
                googleEventId: e.extendedProps?.googleEventId || googleEventId,
                metadata: updatedMetadata,
              },
            };
          });
        });

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
        // Always include tags (even empty array) so backend can clear them
        extraData.tags = updatedEvent.tags || [];
        if (updatedEvent.categoryMetadata) {
          extraData.metadata = updatedEvent.categoryMetadata;
        }

        // Add audit info for tracking who modified the event
        // Preserve createdAudit from existing event, update lastModifiedAudit
        const existingMetadata = existingEvent?.extendedProps?.metadata;
        if (existingMetadata?.createdAudit) {
          extraData.createdAudit = existingMetadata.createdAudit;
        }
        extraData.lastModifiedAudit = getAuditInfo('user');

        // Check if calendar changed - need to pass sourceCalendarId for move operation
        const sourceCalendarId = existingEvent?.calendarId;
        const calendarChanged = sourceCalendarId && updatedEvent.calendarId && sourceCalendarId !== updatedEvent.calendarId;

        // Persist to Google Calendar
        await updateEvent(googleEventId, {
          title: updatedEvent.title,
          start: updatedEvent.start,
          end: updatedEvent.end,
          allDay: updatedEvent.allDay,
          calendarId: updatedEvent.calendarId,
          // Pass sourceCalendarId if calendar changed so backend can move the event
          sourceCalendarId: calendarChanged ? sourceCalendarId : undefined,
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
    [events, mergedEvents, updateEvent, refresh, getAuditInfo]
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
      // Optimistic update - use events as base if localEvents is empty
      setLocalEvents((prev) => {
        const currentEvents = prev.length > 0 ? prev : events;
        return currentEvents.map((e) =>
          e.id === eventData.id
            ? {
                ...e,
                start: eventData.start || e.start,
                end: eventData.end || e.end,
                allDay: eventData.allDay ?? e.allDay,
              }
            : e
        );
      });

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
    [events, mergedEvents, updateEvent, refresh]
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
        isDashboardMode={isDashboardMode}
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
        <CalendarHeader
          syncing={syncing}
          mutating={mutating}
          isDashboardMode={isDashboardMode}
          dashboardDeviceName={dashboardDeviceName ?? undefined}
          onSync={handleSync}
          onAddEvent={onOpenForm}
        />

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error.message}
          </Alert>
        )}

        {/* Shared Calendar Warning */}
        {showSharedCalendarWarning && (
          <Alert 
            severity="warning" 
            sx={{ mb: 3 }}
            action={
              <Button 
                color="inherit" 
                size="small" 
                href="/settings"
              >
                {isOwner ? 'Configure' : 'Settings'}
              </Button>
            }
          >
            <AlertTitle>Shared Family Calendar Required</AlertTitle>
            {!hasSharedCalendar ? (
              isOwner 
                ? 'No shared family calendar has been selected. Go to Settings to select the Google Calendar that will be shared with your family.'
                : 'The family owner has not set up a shared family calendar yet. Please ask them to configure it in Settings.'
            ) : (
              'You don\'t have access to the family shared calendar. Make sure you have access to the calendar in Google Calendar and have it selected in your Integrations settings.'
            )}
          </Alert>
        )}

        {/* Quick filters bar - Family member avatars & toggles (hidden on mobile) */}
        {familyMembers.length > 0 && (
          <Box sx={{ mb: 2, display: { xs: 'none', sm: 'block' } }}>
            <CalendarFilters
              filters={filters}
              familyMembers={familyMembers}
              calendars={calendars}
              onFilterChange={handleFilterChange}
            />
          </Box>
        )}

        {/* Active filter results */}
        <CalendarFiltersResult
          filters={filters}
          familyMembers={familyMembers}
          eventCategories={eventCategories}
          calendars={calendars}
          totalResults={filteredEvents.length}
          onRemoveMember={handleRemoveMemberFilter}
          onRemoveCategory={handleRemoveCategoryFilter}
          onRemoveCalendar={handleRemoveCalendarFilter}
          onRemoveDateRange={handleRemoveDateRangeFilter}
          onReset={handleFilterReset}
        />

        <Card sx={{ ...flexStyles, minHeight: '50vh' }}>
          <CalendarRoot sx={{ ...flexStyles }}>
            <CalendarToolbar
              view={view}
              title={title}
              loading={loading || syncing}
              canReset={canResetFilters}
              onChangeView={onChangeView}
              onDateNavigation={onDateNavigation}
              onOpenFilters={openFilters.onTrue}
              viewOptions={[
                { value: 'dayGridMonth', label: 'Month', icon: 'mingcute:calendar-month-line' },
                { value: 'timeGridWeek', label: 'Week', icon: 'mingcute:calendar-week-line' },
                { value: 'timeGridDay', label: 'Day', icon: 'mingcute:calendar-day-line' },
                { value: 'resourceTimeGridDay', label: 'Family', icon: 'solar:users-group-rounded-bold' },
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
              resources={resources}
              schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
              select={onSelectRange}
              eventClick={onClickEvent}
              datesSet={onDatesSet}
              eventContent={renderEventContent}
              resourceLabelContent={(arg) => <CalendarResourceLabel arg={arg} />}
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
              plugins={[
                dayGridPlugin,
                timeGridPlugin,
                listPlugin,
                interactionPlugin,
                resourcePlugin,
                resourceTimeGridPlugin,
              ]}
            />
          </CalendarRoot>
        </Card>
      </DashboardContent>

      {renderCreateFormDialog()}

      <CalendarFiltersSidebar
        open={openFilters.value}
        onClose={openFilters.onFalse}
        filters={filters}
        familyMembers={familyMembers}
        eventCategories={eventCategories}
        calendars={calendars}
        events={filteredEvents}
        canReset={canResetFilters}
        onFilterChange={handleFilterChange}
        onReset={handleFilterReset}
        onClickEvent={handleClickEventInSidebar}
      />
    </>
  );
}
