import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import FormControl from '@mui/material/FormControl';
import CardContent from '@mui/material/CardContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useAppPreferences } from 'src/features/calendar/hooks/use-app-preferences';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'GMT / London' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
];

const WEEK_STARTS = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
  { value: 'saturday', label: 'Saturday' },
];

// ----------------------------------------------------------------------

export function SettingsPreferences() {
  const [timezone, setTimezone] = useState('America/New_York');
  const [weekStarts, setWeekStarts] = useState('sunday');

  const {
    isDashboardMode,
    dashboardDeviceName,
    setDashboardMode,
    setDashboardDeviceName,
  } = useAppPreferences();

  return (
    <Stack spacing={3}>
      {/* Dashboard Mode Card */}
      <Card>
        <CardHeader
          title={
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h6">Dashboard Mode</Typography>
              {isDashboardMode && (
                <Chip
                  label="Active"
                  color="warning"
                  size="small"
                  icon={<Iconify icon="solar:monitor-bold" width={16} />}
                />
              )}
            </Stack>
          }
          subheader="Configure this device as a shared family dashboard"
        />
        <CardContent>
          <Stack spacing={3}>
            <Alert severity="info" icon={<Iconify icon="solar:info-circle-bold" />}>
              <Typography variant="subtitle2" gutterBottom>
                When should you enable Dashboard Mode?
              </Typography>
              <Typography variant="body2">
                Enable this when the app is running on a shared device like a wall-mounted tablet,
                kitchen display, or family hub. When enabled:
              </Typography>
              <Box component="ul" sx={{ pl: 2, mt: 1, mb: 0 }}>
                <li>
                  <Typography variant="body2">
                    Calendar changes will <strong>not</strong> be automatically attributed to the
                    logged-in user
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    Changes will be marked as made from &quot;Dashboard&quot; instead
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    This ensures proper tracking when multiple family members use the same device
                  </Typography>
                </li>
              </Box>
            </Alert>

            <FormControlLabel
              control={
                <Switch
                  checked={isDashboardMode}
                  onChange={(e) => setDashboardMode(e.target.checked)}
                  color="warning"
                />
              }
              label={
                <Stack>
                  <Typography variant="body1">Enable Dashboard Mode</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Mark this device as a shared family dashboard
                  </Typography>
                </Stack>
              }
            />

            {isDashboardMode && (
              <TextField
                label="Device Name (Optional)"
                placeholder="e.g., Kitchen Display, Living Room Tablet"
                value={dashboardDeviceName || ''}
                onChange={(e) => setDashboardDeviceName(e.target.value || null)}
                helperText="Give this dashboard a name for easier identification in event history"
                fullWidth
                sx={{ maxWidth: 400 }}
              />
            )}

            {isDashboardMode && (
              <Alert severity="warning" icon={<Iconify icon="solar:danger-triangle-bold" />}>
                <Typography variant="body2">
                  <strong>Dashboard Mode is active.</strong> Changes made on this device will be
                  logged as &quot;Dashboard{dashboardDeviceName ? ` (${dashboardDeviceName})` : ''}&quot; 
                  rather than attributed to {' '}
                  the logged-in user. This is intentional for shared devices.
                </Typography>
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* General Preferences Card */}
      <Card>
        <CardHeader
          title="General Preferences"
          subheader="Customize how the app works for your family"
        />
        <CardContent>
          <Stack spacing={3} sx={{ maxWidth: 400 }}>
            <FormControl fullWidth>
              <InputLabel>Timezone</InputLabel>
              <Select
                value={timezone}
                label="Timezone"
                onChange={(e) => setTimezone(e.target.value)}
              >
                {TIMEZONES.map((tz) => (
                  <MenuItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Week starts on</InputLabel>
              <Select
                value={weekStarts}
                label="Week starts on"
                onChange={(e) => setWeekStarts(e.target.value)}
              >
                {WEEK_STARTS.map((day) => (
                  <MenuItem key={day.value} value={day.value}>
                    {day.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
