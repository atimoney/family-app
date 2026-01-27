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
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import CircularProgress from '@mui/material/CircularProgress';

import { DashboardContent } from 'src/layouts/dashboard';
import { useCalendarEvents } from 'src/features/calendar/hooks/use-calendar-events';

import { Iconify } from 'src/components/iconify';

import { CalendarRoot } from '../styles';
import { CalendarForm } from '../calendar-form';
import { useCalendar } from '../hooks/use-calendar';
import { CalendarToolbar } from '../calendar-toolbar';

// ----------------------------------------------------------------------

export function CalendarView() {
  const theme = useTheme();

  const { events, loading, error } = useCalendarEvents();
  const [localEvents, setLocalEvents] = useState<CalendarEventItem[]>([]);

  const mergedEvents = localEvents.length ? localEvents : events;

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
  } = useCalendar();

  // Find current event for editing
  const currentEvent = selectedEventId ? mergedEvents.find((e) => e.id === selectedEventId) : null;

  // Event handlers
  const handleCreateEvent = useCallback(() => {
    // Google events are source-of-truth; creation is not supported here yet.
    onCloseForm();
  }, [onCloseForm]);

  const handleUpdateEvent = useCallback((updatedEvent: CalendarEventItem) => {
    // Metadata-only edits should be handled via PATCH /events/:id/metadata.
    // Keep local UI in sync until metadata editing is wired.
    setLocalEvents((prev) => prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)));
  }, []);

  const handleDeleteEvent = useCallback((eventId: string) => {
    setLocalEvents((prev) => prev.filter((e) => e.id !== eventId));
  }, []);

  // Update event on drag/resize
  const updateEventFromDragResize = useCallback((eventData: Partial<CalendarEventItem>) => {
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
  }, []);

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
        onClose={onCloseForm}
        onCreateEvent={handleCreateEvent}
        onUpdateEvent={handleUpdateEvent}
        onDeleteEvent={handleDeleteEvent}
      />
    </Dialog>
  );

  // Loading state
  if (loading) {
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
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={onOpenForm}
          >
            Add event
          </Button>
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
              loading={loading}
              onChangeView={onChangeView}
              onDateNavigation={onDateNavigation}
              viewOptions={[
                { value: 'dayGridMonth', label: 'Month', icon: 'mingcute:calendar-month-line' },
                { value: 'timeGridWeek', label: 'Week', icon: 'mingcute:calendar-week-line' },
                { value: 'timeGridDay', label: 'Day', icon: 'mingcute:calendar-day-line' },
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
