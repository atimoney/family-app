import type { FieldDefinition } from '@family/shared';

import { useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ListItemButton from '@mui/material/ListItemButton';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// Built-in columns (always available, title always included)
const BUILT_IN_COLUMNS = [
  { key: 'title', label: 'Title', required: true },
  { key: 'status', label: 'Status', required: false },
];

type ColumnChooserDialogProps = {
  open: boolean;
  fields: FieldDefinition[];
  visibleColumns: string[];
  onClose: () => void;
  onSave: (columns: string[]) => Promise<void>;
};

export function ColumnChooserDialog({
  open,
  fields,
  visibleColumns,
  onClose,
  onSave,
}: ColumnChooserDialogProps) {
  const [selected, setSelected] = useState<string[]>(() => [...visibleColumns]);
  const [saving, setSaving] = useState(false);

  // Build all available columns
  const allColumns = useMemo(
    () => [
      ...BUILT_IN_COLUMNS,
      ...fields.map((f) => ({ key: f.key, label: f.label, required: false })),
    ],
    [fields]
  );

  // Toggle column selection
  const handleToggle = useCallback((key: string) => {
    setSelected((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  }, []);

  // Move column up/down
  const handleMove = useCallback((key: string, direction: 'up' | 'down') => {
    setSelected((prev) => {
      const index = prev.indexOf(key);
      if (index === -1) return prev;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;

      const newSelected = [...prev];
      [newSelected[index], newSelected[newIndex]] = [newSelected[newIndex], newSelected[index]];
      return newSelected;
    });
  }, []);

  // Save changes
  const handleSave = useCallback(async () => {
    // Ensure title is always included
    const finalColumns = selected.includes('title') ? selected : ['title', ...selected];
    setSaving(true);
    try {
      await onSave(finalColumns);
    } finally {
      setSaving(false);
    }
  }, [selected, onSave]);

  // Reset to initial
  const handleReset = useCallback(() => {
    setSelected([...visibleColumns]);
  }, [visibleColumns]);

  // Show all columns
  const handleShowAll = useCallback(() => {
    setSelected(allColumns.map((c) => c.key));
  }, [allColumns]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Choose Columns</Typography>
          <Box>
            <Button size="small" onClick={handleShowAll}>
              Show All
            </Button>
            <Button size="small" onClick={handleReset}>
              Reset
            </Button>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <List dense disablePadding>
          {/* Selected columns first (in order) */}
          {selected.map((key, index) => {
            const col = allColumns.find((c) => c.key === key);
            if (!col) return null;

            return (
              <ListItem
                key={col.key}
                disablePadding
                secondaryAction={
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton
                      edge="end"
                      size="small"
                      disabled={index === 0}
                      onClick={() => handleMove(col.key, 'up')}
                    >
                      <Iconify icon={'solar:alt-arrow-up-bold' as any} width={16} />
                    </IconButton>
                    <IconButton
                      edge="end"
                      size="small"
                      disabled={index === selected.length - 1}
                      onClick={() => handleMove(col.key, 'down')}
                    >
                      <Iconify icon={'solar:alt-arrow-down-bold' as any} width={16} />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemButton onClick={() => !col.required && handleToggle(col.key)}>
                  <Checkbox
                    edge="start"
                    checked
                    disabled={col.required}
                    tabIndex={-1}
                    disableRipple
                  />
                  <ListItemText
                    primary={col.label}
                    secondary={col.required ? 'Required' : undefined}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}

          {/* Unselected columns */}
          {allColumns
            .filter((col) => !selected.includes(col.key))
            .map((col) => (
              <ListItem key={col.key} disablePadding>
                <ListItemButton onClick={() => handleToggle(col.key)}>
                  <Checkbox
                    edge="start"
                    checked={false}
                    tabIndex={-1}
                    disableRipple
                  />
                  <ListItemText
                    primary={col.label}
                    sx={{ color: 'text.secondary' }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
        </List>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || selected.length === 0}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
