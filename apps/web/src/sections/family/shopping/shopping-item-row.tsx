import type { ShoppingItem } from '@family/shared';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import ListItem from '@mui/material/ListItem';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ListItemText from '@mui/material/ListItemText';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  item: ShoppingItem;
  onTogglePurchased: () => void;
  onDelete: () => void;
};

export function ShoppingItemRow({ item, onTogglePurchased, onDelete }: Props) {
  return (
    <ListItem
      sx={{
        py: 1,
        px: 2,
        ...(item.purchased && {
          bgcolor: 'action.selected',
        }),
      }}
      secondaryAction={
        <IconButton edge="end" onClick={onDelete} sx={{ color: 'error.main' }}>
          <Iconify icon="solar:trash-bin-trash-bold" width={20} />
        </IconButton>
      }
    >
      <Checkbox
        checked={item.purchased}
        onChange={onTogglePurchased}
        sx={{ mr: 1 }}
      />
      <ListItemText
        primary={
          <Typography
            variant="subtitle2"
            sx={{
              ...(item.purchased && {
                textDecoration: 'line-through',
                color: 'text.disabled',
              }),
            }}
          >
            {item.name}
          </Typography>
        }
        secondary={
          item.quantity && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                ...(item.purchased && { color: 'text.disabled' }),
              }}
            >
              {item.quantity}
            </Typography>
          )
        }
      />
    </ListItem>
  );
}
