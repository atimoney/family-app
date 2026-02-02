import type { ListItemDTO, FieldDefinition } from '@family/shared';

import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ButtonBase from '@mui/material/ButtonBase';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type ListItemRowProps = {
  item: ListItemDTO;
  inlineFields: FieldDefinition[];
  onToggleStatus: () => void;
  onUpdateTitle: (title: string) => void;
  onOpenEditor: () => void;
};

export function ListItemRow({
  item,
  inlineFields,
  onToggleStatus,
  onUpdateTitle,
  onOpenEditor,
}: ListItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.title);

  const isDone = item.status === 'done';

  // Start editing
  const handleStartEdit = useCallback(() => {
    setEditValue(item.title);
    setIsEditing(true);
  }, [item.title]);

  // Save edit
  const handleSaveEdit = useCallback(() => {
    setIsEditing(false);
    if (editValue.trim() && editValue !== item.title) {
      onUpdateTitle(editValue.trim());
    } else {
      setEditValue(item.title);
    }
  }, [editValue, item.title, onUpdateTitle]);

  // Cancel edit
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue(item.title);
  }, [item.title]);

  // Handle key press in edit mode
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSaveEdit();
      } else if (e.key === 'Escape') {
        handleCancelEdit();
      }
    },
    [handleSaveEdit, handleCancelEdit]
  );

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 1,
        px: 0.5,
        borderRadius: 1,
        '&:hover': {
          bgcolor: 'action.hover',
        },
        '&:hover .more-button': {
          opacity: 1,
        },
      }}
    >
      {/* Checkbox */}
      <Checkbox
        checked={isDone}
        onChange={onToggleStatus}
        size="small"
        sx={{ p: 0.5 }}
      />

      {/* Title */}
      {isEditing ? (
        <TextField
          autoFocus
          size="small"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSaveEdit}
          onKeyDown={handleKeyDown}
          sx={{
            flex: 1,
            '& .MuiInputBase-input': {
              py: 0.5,
              fontSize: '0.875rem',
            },
          }}
        />
      ) : (
        <ButtonBase
          onClick={handleStartEdit}
          sx={{
            flex: 1,
            justifyContent: 'flex-start',
            textAlign: 'left',
            minHeight: 32,
            borderRadius: 0.5,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              textDecoration: isDone ? 'line-through' : 'none',
              color: isDone ? 'text.disabled' : 'text.primary',
            }}
          >
            {item.title}
          </Typography>
        </ButtonBase>
      )}

      {/* Inline fields */}
      {!isEditing && inlineFields.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          {inlineFields.map((field) => (
            <InlineFieldValue
              key={field.key}
              field={field}
              value={item.fields[field.key]}
              isDone={isDone}
            />
          ))}
        </Box>
      )}

      {/* More button */}
      <IconButton
        className="more-button"
        size="small"
        onClick={onOpenEditor}
        sx={{
          opacity: 0,
          transition: 'opacity 0.2s',
          flexShrink: 0,
        }}
      >
        <Iconify icon={'solar:menu-dots-bold' as any} width={16} />
      </IconButton>
    </Box>
  );
}

// ----------------------------------------------------------------------

type InlineFieldValueProps = {
  field: FieldDefinition;
  value: unknown;
  isDone: boolean;
};

function InlineFieldValue({ field, value, isDone }: InlineFieldValueProps) {
  // Skip if no value
  if (value === undefined || value === null || value === '') {
    return null;
  }

  let displayValue: string;

  switch (field.type) {
    case 'select': {
      const option = field.options?.find((opt) => opt.value === value);
      displayValue = option?.label ?? String(value);
      break;
    }
    case 'number':
      displayValue = String(value);
      break;
    case 'checkbox':
      displayValue = value ? '✓' : '✗';
      break;
    case 'date':
    case 'datetime':
      displayValue = value ? new Date(value as string).toLocaleDateString() : '';
      break;
    default:
      displayValue = String(value);
  }

  // For quantity + unit, combine them
  if (field.key === 'quantity') {
    return (
      <Typography
        variant="caption"
        sx={{
          color: isDone ? 'text.disabled' : 'text.secondary',
          bgcolor: 'background.neutral',
          px: 0.75,
          py: 0.25,
          borderRadius: 0.5,
          fontWeight: 500,
        }}
      >
        {displayValue}
      </Typography>
    );
  }

  // For unit, show without background
  if (field.key === 'unit') {
    return (
      <Typography
        variant="caption"
        sx={{ color: isDone ? 'text.disabled' : 'text.secondary' }}
      >
        {displayValue}
      </Typography>
    );
  }

  // For meal slot / day, show as chips
  if (field.key === 'meal_slot' || field.key === 'day_of_week') {
    return (
      <Typography
        variant="caption"
        sx={{
          color: isDone ? 'text.disabled' : 'primary.main',
          bgcolor: isDone ? 'transparent' : 'primary.lighter',
          px: 0.75,
          py: 0.25,
          borderRadius: 0.5,
          fontWeight: 500,
        }}
      >
        {displayValue}
      </Typography>
    );
  }

  // Default display
  return (
    <Typography
      variant="caption"
      sx={{ color: isDone ? 'text.disabled' : 'text.secondary' }}
    >
      {displayValue}
    </Typography>
  );
}
