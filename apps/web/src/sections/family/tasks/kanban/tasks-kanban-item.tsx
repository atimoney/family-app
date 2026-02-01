import type { DragEvent } from 'react';
import type { FamilyMember } from '@family/shared';
import type { Task, TaskPriority } from 'src/features/tasks';

import { useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';

import { fDate, fIsAfter } from 'src/utils/format-time';

import { Iconify } from 'src/components/iconify';

import {
  KanbanItemRoot,
  KanbanItemContent,
  KanbanItemPriority,
} from './tasks-kanban-styles';

// ----------------------------------------------------------------------

const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; color: 'default' | 'info' | 'warning' | 'error' }
> = {
  low: { label: 'Low', color: 'default' },
  medium: { label: 'Medium', color: 'info' },
  high: { label: 'High', color: 'warning' },
  urgent: { label: 'Urgent', color: 'error' },
};

// ----------------------------------------------------------------------

type KanbanTaskItemProps = {
  task: Task;
  member?: FamilyMember;
  onClick: () => void;
  onToggleStatus: () => void;
};

export function KanbanTaskItem({ task, member, onClick, onToggleStatus }: KanbanTaskItemProps) {
  const isDone = task.status === 'done';
  const isOverdue = task.dueAt && !isDone && fIsAfter(new Date(), new Date(task.dueAt));
  const priorityConfig = PRIORITY_CONFIG[task.priority as TaskPriority];

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.effectAllowed = 'move';
    },
    [task.id]
  );

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleStatus();
    },
    [onToggleStatus]
  );

  return (
    <KanbanItemRoot
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      data-task-id={task.id}
    >
      {/* Priority indicator */}
      {task.priority !== 'medium' && (
        <KanbanItemPriority priority={task.priority as TaskPriority} />
      )}

      <KanbanItemContent>
        {/* Header row with checkbox and title */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
          <Checkbox
            size="small"
            checked={isDone}
            onClick={handleCheckboxClick}
            sx={{ p: 0, mt: 0.25 }}
          />
          <Typography
            variant="subtitle2"
            sx={{
              flex: 1,
              wordBreak: 'break-word',
              ...(isDone && {
                textDecoration: 'line-through',
                color: 'text.disabled',
              }),
            }}
          >
            {task.title}
          </Typography>
        </Box>

        {/* Description preview */}
        {task.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              ...(isDone && { opacity: 0.6 }),
            }}
          >
            {task.description}
          </Typography>
        )}

        {/* Footer row with metadata */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {/* Due date */}
          {task.dueAt && (
            <Tooltip title={isOverdue ? 'Overdue' : 'Due date'}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  color: isOverdue ? 'error.main' : 'text.secondary',
                }}
              >
                <Iconify icon="solar:calendar-date-bold" width={14} />
                <Typography variant="caption" fontWeight={isOverdue ? 600 : 400}>
                  {fDate(task.dueAt)}
                </Typography>
              </Box>
            </Tooltip>
          )}

          {/* Calendar linked indicator */}
          {task.linkedCalendarEventId && (
            <Tooltip title="Linked to calendar">
              <Box sx={{ display: 'flex', alignItems: 'center', color: 'primary.main' }}>
                <Iconify icon="solar:check-circle-bold" width={14} />
              </Box>
            </Tooltip>
          )}

          {/* Recurring indicator */}
          {task.isRecurring && (
            <Tooltip title="Recurring task">
              <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
                <Iconify icon="solar:restart-bold" width={14} />
              </Box>
            </Tooltip>
          )}

          {/* Priority chip (only for high/urgent) */}
          {(task.priority === 'high' || task.priority === 'urgent') && (
            <Chip
              label={priorityConfig.label}
              size="small"
              color={priorityConfig.color}
              variant="soft"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          )}

          {/* Labels */}
          {task.labels && task.labels.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {task.labels.slice(0, 2).map((label) => (
                <Chip
                  key={label}
                  label={label}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
              ))}
              {task.labels.length > 2 && (
                <Tooltip title={task.labels.slice(2).join(', ')}>
                  <Chip
                    label={`+${task.labels.length - 2}`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                </Tooltip>
              )}
            </Box>
          )}

          {/* Spacer */}
          <Box sx={{ flex: 1 }} />

          {/* Assignee avatar */}
          {member && (
            <Tooltip title={member.displayName || member.profile?.displayName || 'Assigned'}>
              <Avatar
                src={member.profile?.avatarUrl || undefined}
                sx={{
                  width: 24,
                  height: 24,
                  fontSize: '0.7rem',
                  bgcolor: member.color || 'grey.400',
                }}
              >
                {(member.displayName || member.profile?.displayName)?.[0]?.toUpperCase()}
              </Avatar>
            </Tooltip>
          )}
        </Box>
      </KanbanItemContent>
    </KanbanItemRoot>
  );
}
