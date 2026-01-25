import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DashboardContent } from 'src/layouts/dashboard';

import { SettingsPreferences } from '../settings-preferences';
import { SettingsIntegrations } from '../settings-integrations';
import { SettingsFamilyMembers } from '../settings-family-members';

// ----------------------------------------------------------------------

export function SettingsView() {
  return (
    <DashboardContent maxWidth="lg">
      <Typography variant="h4" sx={{ mb: { xs: 3, md: 5 } }}>
        Settings
      </Typography>

      <Stack spacing={4}>
        {/* Family Members */}
        <SettingsFamilyMembers />

        {/* Integrations */}
        <SettingsIntegrations />

        {/* App Preferences */}
        <SettingsPreferences />
      </Stack>
    </DashboardContent>
  );
}
