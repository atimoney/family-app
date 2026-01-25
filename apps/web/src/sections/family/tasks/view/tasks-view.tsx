import type { Task, FamilyMember } from '@family/shared';

import { useState, useCallback } from 'react';
import { varAlpha } from 'minimal-shared/utils';
import { useBoolean, useSetState } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import TableBody from '@mui/material/TableBody';
import Typography from '@mui/material/Typography';

import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { Scrollbar } from 'src/components/scrollbar';

import { TaskTableRow } from '../task-table-row';
import { TaskQuickAdd } from '../task-quick-add';

// ----------------------------------------------------------------------

// Mock family members
const FAMILY_MEMBERS: FamilyMember[] = [
  { id: 'member-1', name: 'Dad', avatarUrl: '', role: 'parent' },
  { id: 'member-2', name: 'Mom', avatarUrl: '', role: 'parent' },
  { id: 'member-3', name: 'Alex', avatarUrl: '', role: 'child' },
  { id: 'member-4', name: 'Emma', avatarUrl: '', role: 'child' },
];

// Mock initial tasks
const INITIAL_TASKS: Task[] = [
  {
    id: 'task-1',
    title: 'Take out the trash',
    assigneeId: 'member-3',
    dueDate: '2026-01-26',
    completed: false,
    createdAt: '2026-01-24T10:00:00.000Z',
  },
  {
    id: 'task-2',
    title: 'Walk the dog',
    assigneeId: 'member-4',
    dueDate: '2026-01-25',
    completed: true,
    createdAt: '2026-01-23T08:00:00.000Z',
  },
  {
    id: 'task-3',
    title: 'Grocery shopping',
    assigneeId: 'member-2',
    dueDate: '2026-01-27',
    completed: false,
    createdAt: '2026-01-24T14:00:00.000Z',
  },
  {
    id: 'task-4',
    title: 'Fix leaky faucet',
    assigneeId: 'member-1',
    dueDate: '2026-01-28',
    completed: false,
    createdAt: '2026-01-25T09:00:00.000Z',
  },
  {
    id: 'task-5',
    title: 'Clean bedroom',
    assigneeId: 'member-3',
    dueDate: '2026-01-25',
    completed: true,
    createdAt: '2026-01-22T11:00:00.000Z',
  },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'done', label: 'Done' },
];

type TaskFilters = {
  status: string;
};

// ----------------------------------------------------------------------

export function TasksView() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);

  const filters = useSetState<TaskFilters>({ status: 'all' });
  const { state: currentFilters, setState: updateFilters } = filters;

  // Filter tasks based on status
  const filteredTasks = applyFilter({ inputData: tasks, filters: currentFilters });

  const handleFilterStatus = useCallback(
    (event: React.SyntheticEvent, newValue: string) => {
      updateFilters({ status: newValue });
    },
    [updateFilters]
  );

  const handleAddTask = useCallback((title: string) => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);
  }, []);

  const handleToggleComplete = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task))
    );
  }, []);

  const handleDeleteTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  }, []);

  const getMemberById = (id?: string): FamilyMember | undefined =>
    FAMILY_MEMBERS.find((m) => m.id === id);

  const openCount = tasks.filter((t) => !t.completed).length;
  const doneCount = tasks.filter((t) => t.completed).length;

  return (
    <DashboardContent maxWidth="xl">
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: { xs: 3, md: 5 } }}
      >
        <Typography variant="h4">Tasks</Typography>
      </Stack>

      <TaskQuickAdd onAdd={handleAddTask} />

      <Card sx={{ mt: 3 }}>
        <Tabs
          value={currentFilters.status}
          onChange={handleFilterStatus}
          sx={[
            (theme) => ({
              px: { md: 2.5 },
              boxShadow: `inset 0 -2px 0 0 ${varAlpha(theme.vars.palette.grey['500Channel'], 0.08)}`,
            }),
          ]}
        >
          {STATUS_OPTIONS.map((tab) => (
            <Tab
              key={tab.value}
              iconPosition="end"
              value={tab.value}
              label={tab.label}
              icon={
                <Label
                  variant={
                    (tab.value === 'all' || tab.value === currentFilters.status) ? 'filled' : 'soft'
                  }
                  color={
                    (tab.value === 'done' && 'success') ||
                    (tab.value === 'open' && 'warning') ||
                    'default'
                  }
                >
                  {tab.value === 'all' && tasks.length}
                  {tab.value === 'open' && openCount}
                  {tab.value === 'done' && doneCount}
                </Label>
              }
            />
          ))}
        </Tabs>

        <Scrollbar sx={{ minHeight: 400 }}>
          <Table size="medium" sx={{ minWidth: 640 }}>
            <TableBody>
              {filteredTasks.length === 0 ? (
                <Box
                  component="tr"
                  sx={{ '& td': { border: 0, py: 6, textAlign: 'center' } }}
                >
                  <Box component="td" colSpan={5}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      No tasks found
                    </Typography>
                  </Box>
                </Box>
              ) : (
                filteredTasks.map((task) => (
                  <TaskTableRow
                    key={task.id}
                    task={task}
                    assignee={getMemberById(task.assigneeId)}
                    onToggleComplete={() => handleToggleComplete(task.id)}
                    onDelete={() => handleDeleteTask(task.id)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </Scrollbar>
      </Card>
    </DashboardContent>
  );
}

// ----------------------------------------------------------------------

type ApplyFilterProps = {
  inputData: Task[];
  filters: TaskFilters;
};

function applyFilter({ inputData, filters }: ApplyFilterProps): Task[] {
  const { status } = filters;

  if (status === 'open') {
    return inputData.filter((task) => !task.completed);
  }

  if (status === 'done') {
    return inputData.filter((task) => task.completed);
  }

  return inputData;
}
