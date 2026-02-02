import type { ListDTO } from '@family/shared';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

import { listApi } from 'src/features/lists/api';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

interface GenerateShoppingDialogProps {
  open: boolean;
  onClose: () => void;
  mealPlanList: ListDTO;
  weekStart: string; // YYYY-MM-DD format
  onSuccess?: (itemsCreated: number) => void;
}

export function GenerateShoppingDialog({
  open,
  onClose,
  mealPlanList,
  weekStart,
  onSuccess,
}: GenerateShoppingDialogProps) {
  const [shoppingLists, setShoppingLists] = useState<ListDTO[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ itemsCreated: number } | null>(null);

  // Load shopping lists when dialog opens
  useEffect(() => {
    if (open) {
      setLoadingLists(true);
      setError(null);
      setSuccess(null);
      listApi
        .getLists({ templateKey: 'shopping' })
        .then((lists) => {
          setShoppingLists(lists);
          // Auto-select the first shopping list
          if (lists.length > 0 && !selectedListId) {
            setSelectedListId(lists[0].id);
          }
        })
        .catch((err) => {
          setError('Failed to load shopping lists');
          console.error(err);
        })
        .finally(() => {
          setLoadingLists(false);
        });
    }
  }, [open, selectedListId]);

  const handleGenerate = async () => {
    if (!selectedListId) {
      setError('Please select a shopping list');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await listApi.generateShopping(mealPlanList.id, {
        weekStart,
        targetListId: selectedListId,
      });
      setSuccess({ itemsCreated: result.itemsCreated });
      onSuccess?.(result.itemsCreated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate shopping list');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError(null);
      setSuccess(null);
      onClose();
    }
  };

  // Format week range for display
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  const weekRangeText = `${formatDate(weekStart)} – ${formatDate(weekEnd)}`;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Iconify icon="solar:cart-plus-bold" width={24} />
        Add to Shopping List
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Add meals from <strong>{mealPlanList.name}</strong> for the week of{' '}
            <strong>{weekRangeText}</strong> to your shopping list.
          </Typography>

          {loadingLists ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : shoppingLists.length === 0 ? (
            <Alert severity="warning">
              No shopping lists found. Please create a shopping list first.
            </Alert>
          ) : (
            <FormControl fullWidth>
              <InputLabel id="shopping-list-select-label">Shopping List</InputLabel>
              <Select
                labelId="shopping-list-select-label"
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                label="Shopping List"
                disabled={loading}
              >
                {shoppingLists.map((list) => (
                  <MenuItem key={list.id} value={list.id}>
                    {list.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Added {success.itemsCreated} item{success.itemsCreated !== 1 ? 's' : ''} to shopping
              list!
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {success ? 'Close' : 'Cancel'}
        </Button>
        {!success && (
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={loading || !selectedListId || shoppingLists.length === 0}
            startIcon={loading ? <CircularProgress size={16} /> : <Iconify icon="solar:cart-plus-bold" />}
          >
            {loading ? 'Adding...' : 'Add to Shopping List'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
