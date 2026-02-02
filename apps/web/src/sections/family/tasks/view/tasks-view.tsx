import '@fullcalendar/core';

import type { FamilyMember } from '@family/shared';
import type { EventContentArg } from '@fullcalendar/core';
import type { ResourceInput } from '@fullcalendar/resource';
import type { Task, TaskStatus, TaskTemplate, CreateTaskInput, UpdateTaskInput, CreateTaskTemplateInput } from 'src/features/tasks';

import Calendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import { useBoolean } from 'minimal-shared/hooks';
import timeGridPlugin from '@fullcalendar/timegrid';
import resourcePlugin from '@fullcalendar/resource';
import interactionPlugin from '@fullcalendar/interaction';
import { useMemo, useState, useEffect, useCallback } from 'react';
import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';

import { DashboardContent } from 'src/layouts/dashboard';
import { useFamily } from 'src/features/family/hooks/use-family';
import {
  useTasks,
  useTaskMutations,
  getTaskTemplates,
  createTaskTemplate,
  createTaskFromTemplate,
} from 'src/features/tasks';

import { TasksForm } from '../tasks-form';
import { TasksToolbar } from '../tasks-toolbar';
import { TasksAgendaList } from '../tasks-agenda-list';
import { TasksCalendarRoot } from '../tasks-calendar-styles';
import { TasksResourceLabel } from '../tasks-resource-label';
import { TasksKanbanView } from '../kanban/tasks-kanban-view';
import { useTasksCalendar } from '../hooks/use-tasks-calendar';
import { TaskTemplatePicker } from '../templates/task-template-picker';
import {
  useTaskAssignment,
  TasksCalendarContent,
  tasksToCalendarEvents,
} from '../tasks-calendar-content';
import {
  type TaskView,
  useTasksPreferences,
  getStoredTasksPreferences,
} from '../hooks/use-tasks-preferences';

// ----------------------------------------------------------------------

function useMemberLookup(members: FamilyMember[]): Map<string, FamilyMember> {
  return useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
}

// ----------------------------------------------------------------------

export function TasksView() {
  const { family } = useFamily();

  // Memoize family members to prevent unnecessary re-renders
  const familyMembers = useMemo(() => family?.members ?? [], [family?.members]);

  // Create member lookup map
  const memberById = useMemberLookup(familyMembers);

  // Form state
  const openFormDialog = useBoolean();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Template picker state
  const openTemplatePicker = useBoolean();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // Preferences - read fresh on mount, persist on change
  const [initialPrefs] = useState(() => getStoredTasksPreferences());
  const { preferences, setDesktopView, setMobileView } = useTasksPreferences();

  // Current view state (for non-calendar views)
  const [activeView, setActiveView] = useState<TaskView>(initialPrefs.desktopView);

  // Tasks data
  const { tasks, loading, refresh } = useTasks({
    includeCompleted: preferences.showCompleted,
  });

  // Task mutations
  const { create, update, remove, loading: mutating } = useTaskMutations(refresh);

  // Task assignment hook for calendar content
  const { getAssignedMember } = useTaskAssignment({ memberById });

  // Calendar view change handler
  const handleCalendarViewChange = useCallback(
    (view: string, isMobile: boolean) => {
      if (isMobile) {
        setMobileView(view as TaskView);
      } else {
        setDesktopView(view as TaskView);
      }
    },
    [setDesktopView, setMobileView]
  );

  // Calendar hook for calendar-style views
  const {
    calendarRef,
    title: calendarTitle,
    openForm: calendarOpenForm,
    selectedTaskId,
    selectedRange,
    onCloseForm: onCalendarCloseForm,
    onClickTask,
    onSelectRange,
    onDatesSet,
    onDateNavigation,
    onDropTask,
  } = useTasksCalendar({
    defaultDesktopView: initialPrefs.desktopView === 'agenda' || initialPrefs.desktopView === 'kanban'
      ? 'dayGridMonth'
      : (initialPrefs.desktopView as 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'resourceTimeGridDay'),
    defaultMobileView: 'timeGridDay',
    onViewChange: handleCalendarViewChange,
  });

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

  // Convert tasks to calendar events
  const calendarEvents = useMemo(
    () => tasksToCalendarEvents(tasks, memberById),
    [tasks, memberById]
  );

  // Find selected task by ID (for calendar click)
  const selectedTaskFromCalendar = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  // Load templates when picker opens
  useEffect(() => {
    if (openTemplatePicker.value) {
      setTemplatesLoading(true);
      getTaskTemplates()
        .then(setTemplates)
        .catch(console.error)
        .finally(() => setTemplatesLoading(false));
    }
  }, [openTemplatePicker.value]);

  // View change handler - persist to preferences
  const handleChangeView = useCallback(
    (newView: TaskView) => {
      setActiveView(newView);
      setDesktopView(newView);

      // If switching to a calendar view, sync the calendar
      if (
        newView !== 'agenda' &&
        newView !== 'kanban' &&
        calendarRef.current
      ) {
        const calendarApi = calendarRef.current.getApi();
        if (calendarApi.view.type !== newView) {
          calendarApi.changeView(newView);
        }
      }
    },
    [setDesktopView, calendarRef]
  );

  // Open form for new task
  const handleOpenNewTask = useCallback(() => {
    setSelectedTask(null);
    openFormDialog.onTrue();
  }, [openFormDialog]);

  // Open template picker
  const handleOpenTemplatePicker = useCallback(() => {
    openTemplatePicker.onTrue();
  }, [openTemplatePicker]);

  // Handle template selection - create task from template
  const handleSelectTemplate = useCallback(
    async (template: TaskTemplate) => {
      try {
        await createTaskFromTemplate(template.id);
        openTemplatePicker.onFalse();
        refresh();
      } catch (error) {
        console.error('Failed to create task from template:', error);
      }
    },
    [openTemplatePicker, refresh]
  );

  // Handle creating a new template
  const handleCreateTemplate = useCallback(
    async (data: CreateTaskTemplateInput) => {
      try {
        await createTaskTemplate(data);
        // Refresh templates list
        const updatedTemplates = await getTaskTemplates();
        setTemplates(updatedTemplates);
      } catch (error) {
        console.error('Failed to create template:', error);
        throw error;
      }
    },
    []
  );

  // Open form for editing task (agenda view)
  const handleClickTaskAgenda = useCallback(
    (task: Task) => {
      setSelectedTask(task);
      openFormDialog.onTrue();
    },
    [openFormDialog]
  );

  // Toggle task status (checkbox click)
  const handleToggleStatus = useCallback(
    async (task: Task) => {
      const newStatus = task.status === 'done' ? 'todo' : 'done';
      await update(task.id, { status: newStatus });
    },
    [update]
  );

  // Toggle status from calendar content
  const handleToggleStatusFromCalendar = useCallback(
    async (taskId: string, currentStatus: TaskStatus) => {
      const newStatus = currentStatus === 'done' ? 'todo' : 'done';
      await update(taskId, { status: newStatus });
    },
    [update]
  );

  // Handle task drop (drag and drop on calendar)
  const handleTaskDrop = useCallback(
    (taskId: string, newDueAt: string) => {
      update(taskId, { dueAt: newDueAt });
    },
    [update]
  );

  // Handle kanban drag-drop status change
  const handleKanbanStatusChange = useCallback(
    (taskId: string, newStatus: TaskStatus) => {
      update(taskId, { status: newStatus });
    },
    [update]
  );

  // Form submit handler
  const handleFormSubmit = useCallback(
    async (data: CreateTaskInput) => {
      const taskToEdit = selectedTask || selectedTaskFromCalendar;
      if (taskToEdit) {
        await update(taskToEdit.id, data as UpdateTaskInput);
      } else {
        // If created from calendar range selection, use the selected start date
        const createData = { ...data };
        if (selectedRange?.start && !createData.dueAt) {
          createData.dueAt = selectedRange.start;
        }
        await create(createData);
      }
    },
    [selectedTask, selectedTaskFromCalendar, selectedRange, create, update]
  );

  // Delete handler
  const handleDelete = useCallback(
    async (taskId: string) => {
      await remove(taskId);
    },
    [remove]
  );

  // Close form and reset state
  const handleCloseForm = useCallback(() => {
    openFormDialog.onFalse();
    onCalendarCloseForm();
    setSelectedTask(null);
  }, [openFormDialog, onCalendarCloseForm]);

  // Render event content for calendar
  const renderEventContent = useCallback(
    (eventInfo: EventContentArg) => (
      <TasksCalendarContent
        eventInfo={eventInfo}
        getAssignedMember={getAssignedMember}
        onToggleStatus={handleToggleStatusFromCalendar}
      />
    ),
    [getAssignedMember, handleToggleStatusFromCalendar]
  );

  // Render the appropriate view
  const renderView = () => {
    switch (activeView) {
      case 'agenda':
        return (
          <TasksAgendaList
            tasks={tasks}
            familyMembers={familyMembers}
            loading={loading}
            onToggleStatus={handleToggleStatus}
            onClickTask={handleClickTaskAgenda}
          />
        );

      case 'kanban':
        return (
          <TasksKanbanView
            tasks={tasks}
            familyMembers={familyMembers}
            onTaskClick={handleClickTaskAgenda}
            onStatusChange={handleKanbanStatusChange}
            onToggleStatus={handleToggleStatus}
          />
        );

      case 'dayGridMonth':
      case 'timeGridWeek':
      case 'timeGridDay':
      case 'resourceTimeGridDay':
        return (
          <TasksCalendarRoot sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Calendar
              ref={calendarRef}
              plugins={[
                dayGridPlugin,
                timeGridPlugin,
                interactionPlugin,
                resourcePlugin,
                resourceTimeGridPlugin,
              ]}
              initialView={activeView}
              initialDate={new Date()}
              events={calendarEvents}
              resources={activeView === 'resourceTimeGridDay' ? resources : undefined}
              headerToolbar={false}
              editable
              selectable
              selectMirror
              dayMaxEvents
              allDaySlot
              eventContent={renderEventContent}
              select={onSelectRange}
              eventClick={onClickTask}
              eventDrop={(arg) => onDropTask(arg, handleTaskDrop)}
              datesSet={onDatesSet}
              resourceLabelContent={(arg) => <TasksResourceLabel arg={arg} />}
              height="100%"
              nowIndicator
              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
            />
          </TasksCalendarRoot>
        );

      default:
        return null;
    }
  };

  // Determine if form should be open
  const isFormOpen = openFormDialog.value || calendarOpenForm;
  const currentTask = selectedTask || selectedTaskFromCalendar;

  return (
    <DashboardContent maxWidth="xl" sx={{ display: 'flex', flexDirection: 'column', height: 1 }}>
      <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TasksToolbar
          view={activeView}
          title={['dayGridMonth', 'timeGridWeek', 'timeGridDay', 'resourceTimeGridDay'].includes(activeView) ? calendarTitle : undefined}
          loading={loading || mutating}
          onChangeView={handleChangeView}
          onOpenForm={handleOpenNewTask}
          onOpenTemplates={handleOpenTemplatePicker}
          onDateNavigation={onDateNavigation}
          showDateNav={['dayGridMonth', 'timeGridWeek', 'timeGridDay', 'resourceTimeGridDay'].includes(activeView)}
        />

        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>{renderView()}</Box>
      </Card>

      {/* Task Form Dialog */}
      <TasksForm
        open={isFormOpen}
        onClose={handleCloseForm}
        currentTask={currentTask}
        familyMembers={familyMembers}
        onSubmit={handleFormSubmit}
        onDelete={currentTask ? handleDelete : undefined}
      />

      {/* Template Picker Dialog */}
      <TaskTemplatePicker
        open={openTemplatePicker.value}
        onClose={openTemplatePicker.onFalse}
        templates={templates}
        members={familyMembers}
        onSelect={handleSelectTemplate}
        onCreateTemplate={handleCreateTemplate}
        loading={templatesLoading}
      />
    </DashboardContent>
  );
}
