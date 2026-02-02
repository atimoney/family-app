import type { ListItemDTO } from '@family/shared';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type WeekCellProps = {
  date: Date;
  slot: string;
  items: ListItemDTO[];
  isToday: boolean;
  onCellClick: () => void;
  onItemClick: (item: ListItemDTO) => void;
  onToggleStatus: (item: ListItemDTO) => void;
};

export function WeekCell({
  date,
  slot,
  items,
  isToday,
  onCellClick,
  onItemClick,
  onToggleStatus,
}: WeekCellProps) {
  return (
    <Box
      sx={{
        minHeight: 80,
        borderRadius: 1,
        border: '1px solid',
        borderColor: isToday ? 'primary.light' : 'divider',
        bgcolor: isToday ? 'primary.lighter' : 'background.paper',
        p: 0.5,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'all 0.15s',
        '&:hover': {
          borderColor: 'primary.main',
          '& .add-button': {
            opacity: 1,
          },
        },
      }}
    >
      {/* Items */}
      <Stack spacing={0.5} sx={{ flex: 1 }}>
        {items.map((item) => (
          <MealItem
            key={item.id}
            item={item}
            onItemClick={() => onItemClick(item)}
            onToggleStatus={() => onToggleStatus(item)}
          />
        ))}
      </Stack>

      {/* Add button (shown on hover when empty or always visible) */}
      <ButtonBase
        className="add-button"
        onClick={onCellClick}
        sx={{
          position: 'absolute',
          bottom: 4,
          right: 4,
          width: 24,
          height: 24,
          borderRadius: '50%',
          bgcolor: 'background.neutral',
          opacity: items.length === 0 ? 0.6 : 0,
          transition: 'opacity 0.15s',
          '&:hover': {
            bgcolor: 'primary.lighter',
          },
        }}
      >
        <Iconify icon={'solar:add-circle-bold' as any} width={16} sx={{ color: 'text.secondary' }} />
      </ButtonBase>
    </Box>
  );
}

// ----------------------------------------------------------------------

type MealItemProps = {
  item: ListItemDTO;
  onItemClick: () => void;
  onToggleStatus: () => void;
};

function MealItem({ item, onItemClick, onToggleStatus }: MealItemProps) {
  const isDone = item.status === 'done';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0.5,
        p: 0.5,
        borderRadius: 0.5,
        bgcolor: isDone ? 'action.disabledBackground' : 'action.hover',
        '&:hover': {
          bgcolor: isDone ? 'action.disabledBackground' : 'action.selected',
        },
      }}
    >
      <Checkbox
        checked={isDone}
        onChange={(e) => {
          e.stopPropagation();
          onToggleStatus();
        }}
        size="small"
        sx={{ p: 0, mt: 0.25 }}
      />
      <ButtonBase
        onClick={onItemClick}
        sx={{
          flex: 1,
          textAlign: 'left',
          justifyContent: 'flex-start',
          minWidth: 0,
        }}
      >
        <Typography
          variant="caption"
          noWrap
          sx={{
            textDecoration: isDone ? 'line-through' : 'none',
            color: isDone ? 'text.disabled' : 'text.primary',
            lineHeight: 1.3,
          }}
        >
          {item.title}
        </Typography>
      </ButtonBase>
    </Box>
  );
}
