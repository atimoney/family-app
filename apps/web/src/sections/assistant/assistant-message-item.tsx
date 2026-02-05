import type { ChatMessage } from 'src/features/assistant';

import Markdown from 'react-markdown';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';

import { fToNow } from 'src/utils/format-time';

import { Iconify } from 'src/components/iconify';

import { useMockedUser } from 'src/auth/hooks';

import { AssistantDebugPanel } from './assistant-debug-panel';
import { AssistantConfirmationCard } from './assistant-confirmation-card';

// ----------------------------------------------------------------------

type Props = {
  message: ChatMessage;
  onConfirm: (token: string) => void;
  onCancel: (messageId: string) => void;
};

export function AssistantMessageItem({ message, onConfirm, onCancel }: Props) {
  const { user } = useMockedUser();
  const isUser = message.role === 'user';
  const isError = message.status === 'error';
  const isSending = message.status === 'sending';

  const renderInfo = () => (
    <Typography
      noWrap
      variant="caption"
      sx={{
        mb: 1,
        color: 'text.disabled',
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        ...(!isUser && { mr: 'auto' }),
      }}
    >
      {!isUser && (
        <>
          <strong>Assistant</strong>
          {message.domain && (
            <Typography component="span" variant="caption" sx={{ color: 'text.disabled' }}>
              ({message.domain})
            </Typography>
          )}
          {' · '}
        </>
      )}
      {fToNow(message.timestamp)}
      {isSending && (
        <Typography component="span" variant="caption" sx={{ color: 'text.disabled', ml: 0.5 }}>
          · Sending...
        </Typography>
      )}
    </Typography>
  );

  const renderBody = () => (
    <Stack
      sx={{
        p: 1.5,
        minWidth: 48,
        maxWidth: 480,
        borderRadius: 1,
        typography: 'body2',
        bgcolor: 'background.neutral',
        wordBreak: 'break-word',
        ...(isUser && {
          color: 'grey.800',
          bgcolor: 'primary.lighter',
          whiteSpace: 'pre-wrap',
        }),
        ...(isError && {
          color: 'error.dark',
          bgcolor: 'error.lighter',
        }),
        // Markdown styling for assistant messages
        ...(!isUser && {
          '& p': { m: 0, mb: 1, '&:last-child': { mb: 0 } },
          '& h1, & h2, & h3, & h4': { mt: 1.5, mb: 1, fontWeight: 600 },
          '& h3': { fontSize: '1rem' },
          '& ul, & ol': { m: 0, pl: 2.5, mb: 1 },
          '& li': { mb: 0.5 },
          '& strong': { fontWeight: 600 },
          '& code': {
            px: 0.5,
            py: 0.25,
            borderRadius: 0.5,
            bgcolor: 'action.hover',
            fontFamily: 'monospace',
            fontSize: '0.875em',
          },
          '& pre': {
            p: 1,
            borderRadius: 1,
            bgcolor: 'action.hover',
            overflow: 'auto',
            '& code': { p: 0, bgcolor: 'transparent' },
          },
        }),
      }}
    >
      {isUser ? message.content : <Markdown>{message.content}</Markdown>}
    </Stack>
  );

  const renderStatus = () => {
    if (!isUser) return null;

    return (
      <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {isSending && (
          <Iconify icon="solar:restart-bold" width={14} sx={{ color: 'text.disabled' }} />
        )}
        {message.status === 'sent' && (
          <Iconify icon="eva:checkmark-fill" width={14} sx={{ color: 'success.main' }} />
        )}
        {isError && (
          <Iconify icon="solar:danger-bold" width={14} sx={{ color: 'error.main' }} />
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      {!isUser && (
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
      )}

      <Stack alignItems={isUser ? 'flex-end' : 'flex-start'} sx={{ maxWidth: '80%' }}>
        {renderInfo()}

        {renderBody()}
        {renderStatus()}

        {/* Confirmation card for pending actions */}
        {message.requiresConfirmation && message.pendingAction && (
          <AssistantConfirmationCard
            pendingAction={message.pendingAction}
            onConfirm={() => onConfirm(message.pendingAction!.token)}
            onCancel={() => onCancel(message.id)}
          />
        )}

        {/* Debug panel for development */}
        {!isUser && import.meta.env.DEV && message.actions && message.actions.length > 0 && (
          <AssistantDebugPanel message={message} />
        )}
      </Stack>

      {isUser && (
        <Avatar alt={user?.displayName ?? 'User'} src={user?.photoURL} sx={{ width: 32, height: 32, ml: 2 }}>
          {user?.displayName?.charAt(0) ?? 'U'}
        </Avatar>
      )}
    </Box>
  );
}
