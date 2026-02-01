import type FullCalendar from '@fullcalendar/react';
import type { Breakpoint } from '@mui/material/styles';
import type {
  ViewApi,
  CalendarApi,
  DatesSetArg,
  EventDropArg,
  DateSelectArg,
  EventClickArg,
} from '@fullcalendar/core';
import type { TaskView } from './use-tasks-preferences';

import { useRef, useState, useEffect, useCallback } from 'react';

import useMediaQuery from '@mui/material/useMediaQuery';

// ----------------------------------------------------------------------

// Calendar-compatible views (exclude 'agenda' and 'kanban' which aren't FullCalendar views)
export type TaskCalendarView = Exclude<TaskView, 'agenda' | 'kanban'>;

export type TaskCalendarRange = {
  start: string;
  end: string;
} | null;

export type DateNavigationAction = 'today' | 'prev' | 'next';

export type UseTasksCalendarReturn = {
  openForm: boolean;
  view: TaskCalendarView;
  title: ViewApi['title'];
  selectedTaskId: string;
  selectedRange: TaskCalendarRange;
  calendarRef: React.RefObject<FullCalendar | null>;
  onOpenForm: () => void;
  onCloseForm: () => void;
  getCalendarApi: () => CalendarApi | null;
  onClickTask: (arg: EventClickArg) => void;
  onSelectRange: (arg: DateSelectArg) => void;
  onChangeView: (view: TaskCalendarView) => void;
  onDatesSet: (arg: DatesSetArg) => void;
  onDateNavigation: (action: DateNavigationAction) => void;
  onDropTask: (arg: EventDropArg, onUpdate: (taskId: string, dueAt: string) => void) => void;
};

export type UseTasksCalendarProps = {
  breakpoint?: Breakpoint;
  defaultMobileView?: TaskCalendarView;
  defaultDesktopView?: TaskCalendarView;
  /** Callback when view changes - use for persisting preferences */
  onViewChange?: (view: TaskCalendarView, isMobile: boolean) => void;
};

// ----------------------------------------------------------------------

export function useTasksCalendar({
  breakpoint = 'sm',
  defaultMobileView = 'timeGridDay',
  defaultDesktopView = 'dayGridMonth',
  onViewChange,
}: UseTasksCalendarProps = {}): UseTasksCalendarReturn {
  const calendarRef = useRef<FullCalendar>(null);
  const smUp = useMediaQuery((theme) => theme.breakpoints.up(breakpoint));

  const [openForm, setOpenForm] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [selectedRange, setSelectedRange] = useState<TaskCalendarRange>(null);

  const [title, setTitle] = useState<ViewApi['title']>('');
  // Always start with desktop view - the effect below will correct if needed
  const [view, setView] = useState<TaskCalendarView>(defaultDesktopView);
  const [lastDesktopView, setLastDesktopView] = useState<TaskCalendarView>(defaultDesktopView);
  const [lastMobileView, setLastMobileView] = useState<TaskCalendarView>(defaultMobileView);

  // Track the previous smUp value to detect breakpoint changes
  const prevSmUp = useRef<boolean | null>(null);

  const getCalendarApi = useCallback(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (!calendarApi) {
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
    setSelectedTaskId('');
  }, []);

  // Sync view on breakpoint changes and initial mount
  useEffect(() => {
    queueMicrotask(() => {
      const calendarApi = getCalendarApi();
      if (!calendarApi) return;

      // On first run (prevSmUp.current is null) or when breakpoint changes
      if (prevSmUp.current === null || prevSmUp.current !== smUp) {
        const targetView = smUp ? lastDesktopView : lastMobileView;
        // Only change if different from current view
        if (calendarApi.view.type !== targetView) {
          calendarApi.changeView(targetView);
        }
        setView(targetView);
        prevSmUp.current = smUp;
      }

      // Always sync title
      if (title !== calendarApi.view.title) {
        setTitle(calendarApi.view.title);
      }
    });
  }, [getCalendarApi, lastDesktopView, lastMobileView, smUp, title]);

  const onChangeView = useCallback(
    (newView: TaskCalendarView) => {
      const calendarApi = getCalendarApi();
      if (!calendarApi) return;

      // Save the view for the current breakpoint
      if (smUp) {
        setLastDesktopView(newView);
      } else {
        setLastMobileView(newView);
      }

      // Notify parent about view change for persistence
      onViewChange?.(newView, !smUp);

      calendarApi.changeView(newView);
      setView(newView);
    },
    [getCalendarApi, smUp, onViewChange]
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
          break;
      }
    },
    [getCalendarApi]
  );

  const onDatesSet = useCallback((arg: DatesSetArg) => {
    setTitle(arg.view.title);
    setView(arg.view.type as TaskCalendarView);
  }, []);

  const onClickTask = useCallback(
    (arg: EventClickArg) => {
      const taskId = arg.event.id;
      setSelectedTaskId(taskId);
      setOpenForm(true);
    },
    []
  );

  const onSelectRange = useCallback((arg: DateSelectArg) => {
    const calendarApi = arg.view.calendar;
    calendarApi.unselect();

    setSelectedRange({
      start: arg.startStr,
      end: arg.endStr,
    });
    setOpenForm(true);
  }, []);

  const onDropTask = useCallback(
    (arg: EventDropArg, onUpdate: (taskId: string, dueAt: string) => void) => {
      const taskId = arg.event.id;
      const newStart = arg.event.startStr;
      onUpdate(taskId, newStart);
    },
    []
  );

  return {
    calendarRef,
    view,
    title,
    openForm,
    selectedTaskId,
    selectedRange,
    getCalendarApi,
    onOpenForm,
    onCloseForm,
    onClickTask,
    onSelectRange,
    onChangeView,
    onDatesSet,
    onDateNavigation,
    onDropTask,
  };
}
