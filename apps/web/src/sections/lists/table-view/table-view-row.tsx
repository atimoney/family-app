import type { ListItemDTO } from '@family/shared';
import type { ColumnDef } from './table-view';

import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Select from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type TableViewRowProps = {
  item: ListItemDTO;
  columns: ColumnDef[];
  onToggleStatus: () => void;
  onUpdateField: (fieldKey: string, value: unknown) => Promise<void>;
  onOpenEditor: () => void;
};

export function TableViewRow({
  item,
  columns,
  onToggleStatus,
  onUpdateField,
  onOpenEditor,
}: TableViewRowProps) {
  const isDone = item.status === 'done';

  return (
    <TableRow
      hover
      sx={{
        ...(isDone && {
          bgcolor: 'action.hover',
          '& *': { color: 'text.disabled' },
        }),
      }}
    >
      {/* Status checkbox */}
      <TableCell padding="checkbox">
        <Checkbox
          checked={isDone}
          onChange={onToggleStatus}
          sx={{
            '&.Mui-checked': {
              color: 'success.main',
            },
          }}
        />
      </TableCell>

      {/* Dynamic columns */}
      {columns.map((col) => (
        <TableCell key={col.key}>
          <CellContent
            item={item}
            column={col}
            onUpdateField={onUpdateField}
          />
        </TableCell>
      ))}

      {/* Actions */}
      <TableCell>
        <Tooltip title="Edit">
          <IconButton size="small" onClick={onOpenEditor}>
            <Iconify icon={'solar:pen-bold' as any} width={18} />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}

// ----------------------------------------------------------------------

type CellContentProps = {
  item: ListItemDTO;
  column: ColumnDef;
  onUpdateField: (fieldKey: string, value: unknown) => Promise<void>;
};

function CellContent({ item, column, onUpdateField }: CellContentProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState<unknown>(null);

  const isDone = item.status === 'done';
  const value = column.key === 'title' ? item.title : item.fields?.[column.key];

  // Start editing
  const handleStartEdit = useCallback(() => {
    if (isDone) return; // Don't allow editing done items inline
    setEditValue(value);
    setEditing(true);
  }, [isDone, value]);

  // Save edit
  const handleSaveEdit = useCallback(async () => {
    if (editValue !== value) {
      await onUpdateField(column.key, editValue);
    }
    setEditing(false);
  }, [editValue, value, column.key, onUpdateField]);

  // Cancel edit
  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    setEditValue(null);
  }, []);

  // Handle keyboard
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

  // Render based on column type
  switch (column.type) {
    case 'title':
      return editing ? (
        <TextField
          autoFocus
          fullWidth
          size="small"
          variant="standard"
          value={editValue as string}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSaveEdit}
          onKeyDown={handleKeyDown}
          sx={{ minWidth: 100 }}
        />
      ) : (
        <Box
          onClick={handleStartEdit}
          sx={{
            cursor: isDone ? 'default' : 'pointer',
            textDecoration: isDone ? 'line-through' : 'none',
            '&:hover': isDone ? {} : { textDecoration: 'underline' },
          }}
        >
          {item.title}
        </Box>
      );

    case 'status':
      return (
        <Label
          variant="soft"
          color={item.status === 'done' ? 'success' : item.status === 'open' ? 'info' : 'default'}
        >
          {item.status}
        </Label>
      );

    case 'checkbox':
      return (
        <Checkbox
          checked={Boolean(value)}
          onChange={(e) => onUpdateField(column.key, e.target.checked)}
          size="small"
          disabled={isDone}
        />
      );

    case 'number':
      return editing ? (
        <TextField
          autoFocus
          type="number"
          size="small"
          variant="standard"
          value={editValue as number ?? ''}
          onChange={(e) => setEditValue(e.target.value ? Number(e.target.value) : null)}
          onBlur={handleSaveEdit}
          onKeyDown={handleKeyDown}
          sx={{ width: 80 }}
          slotProps={{ htmlInput: { min: 0 } }}
        />
      ) : (
        <Box
          onClick={handleStartEdit}
          sx={{
            cursor: isDone ? 'default' : 'pointer',
            '&:hover': isDone ? {} : { bgcolor: 'action.hover' },
            px: 0.5,
            borderRadius: 0.5,
          }}
        >
          {value != null ? String(value) : '—'}
        </Box>
      );

    case 'select': {
      if (editing) {
        return (
          <Select
            autoFocus
            size="small"
            variant="standard"
            value={(editValue as string) ?? ''}
            onChange={(e) => {
              onUpdateField(column.key, e.target.value || null);
              setEditing(false);
            }}
            onClose={() => setEditing(false)}
            open
            sx={{ minWidth: 100 }}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {column.field?.options?.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        );
      }
      const selectedOption = column.field?.options?.find((opt) => opt.value === value);
      return (
        <Box
          onClick={handleStartEdit}
          sx={{
            cursor: isDone ? 'default' : 'pointer',
            '&:hover': isDone ? {} : { bgcolor: 'action.hover' },
            px: 0.5,
            borderRadius: 0.5,
          }}
        >
          {selectedOption ? (
            <Label variant="soft" color={getOptionColor(selectedOption.color)}>
              {selectedOption.label}
            </Label>
          ) : (
            '—'
          )}
        </Box>
      );
    }

    case 'date':
      return editing ? (
        <TextField
          autoFocus
          type="date"
          size="small"
          variant="standard"
          value={value ? (value as string).split('T')[0] : ''}
          onChange={(e) => setEditValue(e.target.value || null)}
          onBlur={handleSaveEdit}
          onKeyDown={handleKeyDown}
          sx={{ width: 140 }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      ) : (
        <Box
          onClick={handleStartEdit}
          sx={{
            cursor: isDone ? 'default' : 'pointer',
            '&:hover': isDone ? {} : { bgcolor: 'action.hover' },
            px: 0.5,
            borderRadius: 0.5,
          }}
        >
          {value ? formatDate(value as string) : '—'}
        </Box>
      );

    case 'text':
    default:
      return editing ? (
        <TextField
          autoFocus
          fullWidth
          size="small"
          variant="standard"
          value={(editValue as string) ?? ''}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSaveEdit}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <Box
          onClick={handleStartEdit}
          sx={{
            cursor: isDone ? 'default' : 'pointer',
            '&:hover': isDone ? {} : { textDecoration: 'underline' },
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 200,
          }}
        >
          {value != null ? String(value) : '—'}
        </Box>
      );
  }
}

// ----------------------------------------------------------------------

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

function getOptionColor(color?: string): 'default' | 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error' {
  if (!color) return 'default';
  // Map color strings to MUI color names
  const colorMap: Record<string, 'default' | 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error'> = {
    red: 'error',
    green: 'success',
    blue: 'info',
    yellow: 'warning',
    orange: 'warning',
    purple: 'secondary',
  };
  return colorMap[color.toLowerCase()] ?? 'default';
}
