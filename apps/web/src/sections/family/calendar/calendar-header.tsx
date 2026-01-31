import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type CalendarHeaderProps = {
  syncing: boolean;
  mutating: boolean;
  isDashboardMode: boolean;
  dashboardDeviceName?: string;
  onSync: () => void;
  onAddEvent: () => void;
};

export function CalendarHeader({
  syncing,
  mutating,
  isDashboardMode,
  dashboardDeviceName,
  onSync,
  onAddEvent,
}: CalendarHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: { xs: 3, md: 5 },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Typography variant="h4">Calendar</Typography>
        {isDashboardMode && (
          <Tooltip
            title={`Dashboard Mode: Changes won't be attributed to you${dashboardDeviceName ? ` (${dashboardDeviceName})` : ''}`}
          >
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1,
                py: 0.25,
                borderRadius: 1,
                bgcolor: 'warning.lighter',
                color: 'warning.darker',
                fontSize: '0.75rem',
                fontWeight: 500,
              }}
            >
              <Iconify icon="solar:monitor-bold" width={14} />
              Dashboard
            </Box>
          </Tooltip>
        )}
      </Stack>
      <Stack direction="row" spacing={1}>
        <Tooltip title={syncing ? 'Syncing...' : 'Sync with Google Calendar'}>
          <span>
            <IconButton onClick={onSync} disabled={syncing || mutating} color={syncing ? 'primary' : 'default'}>
              {syncing ? <CircularProgress size={20} /> : <Iconify icon="solar:restart-bold" />}
            </IconButton>
          </span>
        </Tooltip>
        <Button
          variant="contained"
          startIcon={<Iconify icon="mingcute:add-line" />}
          onClick={onAddEvent}
          disabled={mutating}
        >
          Add event
        </Button>
      </Stack>
    </Box>
  );
}
