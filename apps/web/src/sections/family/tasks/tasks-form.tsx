import type { FamilyMember } from '@family/shared';
import type { Task, TaskStatus, TaskPriority, CreateTaskInput, TaskRecurrenceRule } from 'src/features/tasks';

import * as z from 'zod';
import dayjs from 'dayjs';
import { useForm } from 'react-hook-form';
import { useMemo, useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Avatar from '@mui/material/Avatar';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

import { Iconify } from 'src/components/iconify';

import { TaskRecurrencePicker } from './task-recurrence-picker';
import { TaskCalendarLinkButton } from './task-calendar-link-button';

// ----------------------------------------------------------------------

const STATUS_OPTIONS: { value: TaskStatus; label: string; color: 'default' | 'warning' | 'info' | 'success' }[] = [
  { value: 'todo', label: 'To Do', color: 'default' },
  { value: 'doing', label: 'In Progress', color: 'info' },
  { value: 'done', label: 'Done', color: 'success' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: 'default' | 'info' | 'warning' | 'error' }[] = [
  { value: 'low', label: 'Low', color: 'default' },
  { value: 'medium', label: 'Medium', color: 'info' },
  { value: 'high', label: 'High', color: 'warning' },
  { value: 'urgent', label: 'Urgent', color: 'error' },
];

// ----------------------------------------------------------------------

const TaskFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(['todo', 'doing', 'done']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  dueAt: z.any().nullable().optional(), // dayjs object or null
  assignedToUserId: z.string().nullable().optional(),
  labels: z.array(z.string()),
});

type TaskFormValues = z.infer<typeof TaskFormSchema>;

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: () => void;
  currentTask?: Task | null;
  familyMembers?: FamilyMember[];
  onSubmit: (data: CreateTaskInput) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
  onTaskUpdate?: (task: Task) => void; // For calendar link updates
};

export function TasksForm({
  open,
  onClose,
  currentTask,
  familyMembers = [],
  onSubmit,
  onDelete,
  onTaskUpdate,
}: Props) {
  const isEdit = !!currentTask;

  // Local task state for calendar linking updates
  const [localTask, setLocalTask] = useState<Task | null>(currentTask ?? null);

  // Recurrence state (managed separately from react-hook-form for simplicity)
  const [recurrence, setRecurrence] = useState<TaskRecurrenceRule | null>(
    currentTask?.recurrence ?? null
  );

  // Sync local task when currentTask changes
  useEffect(() => {
    setLocalTask(currentTask ?? null);
  }, [currentTask]);

  // Handle calendar link updates
  const handleTaskUpdate = (updatedTask: Task) => {
    setLocalTask(updatedTask);
    onTaskUpdate?.(updatedTask);
  };

  const defaultValues: TaskFormValues = useMemo(
    () => ({
      title: currentTask?.title ?? '',
      description: currentTask?.description ?? '',
      status: (currentTask?.status as TaskStatus) ?? 'todo',
      priority: (currentTask?.priority as TaskPriority) ?? 'medium',
      dueAt: currentTask?.dueAt ? dayjs(currentTask.dueAt) : null,
      assignedToUserId: currentTask?.assignedToUserId ?? null,
      labels: currentTask?.labels ?? [],
    }),
    [currentTask]
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(TaskFormSchema),
    defaultValues,
  });

  // Reset form when task changes
  useEffect(() => {
    reset(defaultValues);
    setRecurrence(currentTask?.recurrence ?? null);
  }, [defaultValues, reset, currentTask]);

  const watchedAssignee = watch('assignedToUserId');
  const watchedStatus = watch('status');
  const watchedPriority = watch('priority');
  const watchedDueAt = watch('dueAt');
  const watchedLabels = watch('labels');

  const selectedMember = familyMembers.find((m) => m.id === watchedAssignee);

  const handleFormSubmit = async (data: TaskFormValues) => {
    const submitData: CreateTaskInput = {
      title: data.title,
      description: data.description || null,
      status: data.status,
      priority: data.priority,
      dueAt: data.dueAt ? dayjs(data.dueAt).toISOString() : null,
      assignedToUserId: data.assignedToUserId || null,
      labels: data.labels,
      recurrence,
    };
    await onSubmit(submitData);
    onClose();
  };

  const handleDelete = async () => {
    if (currentTask && onDelete) {
      await onDelete(currentTask.id);
      onClose();
    }
  };

  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { maxHeight: '90vh' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {isEdit ? 'Edit Task' : 'New Task'}
        <IconButton onClick={onClose} edge="end">
          <Iconify icon="mingcute:close-line" />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogContent dividers sx={{ pt: 2 }}>
          <Stack spacing={3}>
            {/* Title */}
            <TextField
              {...register('title')}
              label="Title"
              fullWidth
              error={!!errors.title}
              helperText={errors.title?.message}
              autoFocus={!isEdit}
            />

            {/* Description */}
            <TextField
              {...register('description')}
              label="Description"
              fullWidth
              multiline
              rows={3}
              error={!!errors.description}
              helperText={errors.description?.message}
            />

            {/* Status & Priority Row */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                select
                label="Status"
                value={watchedStatus}
                onChange={(e) => setValue('status', e.target.value as TaskStatus)}
                sx={{ flex: 1 }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Chip
                      size="small"
                      label={option.label}
                      color={option.color}
                      sx={{ mr: 1 }}
                    />
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Priority"
                value={watchedPriority}
                onChange={(e) => setValue('priority', e.target.value as TaskPriority)}
                sx={{ flex: 1 }}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Chip
                      size="small"
                      label={option.label}
                      color={option.color}
                      sx={{ mr: 1 }}
                    />
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            {/* Due Date */}
            <DateTimePicker
              label="Due Date"
              value={watchedDueAt}
              onChange={(newValue) => setValue('dueAt', newValue)}
              slotProps={{
                textField: { fullWidth: true },
                actionBar: { actions: ['clear', 'today', 'accept'] },
              }}
            />

            {/* Recurrence */}
            <TaskRecurrencePicker
              value={recurrence}
              onChange={setRecurrence}
              disabled={!watchedDueAt} // Require due date for recurrence
            />

            {/* Calendar Link - only show for existing tasks */}
            {isEdit && localTask && (
              <TaskCalendarLinkButton
                task={localTask}
                onUpdate={handleTaskUpdate}
              />
            )}

            {/* Assignee */}
            <Autocomplete
              options={familyMembers}
              getOptionLabel={(option) => option.displayName || option.profile?.displayName || 'Member'}
              value={selectedMember || null}
              onChange={(_, newValue) => setValue('assignedToUserId', newValue?.id || null)}
              renderInput={(params) => <TextField {...params} label="Assign to" />}
              renderOption={(props, option) => {
                const { key, ...rest } = props as { key: string } & React.HTMLAttributes<HTMLLIElement>;
                return (
                  <li key={key} {...rest}>
                    <Avatar
                      src={option.profile?.avatarUrl || undefined}
                      sx={{ width: 24, height: 24, mr: 1, bgcolor: option.color || 'grey.500' }}
                    >
                      {(option.displayName || option.profile?.displayName || 'M').charAt(0)}
                    </Avatar>
                    {option.displayName || option.profile?.displayName || 'Member'}
                  </li>
                );
              }}
            />

            {/* Labels */}
            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={watchedLabels}
              onChange={(_, newValue) => setValue('labels', newValue as string[])}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...rest } = getTagProps({ index });
                  return <Chip key={key} label={option} size="small" {...rest} />;
                })
              }
              renderInput={(params) => (
                <TextField {...params} label="Labels" placeholder="Add labels..." />
              )}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          {isEdit && onDelete && (
            <Button color="error" onClick={handleDelete} sx={{ mr: 'auto' }}>
              Delete
            </Button>
          )}
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
