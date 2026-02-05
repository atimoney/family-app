import type { ChatMessage } from 'src/features/assistant';

import { useRef, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import LinearProgress from '@mui/material/LinearProgress';

import { Scrollbar } from 'src/components/scrollbar';

import { AssistantMessageItem } from './assistant-message-item';
import { AssistantTypingIndicator } from './assistant-typing-indicator';

// ----------------------------------------------------------------------

type Props = {
  messages: ChatMessage[];
  loading: boolean;
  onConfirm: (token: string) => void;
  onCancel: (messageId: string) => void;
};

export function AssistantMessageList({ messages, loading, onConfirm, onCancel }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current && !isUserScrolledUp.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // Handle scroll events to track if user has scrolled up
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    isUserScrolledUp.current = !isAtBottom;
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Show loading state while initial load
  if (messages.length === 0 && loading) {
    return (
      <Stack sx={{ flex: '1 1 auto', position: 'relative' }}>
        <LinearProgress
          color="inherit"
          sx={{
            top: 0,
            left: 0,
            width: 1,
            height: 2,
            borderRadius: 0,
            position: 'absolute',
          }}
        />
      </Stack>
    );
  }

  return (
    <Scrollbar
      ref={scrollRef}
      onScroll={handleScroll}
      sx={{
        px: 3,
        pt: 5,
        pb: 3,
        flex: '1 1 auto',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {messages.map((message) => (
          <AssistantMessageItem
            key={message.id}
            message={message}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        ))}

        {loading && <AssistantTypingIndicator />}
      </Box>
    </Scrollbar>
  );
}
