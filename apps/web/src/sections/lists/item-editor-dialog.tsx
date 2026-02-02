import type { ListItemDTO, FieldDefinition, UpdateListItemInput } from '@family/shared';

import { useBoolean } from 'minimal-shared/hooks';
import { useState, useEffect, useCallback } from 'react';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';

import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

// ----------------------------------------------------------------------

type ItemEditorDialogProps = {
  open: boolean;
  item: ListItemDTO | null;
  fields: FieldDefinition[];
  onClose: () => void;
  onSave: (input: UpdateListItemInput) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  loading?: boolean;
  /** Initial values for creating new items (used when item is null) */
  initialValues?: {
    title?: string;
    fields?: Record<string, unknown>;
  };
};

export function ItemEditorDialog({
  open,
  item,
  fields,
  onClose,
  onSave,
  onDelete,
  loading,
  initialValues,
}: ItemEditorDialogProps) {
  // Form state
  const [title, setTitle] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const deleteDialog = useBoolean();

  // Initialize form when item or initialValues change
  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setFieldValues(item.fields ?? {});
    } else if (initialValues) {
      setTitle(initialValues.title ?? '');
      setFieldValues(initialValues.fields ?? {});
    } else {
      setTitle('');
      setFieldValues({});
    }
  }, [item, initialValues]);

  // Handle field change
  const handleFieldChange = useCallback((key: string, value: unknown) => {
    setFieldValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        fields: fieldValues,
      });
    } finally {
      setSaving(false);
    }
  }, [title, fieldValues, onSave]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!item) return;
    await onDelete(item.id);
    deleteDialog.onFalse();
  }, [item, onDelete, deleteDialog]);

  // Determine if we're in create or edit mode
  const isCreateMode = !item && initialValues !== undefined;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">{isCreateMode ? 'Add Item' : 'Edit Item'}</Typography>
            {!isCreateMode && item && (
              <Button
                size="small"
                color="error"
                startIcon={<Iconify icon={'solar:trash-bin-trash-bold' as any} />}
                onClick={deleteDialog.onTrue}
              >
                Delete
              </Button>
            )}
          </Stack>
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {/* Title field */}
            <TextField
              fullWidth
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />

            {/* Dynamic fields */}
            {fields.map((field) => (
              <FieldInput
                key={field.key}
                field={field}
                value={fieldValues[field.key]}
                onChange={(value) => handleFieldChange(field.key, value)}
              />
            ))}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={saving || loading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!title.trim() || saving || loading}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isCreateMode ? 'Add' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      {item && (
        <ConfirmDialog
          open={deleteDialog.value}
          onClose={deleteDialog.onFalse}
          title="Delete Item"
          content={`Are you sure you want to delete "${item.title}"?`}
          action={
            <Button variant="contained" color="error" onClick={handleDelete}>
              Delete
            </Button>
          }
        />
      )}
    </>
  );
}

// ----------------------------------------------------------------------

type FieldInputProps = {
  field: FieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
};

function FieldInput({ field, value, onChange }: FieldInputProps) {
  switch (field.type) {
    case 'text':
      return (
        <TextField
          fullWidth
          label={field.label}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          multiline={field.key === 'notes'}
          rows={field.key === 'notes' ? 3 : undefined}
        />
      );

    case 'number':
      return (
        <TextField
          fullWidth
          label={field.label}
          type="number"
          value={(value as number) ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          required={field.required}
          slotProps={{
            htmlInput: { min: 0 },
          }}
        />
      );

    case 'checkbox':
      return (
        <FormControlLabel
          control={
            <Checkbox
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
            />
          }
          label={field.label}
        />
      );

    case 'select':
      return (
        <FormControl fullWidth required={field.required}>
          <InputLabel>{field.label}</InputLabel>
          <Select
            value={(value as string) ?? ''}
            label={field.label}
            onChange={(e) => onChange(e.target.value)}
          >
            {!field.required && (
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
            )}
            {field.options?.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );

    case 'multi_select':
      return (
        <FormControl fullWidth required={field.required}>
          <InputLabel>{field.label}</InputLabel>
          <Select
            multiple
            value={Array.isArray(value) ? value : []}
            label={field.label}
            onChange={(e) => onChange(e.target.value)}
            renderValue={(selected) => {
              const selectedLabels = (selected as string[])
                .map((v) => field.options?.find((opt) => opt.value === v)?.label ?? v)
                .join(', ');
              return selectedLabels;
            }}
          >
            {field.options?.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );

    case 'date':
      return (
        <TextField
          fullWidth
          label={field.label}
          type="date"
          value={value ? (value as string).split('T')[0] : ''}
          onChange={(e) => onChange(e.target.value || null)}
          required={field.required}
          slotProps={{
            inputLabel: { shrink: true },
          }}
        />
      );

    case 'datetime':
      return (
        <TextField
          fullWidth
          label={field.label}
          type="datetime-local"
          value={value ? (value as string).slice(0, 16) : ''}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
          required={field.required}
          slotProps={{
            inputLabel: { shrink: true },
          }}
        />
      );

    case 'url':
      return (
        <TextField
          fullWidth
          label={field.label}
          type="url"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          placeholder="https://..."
        />
      );

    case 'user':
      // TODO: Implement user picker with family members
      return (
        <TextField
          fullWidth
          label={field.label}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          placeholder="User ID"
          helperText="User picker coming soon"
        />
      );

    default:
      return (
        <TextField
          fullWidth
          label={field.label}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
  }
}
