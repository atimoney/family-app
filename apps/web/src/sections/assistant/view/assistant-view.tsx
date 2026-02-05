import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { useAgentChat } from 'src/features/assistant';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';

import { AssistantEmptyState } from '../assistant-empty-state';
import { AssistantMessageList } from '../assistant-message-list';
import { AssistantQuickActions } from '../assistant-quick-actions';
import { AssistantMessageInput } from '../assistant-message-input';

// ----------------------------------------------------------------------

export function AssistantView() {
  const {
    messages,
    isLoading,
    sendMessage,
    confirmAction,
    cancelAction,
    newConversation,
    handleQuickAction,
  } = useAgentChat();

  const isEmpty = messages.length === 0;

  return (
    <DashboardContent maxWidth="md">
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4">AI Assistant</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Chat with your family assistant to manage tasks, calendar, and more.
          </Typography>
        </Box>

        <Button
          variant="outlined"
          color="inherit"
          startIcon={<Iconify icon="solar:add-circle-bold" />}
          onClick={newConversation}
          disabled={isEmpty}
        >
          New Chat
        </Button>
      </Box>

      {/* Chat Container */}
      <Card
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 260px)',
          minHeight: 500,
        }}
      >
        {/* Message List or Empty State */}
        {isEmpty && !isLoading ? (
          <AssistantEmptyState />
        ) : (
          <AssistantMessageList
            messages={messages}
            loading={isLoading}
            onConfirm={confirmAction}
            onCancel={cancelAction}
          />
        )}

        {/* Quick Actions */}
        <AssistantQuickActions disabled={isLoading} onAction={handleQuickAction} />

        {/* Message Input */}
        <AssistantMessageInput
          loading={isLoading}
          disabled={isLoading}
          onSend={sendMessage}
        />
      </Card>
    </DashboardContent>
  );
}
