import type FullCalendar from '@fullcalendar/react';
import type { Breakpoint } from '@mui/material/styles';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import type { ViewApi, CalendarApi, DatesSetArg, EventDropArg, DateSelectArg, EventClickArg } from '@fullcalendar/core';
import type { CalendarEventItem } from 'src/features/calendar/types';

import { useRef, useState, useEffect, useCallback } from 'react';

import useMediaQuery from '@mui/material/useMediaQuery';

// ----------------------------------------------------------------------

export type CalendarView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek' | 'resourceTimeGridDay';

export type CalendarRange = {
  start: string;
  end: string;
} | null;

export type DateNavigationAction = 'today' | 'prev' | 'next';

export type UseCalendarReturn = {
  openForm: boolean;
  view: CalendarView;
  title: ViewApi['title'];
  selectedEventId: string;
  selectedRange: CalendarRange;
  calendarRef: React.RefObject<FullCalendar | null>;
  onOpenForm: () => void;
  onCloseForm: () => void;
  getCalendarApi: () => CalendarApi | null;
  onClickEvent: (arg: EventClickArg) => void;
  onSelectRange: (arg: DateSelectArg) => void;
  onChangeView: (view: CalendarView) => void;
  onDatesSet: (arg: DatesSetArg) => void;
  onDateNavigation: (action: DateNavigationAction) => void;
  onDropEvent: (arg: EventDropArg, updateEvent: (event: Partial<CalendarEventItem>) => void) => void;
  onResizeEvent: (
    arg: EventResizeDoneArg,
    updateEvent: (event: Partial<CalendarEventItem>) => void
  ) => void;
};

export type UseCalendarProps = {
  breakpoint?: Breakpoint;
  defaultMobileView?: CalendarView;
  defaultDesktopView?: CalendarView;
};

export function useCalendar({
  breakpoint = 'sm',
  defaultMobileView = 'timeGridDay',
  defaultDesktopView = 'dayGridMonth',
}: UseCalendarProps = {}): UseCalendarReturn {
  const calendarRef = useRef<FullCalendar>(null);
  const smUp = useMediaQuery((theme) => theme.breakpoints.up(breakpoint));

  const [openForm, setOpenForm] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedRange, setSelectedRange] = useState<CalendarRange>(null);

  const [title, setTitle] = useState<ViewApi['title']>('');
  const [view, setView] = useState<CalendarView>(defaultDesktopView);
  const [lastDesktopView, setLastDesktopView] = useState<CalendarView>(defaultDesktopView);
  const [lastMobileView, setLastMobileView] = useState<CalendarView>(defaultMobileView);

  // Track the previous smUp value to detect breakpoint changes
  const prevSmUp = useRef(smUp);

  const getCalendarApi = useCallback(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (!calendarApi) {
      // Calendar API not available yet - this is expected during initial render
      return null;
    }
    return calendarApi;
  }, []);

  const onOpenForm = useCallback(() => {
    setOpenForm(true);
  }, []);

  const onCloseForm = useCallback(() => {
    setOpenForm(false);
    setSelectedRange(null);
    setSelectedEventId('');
  }, []);

  // Only sync view on breakpoint changes (desktop <-> mobile), not on every render
  useEffect(() => {
    const calendarApi = getCalendarApi();
    if (!calendarApi) return;

    // Only change view if breakpoint actually changed
    if (prevSmUp.current !== smUp) {
      const targetView = smUp ? lastDesktopView : lastMobileView;
      calendarApi.changeView(targetView);
      setView(targetView);
      prevSmUp.current = smUp;
    }

    // Always sync title
    if (title !== calendarApi.view.title) {
      setTitle(calendarApi.view.title);
    }
  }, [getCalendarApi, lastDesktopView, lastMobileView, smUp, title]);

  const onChangeView = useCallback(
    (newView: CalendarView) => {
      const calendarApi = getCalendarApi();
      if (!calendarApi) return;

      // Save the view for the current breakpoint
      if (smUp) {
        setLastDesktopView(newView);
      } else {
        setLastMobileView(newView);
      }

      calendarApi.changeView(newView);
      setView(newView);
    },
    [getCalendarApi, smUp]
  );

  const onDateNavigation = useCallback(
    (action: DateNavigationAction) => {
      const calendarApi = getCalendarApi();
      if (!calendarApi) return;

      switch (action) {
        case 'today':
          calendarApi.today();
          break;
        case 'prev':
          calendarApi.prev();
          break;
        case 'next':
          calendarApi.next();
          break;
        default:
          console.warn(`Unknown action: ${action}`);
          return;
      }

      setTitle(calendarApi.view.title);
    },
    [getCalendarApi]
  );

  const onDatesSet = useCallback((arg: DatesSetArg) => {
    setTitle(arg.view.title);
    setView(arg.view.type as CalendarView);
  }, []);

  const onSelectRange = useCallback(
    (arg: DateSelectArg) => {
      const calendarApi = getCalendarApi();
      if (!calendarApi) return;

      calendarApi.unselect();
      onOpenForm();
      setSelectedRange({ start: arg.startStr, end: arg.endStr });
    },
    [getCalendarApi, onOpenForm]
  );

  const onClickEvent = useCallback(
    (arg: EventClickArg) => {
      const { event } = arg;

      onOpenForm();
      setSelectedEventId(event.id);
    },
    [onOpenForm]
  );

  const onResizeEvent = useCallback(
    (arg: EventResizeDoneArg, updateEvent: (eventData: Partial<CalendarEventItem>) => void) => {
      const { event } = arg;

      updateEvent({
        id: event.id,
        allDay: event.allDay,
        start: event.startStr,
        end: event.endStr,
      });
    },
    []
  );

  const onDropEvent = useCallback(
    (arg: EventDropArg, updateEvent: (eventData: Partial<CalendarEventItem>) => void) => {
      const { event } = arg;

      updateEvent({
        id: event.id,
        allDay: event.allDay,
        start: event.startStr,
        end: event.endStr,
      });
    },
    []
  );

  return {
    calendarRef,
    getCalendarApi,
    /********/
    view,
    title,
    /********/
    onDropEvent,
    onClickEvent,
    onChangeView,
    onSelectRange,
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
  };
}
