import { useRef, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  disabled?: boolean;
  loading?: boolean;
  onSend: (message: string) => void;
};

export function AssistantMessageInput({ disabled, loading, onSend }: Props) {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(event.target.value);
  }, []);

  const handleSend = useCallback(() => {
    if (!message.trim() || disabled || loading) {
      return;
    }

    onSend(message.trim());
    setMessage('');

    // Focus back on input
    inputRef.current?.focus();
  }, [message, disabled, loading, onSend]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      // Send on Enter (without Shift)
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <Box
      sx={(theme) => ({
        px: 2,
        py: 1.5,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 1,
        borderTop: `solid 1px ${theme.vars.palette.divider}`,
        bgcolor: 'background.paper',
      })}
    >
      <InputBase
        inputRef={inputRef}
        fullWidth
        multiline
        maxRows={4}
        value={message}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
        disabled={disabled || loading}
        sx={{
          px: 1.5,
          py: 1,
          borderRadius: 1,
          bgcolor: 'background.neutral',
          '& .MuiInputBase-input': {
            typography: 'body2',
          },
        }}
      />

      <IconButton
        color="primary"
        disabled={!message.trim() || disabled || loading}
        onClick={handleSend}
        sx={{
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          '&:hover': {
            bgcolor: 'primary.dark',
          },
          '&.Mui-disabled': {
            bgcolor: 'action.disabledBackground',
            color: 'action.disabled',
          },
        }}
      >
        {loading ? (
          <CircularProgress size={20} color="inherit" />
        ) : (
          <Iconify icon="custom:send-fill" />
        )}
      </IconButton>
    </Box>
  );
}
