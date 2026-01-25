import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  onAdd: (name: string, quantity: string, category: string) => void;
  categories: string[];
};

export function ShoppingQuickAdd({ onAdd, categories }: Props) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [category, setCategory] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedName = name.trim();
      if (trimmedName) {
        onAdd(trimmedName, quantity.trim(), category);
        setName('');
        setQuantity('');
        setCategory('');
      }
    },
    [name, quantity, category, onAdd]
  );

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        display: 'flex',
        gap: 2,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <TextField
        size="small"
        placeholder="Item name..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        sx={{ minWidth: 200 }}
      />
      <TextField
        size="small"
        placeholder="Quantity (optional)"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        sx={{ minWidth: 140 }}
      />
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Category</InputLabel>
        <Select
          value={category}
          label="Category"
          onChange={(e) => setCategory(e.target.value)}
        >
          <MenuItem value="">
            <em>None</em>
          </MenuItem>
          {categories.map((cat) => (
            <MenuItem key={cat} value={cat}>
              {cat}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button
        type="submit"
        variant="contained"
        startIcon={<Iconify icon="mingcute:add-line" />}
        disabled={!name.trim()}
      >
        Add item
      </Button>
    </Box>
  );
}
