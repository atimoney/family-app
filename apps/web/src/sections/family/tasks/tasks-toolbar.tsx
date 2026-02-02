import type { IconifyName } from 'src/components/iconify';
import type { TaskView } from './hooks/use-tasks-preferences';

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

export type TaskViewOption = {
  label: string;
  value: TaskView;
  icon: IconifyName;
};

export const TASK_VIEW_OPTIONS: TaskViewOption[] = [
  { value: 'agenda', label: 'List', icon: 'solar:list-bold' },
  { value: 'dayGridMonth', label: 'Month', icon: 'mingcute:calendar-month-line' },
  { value: 'timeGridWeek', label: 'Week', icon: 'mingcute:calendar-week-line' },
  { value: 'timeGridDay', label: 'Day', icon: 'mingcute:calendar-day-line' },
  { value: 'resourceTimeGridDay', label: 'Team', icon: 'solar:users-group-rounded-bold' },
  { value: 'kanban', label: 'Board', icon: 'ic:round-view-module' },
];

type TasksToolbarProps = {
  view: TaskView;
  title?: string;
  loading?: boolean;
  viewOptions?: TaskViewOption[];
  canReset?: boolean;
  onChangeView?: (view: TaskView) => void;
  onOpenFilters?: () => void;
  onOpenForm?: () => void;
  onOpenTemplates?: () => void;
  // For calendar-style views with date navigation
  onDateNavigation?: (action: 'today' | 'prev' | 'next') => void;
  showDateNav?: boolean;
};

export function TasksToolbar({
  view,
  title,
  loading,
  viewOptions = TASK_VIEW_OPTIONS,
  canReset,
  onChangeView,
  onOpenFilters,
  onOpenForm,
  onOpenTemplates,
  onDateNavigation,
  showDateNav = false,
}: TasksToolbarProps) {
  const mobileActions = usePopover();

  const selectedView = viewOptions.find((option) => option.value === view) ?? viewOptions[0];

  // Only show date navigation for calendar-style views
  const showDateNavigation = showDateNav && ['dayGridMonth', 'timeGridWeek', 'timeGridDay', 'resourceTimeGridDay'].includes(view);

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
          gap: 1,
        }}
      >
        {/* Desktop view options */}
        <ToggleButtonGroup
          exclusive
          size="small"
          aria-label="task view"
          value={view}
          onChange={(_, newView: TaskView | null) => {
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

        {/* Date navigation (only for calendar views) */}
        {showDateNavigation && (
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

            <Box sx={{ typography: { xs: 'subtitle2', sm: 'h6' }, minWidth: 120 }}>{title}</Box>

            <IconButton onClick={() => onDateNavigation?.('next')}>
              <Iconify icon="eva:arrow-ios-forward-fill" />
            </IconButton>
          </Box>
        )}

        {/* Spacer when no date nav */}
        {!showDateNavigation && <Box sx={{ flex: '1 1 auto' }} />}

        {/* Actions on the right */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {showDateNavigation && (
            <Button
              size="small"
              color="error"
              variant="contained"
              onClick={() => onDateNavigation?.('today')}
            >
              Today
            </Button>
          )}

          {onOpenFilters && (
            <IconButton onClick={onOpenFilters}>
              <Badge color="error" variant="dot" invisible={!canReset}>
                <Iconify icon="ic:round-filter-list" />
              </Badge>
            </IconButton>
          )}

          {onOpenTemplates && (
            <Tooltip title="Create from template">
              <IconButton onClick={onOpenTemplates}>
                <Iconify icon="solar:bill-list-bold" />
              </IconButton>
            </Tooltip>
          )}

          {onOpenForm && (
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={onOpenForm}
            >
              New task
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}
