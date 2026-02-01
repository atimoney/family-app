import type { FamilyMember } from '@family/shared';
import type { Task, TaskStatus } from 'src/features/tasks';

import { useMemo, useCallback } from 'react';

import GlobalStyles from '@mui/material/GlobalStyles';

import { KanbanColumn } from './tasks-kanban-column';
import { KanbanBoardRoot, kanbanGlobalStyles } from './tasks-kanban-styles';

// ----------------------------------------------------------------------

const COLUMN_ORDER: TaskStatus[] = ['todo', 'doing', 'done'];

// ----------------------------------------------------------------------

type TasksKanbanViewProps = {
  tasks: Task[];
  familyMembers: FamilyMember[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onToggleStatus: (task: Task) => void;
};

export function TasksKanbanView({
  tasks,
  familyMembers,
  onTaskClick,
  onStatusChange,
  onToggleStatus,
}: TasksKanbanViewProps) {
  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      todo: [],
      doing: [],
      done: [],
    };

    tasks.forEach((task) => {
      const status = (task.status as TaskStatus) || 'todo';
      if (grouped[status]) {
        grouped[status].push(task);
      }
    });

    return grouped;
  }, [tasks]);

  // Handle task drop to change status
  const handleTaskDrop = useCallback(
    (taskId: string, newStatus: TaskStatus) => {
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.status !== newStatus) {
        onStatusChange(taskId, newStatus);
      }
    },
    [tasks, onStatusChange]
  );

  return (
    <>
      <GlobalStyles styles={{ body: kanbanGlobalStyles }} />

      <KanbanBoardRoot>
        {COLUMN_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            familyMembers={familyMembers}
            onTaskClick={onTaskClick}
            onTaskDrop={handleTaskDrop}
            onToggleStatus={onToggleStatus}
          />
        ))}
      </KanbanBoardRoot>
    </>
  );
}
