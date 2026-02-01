import type { FamilyMember } from '@family/shared';
import type { EventContentArg } from '@fullcalendar/core';
import type { IconifyName } from 'src/components/iconify';
import type { Task, TaskStatus, TaskPriority } from 'src/features/tasks';

import { useCallback } from 'react';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';

import { fIsAfter } from 'src/utils/format-time';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const PRIORITY_ICONS: Record<TaskPriority, IconifyName> = {
  low: 'eva:arrow-downward-fill',
  medium: 'eva:minus-circle-fill',
  high: 'eva:arrow-upward-fill',
  urgent: 'solar:danger-bold',
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'grey.500',
  medium: 'info.main',
  high: 'warning.main',
  urgent: 'error.main',
};

// ----------------------------------------------------------------------

type UseTaskEventContentProps = {
  memberById: Map<string, FamilyMember>;
};

/**
 * Hook to get assigned member from task
 */
export function useTaskAssignment({ memberById }: UseTaskEventContentProps) {
  const getAssignedMember = useCallback(
    (assignedToUserId: string | null | undefined): FamilyMember | null => {
      if (!assignedToUserId) return null;
      return memberById.get(assignedToUserId) ?? null;
    },
    [memberById]
  );

  return { getAssignedMember };
}

// ----------------------------------------------------------------------

type TasksCalendarContentProps = {
  eventInfo: EventContentArg;
  getAssignedMember: (assignedToUserId: string | null | undefined) => FamilyMember | null;
  onToggleStatus?: (taskId: string, currentStatus: TaskStatus) => void;
};

/**
 * Custom task content renderer for FullCalendar
 */
export function TasksCalendarContent({
  eventInfo,
  getAssignedMember,
  onToggleStatus,
}: TasksCalendarContentProps) {
  const event = eventInfo.event;
  const extendedProps = event.extendedProps as {
    task: Task;
    status: TaskStatus;
    priority: TaskPriority;
    assignedToUserId: string | null;
  };

  const { task, status, priority, assignedToUserId } = extendedProps;
  const assignedMember = getAssignedMember(assignedToUserId);
  const isDone = status === 'done';
  const isOverdue = task?.dueAt && !isDone && fIsAfter(new Date(), new Date(task.dueAt));

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleStatus && task) {
      onToggleStatus(task.id, status);
    }
  };

  // Get background color based on status and priority
  const getBgColor = () => {
    if (isDone) return 'success.lighter';
    if (isOverdue) return 'error.lighter';
    if (priority === 'urgent') return 'error.lighter';
    if (priority === 'high') return 'warning.lighter';
    return 'grey.200';
  };

  // Get text color
  const getTextColor = () => {
    if (isDone) return 'success.darker';
    if (isOverdue) return 'error.darker';
    if (priority === 'urgent') return 'error.darker';
    if (priority === 'high') return 'warning.darker';
    return 'text.primary';
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        px: 0.5,
        py: 0.25,
        bgcolor: getBgColor(),
        color: getTextColor(),
        borderRadius: 'inherit',
      }}
    >
      {/* Status checkbox */}
      <Checkbox
        size="small"
        checked={isDone}
        onClick={handleCheckboxClick}
        sx={{
          p: 0,
          width: 16,
          height: 16,
          flexShrink: 0,
          '& .MuiSvgIcon-root': { fontSize: 16 },
        }}
      />

      {/* Priority icon */}
      {priority !== 'medium' && (
        <Tooltip title={priority}>
          <Box sx={{ display: 'flex', flexShrink: 0 }}>
            <Iconify
              icon={PRIORITY_ICONS[priority]}
              width={14}
              sx={{ color: PRIORITY_COLORS[priority] }}
            />
          </Box>
        </Tooltip>
      )}

      {/* Title */}
      <Box
        component="span"
        sx={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: 500,
          fontSize: '0.75rem',
          lineHeight: 1.2,
          ...(isDone && {
            textDecoration: 'line-through',
            opacity: 0.7,
          }),
        }}
      >
        {event.title}
      </Box>

      {/* Assignee avatar */}
      {assignedMember && (
        <Tooltip title={assignedMember.displayName || assignedMember.profile?.displayName}>
          <Avatar
            src={assignedMember.profile?.avatarUrl || undefined}
            sx={{
              width: 18,
              height: 18,
              fontSize: '0.65rem',
              bgcolor: assignedMember.color || 'grey.400',
              flexShrink: 0,
            }}
          >
            {(assignedMember.displayName || assignedMember.profile?.displayName)?.[0]?.toUpperCase()}
          </Avatar>
        </Tooltip>
      )}

      {/* Overdue indicator */}
      {isOverdue && (
        <Tooltip title="Overdue">
          <Box sx={{ display: 'flex', flexShrink: 0 }}>
            <Iconify icon="solar:clock-circle-bold" width={14} sx={{ color: 'error.main' }} />
          </Box>
        </Tooltip>
      )}
    </Box>
  );
}

// ----------------------------------------------------------------------

/**
 * Convert tasks to FullCalendar events
 */
export function tasksToCalendarEvents(
  tasks: Task[],
  memberById: Map<string, FamilyMember>
): Array<{
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  resourceId?: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    task: Task;
    status: TaskStatus;
    priority: TaskPriority;
    assignedToUserId: string | null;
  };
}> {
  return tasks
    .filter((task) => task.dueAt) // Only show tasks with due dates on calendar
    .map((task) => {
      const isDone = task.status === 'done';
      const isOverdue = task.dueAt && !isDone && fIsAfter(new Date(), new Date(task.dueAt));
      const member = task.assignedToUserId ? memberById.get(task.assignedToUserId) : null;

      // Determine colors
      let bgColor = '#919eab'; // grey
      let borderColor = '#919eab';
      let textColor = '#212b36';

      if (isDone) {
        bgColor = '#54d62c'; // success
        borderColor = '#54d62c';
        textColor = '#0a5e00';
      } else if (isOverdue) {
        bgColor = '#ff4842'; // error
        borderColor = '#ff4842';
        textColor = '#7a0006';
      } else if (task.priority === 'urgent') {
        bgColor = '#ff4842';
        borderColor = '#ff4842';
        textColor = '#7a0006';
      } else if (task.priority === 'high') {
        bgColor = '#ffc107';
        borderColor = '#ffc107';
        textColor = '#7a4100';
      } else if (member?.color) {
        bgColor = member.color;
        borderColor = member.color;
      }

      return {
        id: task.id,
        title: task.title,
        start: task.dueAt!,
        allDay: true, // Tasks are all-day events by default
        resourceId: task.assignedToUserId || 'unassigned',
        backgroundColor: bgColor,
        borderColor,
        textColor,
        extendedProps: {
          task,
          status: task.status as TaskStatus,
          priority: task.priority as TaskPriority,
          assignedToUserId: task.assignedToUserId ?? null,
        },
      };
    });
}
