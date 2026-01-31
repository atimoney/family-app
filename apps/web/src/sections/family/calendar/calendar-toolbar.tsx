import type { IconifyName } from 'src/components/iconify';
import type { CalendarView, UseCalendarReturn } from './hooks/use-calendar';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
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
            left: 0,
            width: 1,
            height: 2,
            bottom: 0,
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
        }}
      >
        {/* View options on the left */}
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

        {/* Date navigation centered */}
        <Box
          sx={{
            gap: { sm: 1 },
            display: 'flex',
            flex: '1 1 auto',
            textAlign: 'center',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconButton onClick={() => onDateNavigation?.('prev')}>
            <Iconify icon="eva:arrow-ios-back-fill" />
          </IconButton>

          <Box sx={{ typography: { xs: 'subtitle2', sm: 'h6' } }}>{title}</Box>

          <IconButton onClick={() => onDateNavigation?.('next')}>
            <Iconify icon="eva:arrow-ios-forward-fill" />
          </IconButton>
        </Box>

        {/* Today button on the right */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            size="small"
            color="error"
            variant="contained"
            onClick={() => onDateNavigation?.('today')}
          >
            Today
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
