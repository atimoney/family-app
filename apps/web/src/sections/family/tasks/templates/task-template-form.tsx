import type { TaskTemplate, TaskPriority, FamilyMember, CreateTaskTemplateInput } from '@family/shared';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'default' },
  { value: 'medium', label: 'Medium', color: 'info' },
  { value: 'high', label: 'High', color: 'warning' },
  { value: 'urgent', label: 'Urgent', color: 'error' },
];

const DEFAULT_ICONS = [
  'solar:checklist-bold',
  'solar:home-2-bold',
  'solar:cart-3-bold',
  'solar:calendar-date-bold',
  'solar:phone-calling-bold',
  'solar:document-text-bold',
  'solar:letter-bold',
  'solar:car-bold',
  'solar:heart-bold',
  'solar:star-bold',
];

type Props = {
  open: boolean;
  onClose: () => void;
  template?: TaskTemplate | null;
  members: FamilyMember[];
  onSave: (data: CreateTaskTemplateInput) => void;
  loading?: boolean;
};

export function TaskTemplateForm({
  open,
  onClose,
  template,
  members,
  onSave,
  loading = false,
}: Props) {
  const isEdit = !!template;

  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [defaultAssigneeId, setDefaultAssigneeId] = useState<string | null>(null);
  const [dueDaysFromNow, setDueDaysFromNow] = useState<string>('');
  const [dueTimeOfDay, setDueTimeOfDay] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);

  // Reset form when dialog opens/closes or template changes
  useEffect(() => {
    if (open) {
      if (template) {
        setName(template.name);
        setTitle(template.title);
        setDescription(template.description || '');
        setPriority(template.priority);
        setLabels(template.labels);
        setDefaultAssigneeId(template.defaultAssigneeId || null);
        setDueDaysFromNow(template.dueDaysFromNow?.toString() || '');
        setDueTimeOfDay(template.dueTimeOfDay || '');
        setIcon(template.icon || null);
        setColor(template.color || null);
      } else {
        setName('');
        setTitle('');
        setDescription('');
        setPriority('medium');
        setLabels([]);
        setDefaultAssigneeId(null);
        setDueDaysFromNow('');
        setDueTimeOfDay('');
        setIcon(null);
        setColor(null);
      }
      setLabelInput('');
    }
  }, [open, template]);

  const handleAddLabel = useCallback(() => {
    const trimmed = labelInput.trim();
    if (trimmed && !labels.includes(trimmed)) {
      setLabels([...labels, trimmed]);
      setLabelInput('');
    }
  }, [labelInput, labels]);

  const handleRemoveLabel = useCallback((labelToRemove: string) => {
    setLabels((prev) => prev.filter((l) => l !== labelToRemove));
  }, []);

  const handleSubmit = useCallback(() => {
    const data: CreateTaskTemplateInput = {
      name: name.trim(),
      title: title.trim(),
      description: description.trim() || null,
      priority,
      labels,
      defaultAssigneeId: defaultAssigneeId || null,
      dueDaysFromNow: dueDaysFromNow ? parseInt(dueDaysFromNow, 10) : null,
      dueTimeOfDay: dueTimeOfDay || null,
      icon,
      color,
    };
    onSave(data);
  }, [name, title, description, priority, labels, defaultAssigneeId, dueDaysFromNow, dueTimeOfDay, icon, color, onSave]);

  const isValid = name.trim() && title.trim();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Edit Template' : 'Create Template'}</DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1 }}>
          {/* Basic Info */}
          <TextField
            required
            fullWidth
            label="Template Name"
            placeholder="e.g., Morning Chores"
            helperText="Internal name to identify this template"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <TextField
            required
            fullWidth
            label="Task Title"
            placeholder="e.g., Complete morning routine"
            helperText="Default title for tasks created from this template"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <TextField
            fullWidth
            multiline
            rows={2}
            label="Description"
            placeholder="Optional description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {/* Priority & Assignee */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              fullWidth
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              fullWidth
              label="Default Assignee"
              value={defaultAssigneeId || ''}
              onChange={(e) => setDefaultAssigneeId(e.target.value || null)}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {members.map((member) => (
                <MenuItem key={member.id} value={member.id}>
                  {member.displayName || member.profile?.displayName || 'Unknown'}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          {/* Due Date Settings */}
          <Typography variant="subtitle2" sx={{ mt: 1 }}>
            Due Date (relative)
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              type="number"
              label="Days from now"
              placeholder="e.g., 1 for tomorrow"
              value={dueDaysFromNow}
              onChange={(e) => setDueDaysFromNow(e.target.value)}
              InputProps={{
                inputProps: { min: 0, max: 365 },
                endAdornment: <InputAdornment position="end">days</InputAdornment>,
              }}
            />

            <TextField
              fullWidth
              type="time"
              label="Time of day"
              value={dueTimeOfDay}
              onChange={(e) => setDueTimeOfDay(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>

          {/* Labels */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Labels
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <TextField
                size="small"
                placeholder="Add label..."
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddLabel();
                  }
                }}
                sx={{ flex: 1 }}
              />
              <Button variant="outlined" onClick={handleAddLabel} disabled={!labelInput.trim()}>
                Add
              </Button>
            </Stack>
            {labels.length > 0 && (
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {labels.map((label) => (
                  <Chip
                    key={label}
                    label={label}
                    size="small"
                    onDelete={() => handleRemoveLabel(label)}
                    sx={{ mt: 0.5 }}
                  />
                ))}
              </Stack>
            )}
          </Box>

          {/* Icon Selection */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Icon (optional)
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {DEFAULT_ICONS.map((iconName) => (
                <Box
                  key={iconName}
                  onClick={() => setIcon(icon === iconName ? null : iconName)}
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: icon === iconName ? 'primary.main' : 'transparent',
                    bgcolor: icon === iconName ? 'primary.lighter' : 'background.neutral',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <Iconify icon={iconName as any} width={24} />
                </Box>
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!isValid || loading}
          startIcon={loading ? undefined : <Iconify icon="eva:checkmark-fill" />}
        >
          {loading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
