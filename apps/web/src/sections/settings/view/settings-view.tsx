import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DashboardContent } from 'src/layouts/dashboard';

import { SettingsFamily } from '../settings-family';
import { SettingsCategories } from '../settings-categories';
import { SettingsPreferences } from '../settings-preferences';
import { SettingsIntegrations } from '../settings-integrations';

// ----------------------------------------------------------------------

export function SettingsView() {
  return (
    <DashboardContent maxWidth="lg">
      <Typography variant="h4" sx={{ mb: { xs: 3, md: 5 } }}>
        Settings
      </Typography>

      <Stack spacing={4}>
        {/* Family Management */}
        <SettingsFamily />

        {/* Event Categories */}
        <SettingsCategories />

        {/* Integrations */}
        <SettingsIntegrations />

        {/* App Preferences */}
        <SettingsPreferences />
      </Stack>
    </DashboardContent>
  );
}
