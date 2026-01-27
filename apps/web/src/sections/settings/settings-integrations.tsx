import type { IconifyProps } from 'src/components/iconify';

import { useEffect, useState } from 'react';
import { varAlpha } from 'minimal-shared/utils';
import { useSearchParams as useRouterSearchParams } from 'react-router';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Skeleton from '@mui/material/Skeleton';
import Checkbox from '@mui/material/Checkbox';
import Collapse from '@mui/material/Collapse';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useRouter } from 'src/routes/hooks';

import { useGoogleIntegration, useCalendarSelection } from 'src/features/integrations';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Integration = {
  id: string;
  name: string;
  description: string;
  icon: IconifyProps['icon'];
  enabled: boolean;
  status: 'coming-soon' | 'available' | 'connected';
};

const INTEGRATIONS: Integration[] = [
  {
    id: 'home-assistant',
    name: 'Home Assistant',
    description: 'Connect to your Home Assistant instance for smart home automations and device control.',
    icon: 'solar:home-angle-bold-duotone',
    enabled: false,
    status: 'coming-soon',
  },
  {
    id: 'tailscale',
    name: 'Tailscale Gateway',
    description: 'Secure remote access to your family hub through Tailscale VPN mesh network.',
    icon: 'solar:shield-keyhole-bold-duotone',
    enabled: false,
    status: 'coming-soon',
  },
  {
    id: 'local-ai',
    name: 'Local AI Agents',
    description: 'Run AI assistants locally for meal planning, scheduling suggestions, and more.',
    icon: 'solar:atom-bold-duotone',
    enabled: false,
    status: 'coming-soon',
  },
];

// ----------------------------------------------------------------------

export function SettingsIntegrations() {
  const router = useRouter();
  const [searchParams] = useRouterSearchParams();
  const { status: googleStatus, loading: googleLoading, syncing: googleSyncing, connect: connectGoogle, refresh, sync: syncGoogle } = useGoogleIntegration();
  const {
    calendars,
    loading: calendarsLoading,
    toggleCalendar,
    saveSelection,
    hasChanges,
    refresh: refreshCalendars,
  } = useCalendarSelection();
  const [showCalendars, setShowCalendars] = useState(false);
  const [saving, setSaving] = useState(false);

  // Refresh status when redirected back from Google OAuth
  useEffect(() => {
    if (searchParams.get('google') === 'connected') {
      // Remove the query param by replacing URL
      router.replace('/settings');
      // Refresh status
      refresh();
      refreshCalendars();
    }
  }, [searchParams, router, refresh, refreshCalendars]);

  const handleSaveSelection = async () => {
    try {
      setSaving(true);
      await saveSelection();
      console.log('Calendar selection saved');
    } catch {
      console.error('Failed to save calendar selection');
    } finally {
      setSaving(false);
    }
  };

  const renderGoogleCalendarIntegration = () => (
    <Box
      sx={[
        (theme) => ({
          p: 2,
          borderRadius: 1.5,
          border: `1px solid ${varAlpha(theme.vars.palette.grey['500Channel'], 0.16)}`,
          bgcolor: varAlpha(theme.vars.palette.grey['500Channel'], 0.04),
        }),
      ]}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box
            sx={{
              p: 1,
              borderRadius: 1,
              bgcolor: 'background.paper',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Iconify icon="solar:calendar-date-bold" width={28} />
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="subtitle1">Google Calendar</Typography>
              {googleLoading ? (
                <Skeleton width={80} height={24} />
              ) : (
                <Label
                  variant="soft"
                  color={googleStatus?.connected ? 'success' : 'info'}
                >
                  {googleStatus?.connected ? 'Connected' : 'Available'}
                </Label>
              )}
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {googleStatus?.connected && googleStatus.email
                ? `Connected as ${googleStatus.email}`
                : 'Sync your Google Calendar events to view and manage them in one place.'}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          {googleStatus?.connected && (
            <>
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                onClick={async () => {
                  const result = await syncGoogle(true);
                  if (result) {
                    console.log(`Synced ${result.synced} events (${result.created} created, ${result.updated} updated, ${result.deleted} deleted)`);
                  }
                }}
                disabled={googleSyncing}
                startIcon={googleSyncing ? <CircularProgress size={16} /> : <Iconify icon="solar:restart-bold" />}
              >
                {googleSyncing ? 'Syncing...' : 'Force Refresh'}
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                onClick={() => {
                  setShowCalendars(!showCalendars);
                  if (!showCalendars) refreshCalendars();
                }}
                startIcon={<Iconify icon={showCalendars ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'} />}
              >
                Calendars
              </Button>
            </>
          )}
          {googleLoading ? (
            <Skeleton width={100} height={36} />
          ) : googleStatus?.connected ? (
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              onClick={connectGoogle}
            >
              Reconnect
            </Button>
          ) : (
            <Button
              variant="contained"
              size="small"
              onClick={connectGoogle}
              startIcon={<Iconify icon="eva:link-2-fill" />}
            >
              Connect
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Calendar Selection */}
      <Collapse in={showCalendars && googleStatus?.connected}>
        <Box sx={{ mt: 2, pt: 2, borderTop: (theme) => `1px dashed ${varAlpha(theme.vars.palette.grey['500Channel'], 0.2)}` }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Select calendars to display</Typography>
            {hasChanges && (
              <Button
                size="small"
                variant="contained"
                onClick={handleSaveSelection}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={16} /> : <Iconify icon="eva:checkmark-fill" />}
              >
                Save
              </Button>
            )}
          </Stack>
          {calendarsLoading ? (
            <Stack spacing={1}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} height={32} />
              ))}
            </Stack>
          ) : calendars.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No calendars found
            </Typography>
          ) : (
            <Stack spacing={0.5}>
              {calendars.map((calendar) => (
                <FormControlLabel
                  key={calendar.id}
                  control={
                    <Checkbox
                      checked={Boolean(calendar.isSelected)}
                      onChange={() => toggleCalendar(calendar.id)}
                      size="small"
                      sx={{
                        color: calendar.backgroundColor,
                        '&.Mui-checked': {
                          color: calendar.backgroundColor,
                        },
                      }}
                    />
                  }
                  label={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: calendar.backgroundColor,
                        }}
                      />
                      <Typography variant="body2">{calendar.summary}</Typography>
                      {calendar.primary && (
                        <Label variant="soft" color="primary" sx={{ ml: 1 }}>
                          Primary
                        </Label>
                      )}
                    </Stack>
                  }
                  sx={{ ml: 0 }}
                />
              ))}
            </Stack>
          )}
        </Box>
      </Collapse>
    </Box>
  );

  return (
    <Card>
      <CardHeader
        title="Integrations"
        subheader="Connect external services and automations"
      />
      <CardContent>
        <Stack spacing={3}>
          {/* Google Calendar - Active Integration */}
          {renderGoogleCalendarIntegration()}

          {/* Other Integrations */}
          {INTEGRATIONS.map((integration) => (
            <Box
              key={integration.id}
              sx={[
                (theme) => ({
                  p: 2,
                  borderRadius: 1.5,
                  border: `1px solid ${varAlpha(theme.vars.palette.grey['500Channel'], 0.16)}`,
                  bgcolor: varAlpha(theme.vars.palette.grey['500Channel'], 0.04),
                }),
              ]}
            >
              <Stack
                direction="row"
                alignItems="flex-start"
                justifyContent="space-between"
              >
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      bgcolor: 'background.paper',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Iconify icon={integration.icon} width={28} />
                  </Box>
                  <Box sx={{ flexGrow: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="subtitle1">{integration.name}</Typography>
                      <Label
                        variant="soft"
                        color={
                          (integration.status === 'connected' && 'success') ||
                          (integration.status === 'available' && 'info') ||
                          'default'
                        }
                      >
                        {integration.status === 'coming-soon' ? 'Coming Soon' : integration.status}
                      </Label>
                    </Stack>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                      {integration.description}
                    </Typography>
                  </Box>
                </Stack>
                <Switch
                  disabled={integration.status === 'coming-soon'}
                  checked={integration.enabled}
                />
              </Stack>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
