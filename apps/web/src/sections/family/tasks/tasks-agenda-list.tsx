import type { FamilyMember } from '@family/shared';
import type { Task } from 'src/features/tasks';

import { useMemo } from 'react';
import { orderBy, groupBy } from 'es-toolkit';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { fDate, fToNow, fIsAfter, fIsBetween } from 'src/utils/format-time';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';

// ----------------------------------------------------------------------

const PRIORITY_COLORS: Record<string, 'default' | 'info' | 'warning' | 'error'> = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  urgent: 'error',
};

const STATUS_COLORS: Record<string, 'default' | 'info' | 'success'> = {
  todo: 'default',
  doing: 'info',
  done: 'success',
};

// ----------------------------------------------------------------------

type TaskItemProps = {
  task: Task;
  member?: FamilyMember;
  onToggleStatus: (task: Task) => void;
  onClick: (task: Task) => void;
};

function TaskItem({ task, member, onToggleStatus, onClick }: TaskItemProps) {
  const isDone = task.status === 'done';
  const isOverdue = task.dueAt && !isDone && fIsAfter(new Date(), new Date(task.dueAt));

  return (
    <Card
      sx={{
        mb: 1.5,
        cursor: 'pointer',
        transition: 'all 0.2s',
        ...(isDone && { opacity: 0.6 }),
        '&:hover': {
          boxShadow: (theme) => theme.shadows[8],
        },
      }}
      onClick={() => onClick(task)}
    >
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Checkbox
            checked={isDone}
            onClick={(e) => e.stopPropagation()}
            onChange={() => onToggleStatus(task)}
            sx={{ p: 0.5, mt: -0.25 }}
          />

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              sx={{
                ...(isDone && {
                  textDecoration: 'line-through',
                  color: 'text.disabled',
                }),
              }}
            >
              {task.title}
            </Typography>

            {task.description && (
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {task.description}
              </Typography>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label={task.status}
                color={STATUS_COLORS[task.status] || 'default'}
                sx={{ textTransform: 'capitalize' }}
              />

              <Chip
                size="small"
                label={task.priority}
                color={PRIORITY_COLORS[task.priority] || 'default'}
                variant="outlined"
                sx={{ textTransform: 'capitalize' }}
              />

              {task.dueAt && (
                <Typography
                  variant="caption"
                  sx={{
                    color: isOverdue ? 'error.main' : 'text.secondary',
                    fontWeight: isOverdue ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  {isOverdue ? 'Overdue: ' : 'Due: '}
                  {fToNow(task.dueAt)}
                  {task.isRecurring && (
                    <Tooltip title="Recurring task">
                      <Iconify icon="solar:restart-bold" width={14} sx={{ ml: 0.5 }} />
                    </Tooltip>
                  )}
                  {task.linkedCalendarEventId && (
                    <Tooltip title="Linked to calendar">
                      <Iconify icon="solar:calendar-date-bold" width={14} sx={{ ml: 0.5, color: 'primary.main' }} />
                    </Tooltip>
                  )}
                </Typography>
              )}

              {task.labels.map((label) => (
                <Chip key={label} size="small" label={label} variant="soft" />
              ))}
            </Box>
          </Box>

          {member && (
            <Avatar
              src={member.profile?.avatarUrl || undefined}
              sx={{
                width: 28,
                height: 28,
                bgcolor: member.color || 'grey.500',
                fontSize: 12,
              }}
            >
              {(member.displayName || member.profile?.displayName || 'M').charAt(0)}
            </Avatar>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------

type DateGroupProps = {
  date: string;
  tasks: Task[];
  familyMembers: FamilyMember[];
  onToggleStatus: (task: Task) => void;
  onClickTask: (task: Task) => void;
};

function DateGroup({ date, tasks, familyMembers, onToggleStatus, onClickTask }: DateGroupProps) {
  const getMember = (memberId?: string | null) =>
    memberId ? familyMembers.find((m) => m.id === memberId) : undefined;

  const isToday = fIsBetween(new Date(), new Date(date), new Date(date));
  const isPast = fIsAfter(new Date(), new Date(date)) && !isToday;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        variant="subtitle2"
        sx={{
          mb: 1.5,
          color: isPast ? 'error.main' : isToday ? 'primary.main' : 'text.secondary',
          fontWeight: 600,
        }}
      >
        {isToday ? 'Today' : fDate(date, 'EEEE, MMM d')}
        {isPast && !isToday && ' (Overdue)'}
      </Typography>

      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          member={getMember(task.assignedToUserId)}
          onToggleStatus={onToggleStatus}
          onClick={onClickTask}
        />
      ))}
    </Box>
  );
}

// ----------------------------------------------------------------------

type Props = {
  tasks: Task[];
  familyMembers: FamilyMember[];
  loading?: boolean;
  onToggleStatus: (task: Task) => void;
  onClickTask: (task: Task) => void;
};

export function TasksAgendaList({
  tasks,
  familyMembers,
  loading,
  onToggleStatus,
  onClickTask,
}: Props) {
  // Group tasks by due date
  const { overdueGroup, scheduledGroups, unscheduledTasks } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const withDueDate = tasks.filter((t) => t.dueAt);
    const withoutDueDate = tasks.filter((t) => !t.dueAt);

    // Separate overdue tasks (not done, due date in past)
    const overdue = withDueDate.filter(
      (t) => t.status !== 'done' && fIsAfter(now, new Date(t.dueAt!))
    );

    // Future/today tasks
    const upcoming = withDueDate.filter(
      (t) => t.status === 'done' || !fIsAfter(now, new Date(t.dueAt!))
    );

    // Sort and group by date
    const sorted = orderBy(upcoming, [(t) => new Date(t.dueAt!).getTime()], ['asc']);
    const grouped = groupBy(sorted, (t) => fDate(t.dueAt!, 'yyyy-MM-dd'));

    // Convert to array of [date, tasks]
    const groupedArray = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

    return {
      overdueGroup: orderBy(overdue, [(t) => new Date(t.dueAt!).getTime()], ['asc']),
      scheduledGroups: groupedArray,
      unscheduledTasks: orderBy(withoutDueDate, [(t) => new Date(t.createdAt).getTime()], ['desc']),
    };
  }, [tasks]);

  const isEmpty = tasks.length === 0;

  if (isEmpty && !loading) {
    return (
      <EmptyContent
        filled
        title="No tasks"
        description="Create a new task to get started"
        sx={{ py: 10 }}
      />
    );
  }

  return (
    <Scrollbar sx={{ px: 2, py: 3, height: 1 }}>
      {/* Overdue tasks */}
      {overdueGroup.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="subtitle2"
            sx={{ mb: 1.5, color: 'error.main', fontWeight: 600 }}
          >
            Overdue ({overdueGroup.length})
          </Typography>

          {overdueGroup.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              member={familyMembers.find((m) => m.id === task.assignedToUserId)}
              onToggleStatus={onToggleStatus}
              onClick={onClickTask}
            />
          ))}
        </Box>
      )}

      {/* Scheduled tasks by date */}
      {scheduledGroups.map(([date, dateTasks]) => (
        <DateGroup
          key={date}
          date={date}
          tasks={dateTasks}
          familyMembers={familyMembers}
          onToggleStatus={onToggleStatus}
          onClickTask={onClickTask}
        />
      ))}

      {/* Unscheduled tasks */}
      {unscheduledTasks.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="subtitle2"
            sx={{ mb: 1.5, color: 'text.secondary', fontWeight: 600 }}
          >
            No due date ({unscheduledTasks.length})
          </Typography>

          {unscheduledTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              member={familyMembers.find((m) => m.id === task.assignedToUserId)}
              onToggleStatus={onToggleStatus}
              onClick={onClickTask}
            />
          ))}
        </Box>
      )}
    </Scrollbar>
  );
}
