import type { TaskRecurrenceRule, TaskRecurrenceFrequency } from '@family/shared';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Popover from '@mui/material/Popover';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const FREQUENCY_OPTIONS: { value: TaskRecurrenceFrequency; label: string }[] = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
];

const WEEKDAY_OPTIONS: { value: 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'; label: string }[] = [
  { value: 'MO', label: 'Mon' },
  { value: 'TU', label: 'Tue' },
  { value: 'WE', label: 'Wed' },
  { value: 'TH', label: 'Thu' },
  { value: 'FR', label: 'Fri' },
  { value: 'SA', label: 'Sat' },
  { value: 'SU', label: 'Sun' },
];

type Props = {
  value: TaskRecurrenceRule | null | undefined;
  onChange: (rule: TaskRecurrenceRule | null) => void;
  disabled?: boolean;
};

export function TaskRecurrencePicker({ value, onChange, disabled = false }: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [enabled, setEnabled] = useState(!!value);
  const [frequency, setFrequency] = useState<TaskRecurrenceFrequency>(value?.frequency ?? 'WEEKLY');
  const [interval, setInterval] = useState(value?.interval ?? 1);
  const [byDay, setByDay] = useState<string[]>(value?.byDay ?? []);
  const [endType, setEndType] = useState<'never' | 'count' | 'until'>(
    value?.count ? 'count' : value?.until ? 'until' : 'never'
  );
  const [count, setCount] = useState(value?.count ?? 10);

  // Sync state when value changes externally
  useEffect(() => {
    setEnabled(!!value);
    if (value) {
      setFrequency(value.frequency);
      setInterval(value.interval ?? 1);
      setByDay(value.byDay ?? []);
      setEndType(value.count ? 'count' : value.until ? 'until' : 'never');
      setCount(value.count ?? 10);
    }
  }, [value]);

  const handleOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleToggleEnabled = useCallback(
    (newEnabled: boolean) => {
      setEnabled(newEnabled);
      if (!newEnabled) {
        onChange(null);
      }
    },
    [onChange]
  );

  const handleApply = useCallback(() => {
    if (!enabled) {
      onChange(null);
    } else {
      const rule: TaskRecurrenceRule = {
        frequency,
        interval: interval > 1 ? interval : undefined,
        ...(frequency === 'WEEKLY' && byDay.length > 0 && { byDay: byDay as TaskRecurrenceRule['byDay'] }),
        ...(endType === 'count' && { count }),
      };
      onChange(rule);
    }
    handleClose();
  }, [enabled, frequency, interval, byDay, endType, count, onChange, handleClose]);

  const handleByDayChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newDays: string[]) => {
      setByDay(newDays);
    },
    []
  );

  // Format recurrence for display
  const formatRecurrence = (rule: TaskRecurrenceRule | null | undefined): string => {
    if (!rule) return 'Does not repeat';

    const freq = FREQUENCY_OPTIONS.find((f) => f.value === rule.frequency);
    let text = '';

    if (rule.interval && rule.interval > 1) {
      text = `Every ${rule.interval} ${freq?.label.toLowerCase().replace(/ly$/, 's')}`;
    } else {
      text = freq?.label || 'Repeats';
    }

    if (rule.frequency === 'WEEKLY' && rule.byDay && rule.byDay.length > 0) {
      const dayNames = rule.byDay.map((d) => WEEKDAY_OPTIONS.find((w) => w.value === d)?.label || d);
      text += ` on ${dayNames.join(', ')}`;
    }

    if (rule.count) {
      text += `, ${rule.count} times`;
    }

    return text;
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <Button
        variant="outlined"
        color={value ? 'primary' : 'inherit'}
        onClick={handleOpen}
        disabled={disabled}
        startIcon={<Iconify icon="solar:restart-bold" />}
        sx={{
          justifyContent: 'flex-start',
          textAlign: 'left',
          fontWeight: 'normal',
        }}
      >
        {formatRecurrence(value)}
      </Button>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: { width: 320, p: 2 },
          },
        }}
      >
        <Stack spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={enabled}
                onChange={(e) => handleToggleEnabled(e.target.checked)}
              />
            }
            label="Repeat this task"
          />

          {enabled && (
            <>
              {/* Frequency */}
              <TextField
                select
                fullWidth
                size="small"
                label="Frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as TaskRecurrenceFrequency)}
              >
                {FREQUENCY_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>

              {/* Interval */}
              <TextField
                fullWidth
                size="small"
                type="number"
                label={`Every how many ${frequency.toLowerCase().replace(/ly$/, 's')}`}
                value={interval}
                onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
                inputProps={{ min: 1, max: 99 }}
              />

              {/* Weekly day selection */}
              {frequency === 'WEEKLY' && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    On days
                  </Typography>
                  <ToggleButtonGroup
                    value={byDay}
                    onChange={handleByDayChange}
                    size="small"
                    sx={{ flexWrap: 'wrap', gap: 0.5 }}
                  >
                    {WEEKDAY_OPTIONS.map((day) => (
                      <ToggleButton
                        key={day.value}
                        value={day.value}
                        sx={{ px: 1, py: 0.5, minWidth: 40 }}
                      >
                        {day.label}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>
              )}

              {/* End condition */}
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Ends
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    label="Never"
                    variant={endType === 'never' ? 'filled' : 'outlined'}
                    color={endType === 'never' ? 'primary' : 'default'}
                    onClick={() => setEndType('never')}
                    size="small"
                  />
                  <Chip
                    label="After"
                    variant={endType === 'count' ? 'filled' : 'outlined'}
                    color={endType === 'count' ? 'primary' : 'default'}
                    onClick={() => setEndType('count')}
                    size="small"
                  />
                </Stack>

                {endType === 'count' && (
                  <TextField
                    size="small"
                    type="number"
                    value={count}
                    onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    inputProps={{ min: 1, max: 365 }}
                    sx={{ mt: 1, width: 100 }}
                    InputProps={{
                      endAdornment: <Typography variant="caption">times</Typography>,
                    }}
                  />
                )}
              </Box>
            </>
          )}

          {/* Actions */}
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" onClick={handleClose}>
              Cancel
            </Button>
            <Button size="small" variant="contained" onClick={handleApply}>
              Apply
            </Button>
          </Stack>
        </Stack>
      </Popover>
    </>
  );
}
