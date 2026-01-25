import type { IconifyProps } from 'src/components/iconify';

import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

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
  return (
    <Card>
      <CardHeader
        title="Integrations"
        subheader="Connect external services and automations"
      />
      <CardContent>
        <Stack spacing={3}>
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
