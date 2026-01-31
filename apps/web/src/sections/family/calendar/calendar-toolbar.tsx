import type { IconifyName } from 'src/components/iconify';
import type { CalendarView, UseCalendarReturn } from './hooks/use-calendar';

import { usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import LinearProgress from '@mui/material/LinearProgress';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

// ----------------------------------------------------------------------

type ViewOption = {
  label: string;
  value: CalendarView;
  icon: IconifyName;
};

type CalendarToolbarProps = Partial<UseCalendarReturn> & {
  loading?: boolean;
  viewOptions: ViewOption[];
  canReset?: boolean;
  onOpenFilters?: () => void;
};

export function CalendarToolbar({
  view,
  title,
  loading,
  viewOptions,
  canReset,
  onChangeView,
  onOpenFilters,
  onDateNavigation,
}: CalendarToolbarProps) {
  const mobileActions = usePopover();

  const selectedView = viewOptions.find((option) => option.value === view) ?? viewOptions[0];

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
        {/* Desktop view options */}
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

        {/* Mobile view dropdown */}
        <Button
          size="small"
          color="inherit"
          onClick={mobileActions.onOpen}
          sx={{ minWidth: 'auto', display: { sm: 'none' } }}
        >
          <Iconify icon={selectedView.icon} sx={{ mr: 0.5 }} />
          <Iconify icon="eva:arrow-ios-downward-fill" width={18} />
        </Button>

        <CustomPopover
          open={mobileActions.open}
          anchorEl={mobileActions.anchorEl}
          onClose={mobileActions.onClose}
          slotProps={{ arrow: { placement: 'top-left' } }}
        >
          <MenuList>
            {viewOptions.map((option) => (
              <MenuItem
                key={option.value}
                selected={option.value === view}
                onClick={() => {
                  mobileActions.onClose();
                  onChangeView?.(option.value);
                }}
              >
                <Iconify icon={option.icon} />
                {option.label}
              </MenuItem>
            ))}
          </MenuList>
        </CustomPopover>

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

          {onOpenFilters && (
            <IconButton onClick={onOpenFilters}>
              <Badge color="error" variant="dot" invisible={!canReset}>
                <Iconify icon="ic:round-filter-list" />
              </Badge>
            </IconButton>
          )}
        </Box>
      </Box>
    </Box>
  );
}
