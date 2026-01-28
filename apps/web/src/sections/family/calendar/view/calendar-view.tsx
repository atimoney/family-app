import '@fullcalendar/core';

import type { Theme, SxProps } from '@mui/material/styles';
import type { CalendarEventItem } from 'src/features/calendar/types';

import Calendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useState, useCallback, startTransition } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import CircularProgress from '@mui/material/CircularProgress';

import { DashboardContent } from 'src/layouts/dashboard';
import { useSelectedCalendars } from 'src/features/calendar/hooks/use-calendars';
import {
  useCalendarEvents,
  useCalendarMutations,
} from 'src/features/calendar/hooks/use-calendar-events';

import { Iconify } from 'src/components/iconify';

import { CalendarRoot } from '../styles';
import { CalendarForm } from '../calendar-form';
import { useCalendar } from '../hooks/use-calendar';
import { CalendarToolbar } from '../calendar-toolbar';

// ----------------------------------------------------------------------

export function CalendarView() {
  const theme = useTheme();

  const { events, loading, syncing, error, refresh, sync } = useCalendarEvents();
  const { calendars } = useSelectedCalendars();
  const [localEvents, setLocalEvents] = useState<CalendarEventItem[]>([]);

  const mergedEvents = localEvents.length ? localEvents : events;

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
              events={mergedEvents}
              select={onSelectRange}
              eventClick={onClickEvent}
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
