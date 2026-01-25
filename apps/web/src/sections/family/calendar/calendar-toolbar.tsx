import type { IconifyName } from 'src/components/iconify';
import type { CalendarView, UseCalendarReturn } from './hooks/use-calendar';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import LinearProgress from '@mui/material/LinearProgress';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type ViewOption = {
  label: string;
  value: CalendarView;
  icon: IconifyName;
};

type CalendarToolbarProps = Partial<UseCalendarReturn> & {
  loading?: boolean;
  viewOptions: ViewOption[];
};

export function CalendarToolbar({
  view,
  title,
  loading,
  viewOptions,
  onChangeView,
  onDateNavigation,
}: CalendarToolbarProps) {
  return (
    <Box sx={{ position: 'relative' }}>
      {loading && (
        <LinearProgress
          color="inherit"
          sx={{
            top: 0,
            left: 0,
            width: 1,
            height: 2,
            borderRadius: 0,
            position: 'absolute',
          }}
        />
      )}

      <Box
        sx={{
          p: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={() => onDateNavigation?.('prev')}>
            <Iconify icon="eva:arrow-ios-back-fill" />
          </IconButton>

          <Typography variant="h6" sx={{ mx: 1, minWidth: 180, textAlign: 'center' }}>
            {title}
          </Typography>

          <IconButton onClick={() => onDateNavigation?.('next')}>
            <Iconify icon="eva:arrow-ios-forward-fill" />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            size="small"
            color="inherit"
            variant="outlined"
            onClick={() => onDateNavigation?.('today')}
          >
            Today
          </Button>

          <ToggleButtonGroup
            exclusive
            size="small"
            aria-label="calendar view"
            value={view}
            onChange={(_, newView: CalendarView | null) => {
              if (newView !== null) {
                onChangeView?.(newView);
              }
            }}
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          >
            {viewOptions.map((option) => (
              <Tooltip key={option.value} title={option.label}>
                <ToggleButton value={option.value} aria-label={`${option.label} view`}>
                  <Iconify icon={option.icon} />
                </ToggleButton>
              </Tooltip>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>
    </Box>
  );
}
