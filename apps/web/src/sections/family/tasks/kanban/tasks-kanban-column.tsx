import type { DragEvent } from 'react';
import type { FamilyMember } from '@family/shared';
import type { Task, TaskStatus } from 'src/features/tasks';

import { useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';

import { KanbanTaskItem } from './tasks-kanban-item';
import {
  KanbanColumnRoot,
  KanbanColumnList,
  KanbanColumnHeader,
  KanbanColumnWrapper,
  KanbanDropPlaceholder,
} from './tasks-kanban-styles';

// ----------------------------------------------------------------------

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: 'default' | 'info' | 'success' }> =
  {
    todo: { label: 'To Do', color: 'default' },
    doing: { label: 'In Progress', color: 'info' },
    done: { label: 'Done', color: 'success' },
  };

// ----------------------------------------------------------------------

type KanbanColumnProps = {
  status: TaskStatus;
  tasks: Task[];
  familyMembers: FamilyMember[];
  onTaskClick: (task: Task) => void;
  onTaskDrop: (taskId: string, newStatus: TaskStatus) => void;
  onToggleStatus: (task: Task) => void;
};

export function KanbanColumn({
  status,
  tasks,
  familyMembers,
  onTaskClick,
  onTaskDrop,
  onToggleStatus,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const config = STATUS_CONFIG[status];

  // Member lookup
  const memberById = useMemo(
    () => new Map(familyMembers.map((m) => [m.id, m])),
    [familyMembers]
  );

  // Sort tasks by sortOrder, then by dueAt
  const sortedTasks = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        // First by sortOrder
        const orderA = a.sortOrder ?? 999;
        const orderB = b.sortOrder ?? 999;
        if (orderA !== orderB) return orderA - orderB;

        // Then by dueAt (earlier first, null last)
        if (a.dueAt && b.dueAt) {
          return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        }
        if (a.dueAt) return -1;
        if (b.dueAt) return 1;

        // Finally by createdAt
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [tasks]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);

      const taskId = e.dataTransfer.getData('text/plain');
      if (taskId) {
        onTaskDrop(taskId, status);
      }
    },
    [onTaskDrop, status]
  );

  return (
    <KanbanColumnWrapper>
      <KanbanColumnRoot
        data-drag-over={isDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <KanbanColumnHeader>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {config.label}
            </Typography>
            <Chip label={tasks.length} size="small" color={config.color} variant="soft" />
          </Box>
        </KanbanColumnHeader>

        <KanbanColumnList>
          {sortedTasks.map((task) => (
            <KanbanTaskItem
              key={task.id}
              task={task}
              member={task.assignedToUserId ? memberById.get(task.assignedToUserId) : undefined}
              onClick={() => onTaskClick(task)}
              onToggleStatus={() => onToggleStatus(task)}
            />
          ))}

          {/* Drop placeholder when dragging over empty column */}
          {isDragOver && tasks.length === 0 && (
            <KanbanDropPlaceholder sx={{ minHeight: 80 }} />
          )}
        </KanbanColumnList>
      </KanbanColumnRoot>
    </KanbanColumnWrapper>
  );
}
