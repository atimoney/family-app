import type { QuickAction } from 'src/features/assistant';
import type { IconifyName } from 'src/components/iconify';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';

import { DEFAULT_QUICK_ACTIONS } from 'src/features/assistant';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  disabled?: boolean;
  onAction: (action: QuickAction) => void;
};

export function AssistantQuickActions({ disabled, onAction }: Props) {
  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1,
        borderTop: (theme) => `solid 1px ${theme.palette.divider}`,
        bgcolor: 'background.neutral',
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>
        Quick actions:
      </Typography>

      {DEFAULT_QUICK_ACTIONS.map((action) => (
        <Chip
          key={action.id}
          label={action.label}
          size="small"
          variant="outlined"
          disabled={disabled}
          onClick={() => onAction(action)}
          icon={action.icon ? <Iconify icon={action.icon as IconifyName} width={16} /> : undefined}
          sx={{
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
        />
      ))}
    </Box>
  );
}
