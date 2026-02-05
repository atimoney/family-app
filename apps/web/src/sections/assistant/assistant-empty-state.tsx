import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export function AssistantEmptyState() {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={2}
      sx={{
        flex: '1 1 auto',
        px: 3,
        py: 5,
        textAlign: 'center',
      }}
    >
      <Avatar
        sx={{
          width: 80,
          height: 80,
          bgcolor: 'primary.lighter',
        }}
      >
        <Iconify icon="solar:chat-round-dots-bold" width={48} sx={{ color: 'primary.main' }} />
      </Avatar>

      <Stack spacing={1} sx={{ maxWidth: 360 }}>
        <Typography variant="h6">Hi! I&apos;m your family assistant.</Typography>

        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          How can I help you today?
        </Typography>
      </Stack>

      <Stack spacing={0.5} sx={{ mt: 2 }}>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          Try asking me to:
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          &ldquo;Create a task to buy groceries&rdquo;
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          &ldquo;What&apos;s on the calendar today?&rdquo;
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          &ldquo;Help me plan meals for this week&rdquo;
        </Typography>
      </Stack>
    </Stack>
  );
}
