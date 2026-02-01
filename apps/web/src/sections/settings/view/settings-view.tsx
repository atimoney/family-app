import { useRef } from 'react';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useFamily } from 'src/features/family';
import { DashboardContent } from 'src/layouts/dashboard';

import { SettingsFamily } from '../settings-family';
import { SettingsCategories } from '../settings-categories';
import { SettingsPreferences } from '../settings-preferences';
import { SettingsIntegrations, type SettingsIntegrationsRef } from '../settings-integrations';

// ----------------------------------------------------------------------

export function SettingsView() {
  const { family, refresh: refreshFamily } = useFamily();
  const integrationsRef = useRef<SettingsIntegrationsRef>(null);

  const handleSharedCalendarChange = async () => {
    await refreshFamily();
    // Also refresh the integrations calendar list to update checkbox states
    integrationsRef.current?.refreshCalendars();
  };

  return (
    <DashboardContent maxWidth="lg">
      <Typography variant="h4" sx={{ mb: { xs: 3, md: 5 } }}>
        Settings
      </Typography>

      <Stack spacing={4}>
        {/* Family Management */}
        <SettingsFamily onSharedCalendarChange={handleSharedCalendarChange} />

        {/* Event Categories */}
        <SettingsCategories />

        {/* Integrations */}
        <SettingsIntegrations ref={integrationsRef} familySharedCalendarId={family?.sharedCalendarId ?? null} />

        {/* App Preferences */}
        <SettingsPreferences />
      </Stack>
    </DashboardContent>
  );
}
