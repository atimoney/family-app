import type { ListItemDTO, FieldDefinition } from '@family/shared';

import { useState, useCallback } from 'react';
import { usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

// ----------------------------------------------------------------------

type GroupedItemRowProps = {
  item: ListItemDTO;
  inlineFields: FieldDefinition[];
  allGroups: { key: string; label: string }[];
  currentGroupKey: string;
  onToggleStatus: () => void;
  onUpdateTitle: (title: string) => void;
  onMoveToGroup: (newGroupKey: string) => void;
  onOpenEditor: () => void;
};

export function GroupedItemRow({
  item,
  inlineFields,
  allGroups,
  currentGroupKey,
  onToggleStatus,
  onUpdateTitle,
  onMoveToGroup,
  onOpenEditor,
}: GroupedItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.title);
  const movePopover = usePopover<HTMLButtonElement>();

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

  // Handle key press
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

  // Handle move to group
  const handleMoveToGroup = useCallback(
    (newGroupKey: string) => {
      if (newGroupKey !== currentGroupKey) {
        onMoveToGroup(newGroupKey);
      }
      movePopover.onClose();
    },
    [currentGroupKey, onMoveToGroup, movePopover]
  );

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.75,
        px: 0.5,
        borderRadius: 1,
        '&:hover': {
          bgcolor: 'action.hover',
        },
        '&:hover .action-buttons': {
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
          sx={{ flex: 1 }}
          slotProps={{
            input: { sx: { py: 0.5 } },
          }}
        />
      ) : (
        <Box
          onClick={handleStartEdit}
          sx={{
            flex: 1,
            cursor: 'pointer',
            minWidth: 0,
          }}
        >
          <Typography
            variant="body2"
            noWrap
            sx={{
              textDecoration: isDone ? 'line-through' : 'none',
              color: isDone ? 'text.disabled' : 'text.primary',
            }}
          >
            {item.title}
          </Typography>
        </Box>
      )}

      {/* Inline field values */}
      {!isEditing && inlineFields.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          {inlineFields.map((field) => {
            const value = item.fields?.[field.key];
            if (value == null || value === '') return null;

            return (
              <Typography
                key={field.key}
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  bgcolor: 'action.selected',
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 0.5,
                }}
              >
                {formatFieldValue(value, field)}
              </Typography>
            );
          })}
        </Box>
      )}

      {/* Action buttons */}
      <Box
        className="action-buttons"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.25,
          opacity: 0,
          transition: 'opacity 0.15s',
        }}
      >
        {/* Move to group */}
        {allGroups.length > 1 && (
          <IconButton size="small" onClick={movePopover.onOpen}>
            <Iconify icon={'solar:transfer-horizontal-bold' as any} width={16} />
          </IconButton>
        )}

        {/* Edit */}
        <IconButton size="small" onClick={onOpenEditor}>
          <Iconify icon={'solar:pen-bold' as any} width={16} />
        </IconButton>
      </Box>

      {/* Move Popover */}
      <CustomPopover
        open={movePopover.open}
        anchorEl={movePopover.anchorEl}
        onClose={movePopover.onClose}
        slotProps={{ arrow: { placement: 'right-top' } }}
      >
        <Typography variant="subtitle2" sx={{ px: 2, py: 1 }}>
          Move to...
        </Typography>
        {allGroups.map((group) => (
          <MenuItem
            key={group.key}
            selected={group.key === currentGroupKey}
            onClick={() => handleMoveToGroup(group.key)}
          >
            {group.key === currentGroupKey && (
              <ListItemIcon>
                <Iconify icon={'solar:check-circle-bold' as any} width={18} />
              </ListItemIcon>
            )}
            <ListItemText inset={group.key !== currentGroupKey}>{group.label}</ListItemText>
          </MenuItem>
        ))}
      </CustomPopover>
    </Box>
  );
}

// ----------------------------------------------------------------------

function formatFieldValue(value: unknown, field: FieldDefinition): string {
  if (value == null) return '';

  // For select fields, get the option label
  if (field.type === 'select' && field.options) {
    const opt = field.options.find((o) => o.value === value);
    return opt?.label ?? String(value);
  }

  // For multi-select, join labels
  if (field.type === 'multi_select' && field.options && Array.isArray(value)) {
    return value
      .map((v) => field.options?.find((o) => o.value === v)?.label ?? String(v))
      .join(', ');
  }

  return String(value);
}
