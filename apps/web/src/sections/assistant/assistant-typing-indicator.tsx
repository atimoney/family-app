import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import { keyframes } from '@mui/material/styles';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const bounce = keyframes`
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
`;

export function AssistantTypingIndicator() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
      <Avatar
        alt="Assistant"
        sx={{
          width: 32,
          height: 32,
          mr: 2,
          bgcolor: 'primary.lighter',
        }}
      >
        <Iconify icon="solar:chat-round-dots-bold" width={20} sx={{ color: 'primary.main' }} />
      </Avatar>

      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        sx={{
          p: 1.5,
          minWidth: 60,
          borderRadius: 1,
          bgcolor: 'background.neutral',
        }}
      >
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: 'text.disabled',
              animation: `${bounce} 1.4s ease-in-out infinite`,
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </Stack>
    </Box>
  );
}
