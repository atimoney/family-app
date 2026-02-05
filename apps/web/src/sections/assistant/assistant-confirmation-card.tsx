import type { PendingActionInfo } from 'src/features/assistant';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  pendingAction: PendingActionInfo;
  onConfirm: () => void;
  onCancel: () => void;
};

export function AssistantConfirmationCard({ pendingAction, onConfirm, onCancel }: Props) {
  const [isExpired, setIsExpired] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Calculate and update time remaining
  useEffect(() => {
    const updateTimeLeft = () => {
      const expiresAt = new Date(pendingAction.expiresAt).getTime();
      const now = Date.now();
      const diff = expiresAt - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft('Expired');
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [pendingAction.expiresAt]);

  // Render preview data
  const renderPreview = () => {
    const entries = Object.entries(pendingAction.inputPreview).slice(0, 4);
    if (entries.length === 0) return null;

    return (
      <Box sx={{ mt: 1, pl: 2 }}>
        {entries.map(([key, value]) => (
          <Typography key={key} variant="body2" sx={{ color: 'text.secondary' }}>
            <strong>{key}:</strong>{' '}
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </Typography>
        ))}
      </Box>
    );
  };

  return (
    <Card
      sx={{
        mt: 2,
        bgcolor: 'warning.lighter',
        border: (theme) => `1px solid ${theme.palette.warning.light}`,
        ...(isExpired && {
          bgcolor: 'grey.100',
          borderColor: 'grey.300',
        }),
        ...(pendingAction.isDestructive && {
          bgcolor: 'error.lighter',
          borderColor: 'error.light',
        }),
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack spacing={1.5}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Iconify
              icon={
                pendingAction.isDestructive
                  ? 'solar:danger-triangle-bold'
                  : 'solar:shield-check-bold'
              }
              width={20}
              sx={{
                color: pendingAction.isDestructive ? 'error.main' : 'warning.dark',
                ...(isExpired && { color: 'grey.500' }),
              }}
            />
            <Typography
              variant="subtitle2"
              sx={{
                color: pendingAction.isDestructive ? 'error.dark' : 'warning.dark',
                ...(isExpired && { color: 'grey.600' }),
              }}
            >
              {isExpired ? 'Action Expired' : 'Confirm Action'}
            </Typography>
          </Box>

          {/* Tool info */}
          <Box>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              <strong>Tool:</strong> {pendingAction.toolName}
            </Typography>
            {renderPreview()}
          </Box>

          {/* Timer */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Iconify icon="solar:clock-circle-bold" width={14} sx={{ color: 'text.disabled' }} />
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              {isExpired ? 'This action has expired' : `Expires in ${timeLeft}`}
            </Typography>
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1, pt: 0.5 }}>
            <Button
              size="small"
              variant="contained"
              color={pendingAction.isDestructive ? 'error' : 'primary'}
              onClick={onConfirm}
              disabled={isExpired}
              startIcon={<Iconify icon="eva:checkmark-fill" />}
            >
              Confirm
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              onClick={onCancel}
              startIcon={<Iconify icon="eva:close-fill" />}
            >
              Cancel
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
