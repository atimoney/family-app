import type { ListTemplateKey } from '@family/shared';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const TEMPLATE_OPTIONS: { value: ListTemplateKey; label: string; icon: string }[] = [
  { value: 'shopping', label: 'Shopping List', icon: 'solar:cart-large-2-bold-duotone' },
  { value: 'meal_plan', label: 'Meal Plan', icon: 'solar:chef-hat-bold-duotone' },
  { value: 'custom', label: 'Custom List', icon: 'solar:checklist-bold-duotone' },
];

// ----------------------------------------------------------------------

type CreateListDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, templateKey: ListTemplateKey) => Promise<void>;
  loading?: boolean;
};

export function CreateListDialog({ open, onClose, onSubmit, loading }: CreateListDialogProps) {
  const [name, setName] = useState('');
  const [templateKey, setTemplateKey] = useState<ListTemplateKey>('custom');

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await onSubmit(name.trim(), templateKey);
    setName('');
    setTemplateKey('custom');
  };

  const handleClose = () => {
    setName('');
    setTemplateKey('custom');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Create New List</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <TextField
          autoFocus
          fullWidth
          label="List Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mb: 2.5 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) {
              handleSubmit();
            }
          }}
        />
        <FormControl fullWidth>
          <InputLabel>Template</InputLabel>
          <Select
            value={templateKey}
            label="Template"
            onChange={(e) => setTemplateKey(e.target.value as ListTemplateKey)}
            renderValue={(value) => {
              const opt = TEMPLATE_OPTIONS.find((o) => o.value === value);
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Iconify icon={opt?.icon as any} width={20} />
                  {opt?.label}
                </Box>
              );
            }}
          >
            {TEMPLATE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Iconify icon={opt.icon as any} width={20} />
                  {opt.label}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!name.trim() || loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
