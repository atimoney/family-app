import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  onAdd: (title: string) => void;
};

export function TaskQuickAdd({ onAdd }: Props) {
  const [title, setTitle] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = title.trim();
      if (trimmed) {
        onAdd(trimmed);
        setTitle('');
      }
    },
    [title, onAdd]
  );

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        display: 'flex',
        gap: 2,
        alignItems: 'center',
      }}
    >
      <TextField
        fullWidth
        size="small"
        placeholder="Add a new task..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        sx={{ maxWidth: 400 }}
      />
      <Button
        type="submit"
        variant="contained"
        startIcon={<Iconify icon="mingcute:add-line" />}
        disabled={!title.trim()}
      >
        Add task
      </Button>
    </Box>
  );
}
