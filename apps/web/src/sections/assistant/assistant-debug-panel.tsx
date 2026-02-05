import type { ChatMessage } from 'src/features/assistant';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  message: ChatMessage;
};

export function AssistantDebugPanel({ message }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!message.actions || message.actions.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mt: 1, width: '100%' }}>
      <ButtonBase
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          py: 0.5,
          px: 1,
          borderRadius: 0.5,
          typography: 'caption',
          color: 'text.disabled',
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
      >
        <Iconify
          icon={expanded ? 'eva:chevron-down-fill' : 'eva:arrowhead-right-fill'}
          width={16}
        />
        Debug Info ({message.actions.length} action{message.actions.length !== 1 ? 's' : ''})
      </ButtonBase>

      <Collapse in={expanded}>
        <Box
          sx={{
            mt: 1,
            p: 1.5,
            borderRadius: 1,
            bgcolor: 'grey.900',
            color: 'grey.300',
            fontSize: '0.75rem',
            fontFamily: 'monospace',
            overflow: 'auto',
            maxHeight: 300,
          }}
        >
          {/* Request Info */}
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="caption"
              sx={{ color: 'primary.light', fontFamily: 'monospace', fontWeight: 600 }}
            >
              Domain: {message.domain || 'unknown'}
            </Typography>
          </Box>

          {/* Actions */}
          {message.actions.map((action, index) => (
            <Box key={index} sx={{ mb: 2, '&:last-child': { mb: 0 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Iconify
                  icon={action.result.success ? 'solar:check-circle-bold' : 'solar:close-circle-bold'}
                  width={14}
                  sx={{ color: action.result.success ? 'success.light' : 'error.light' }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    color: action.result.success ? 'success.light' : 'error.light',
                  }}
                >
                  {action.tool}
                </Typography>
                {action.result.executionMs !== undefined && (
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'grey.500' }}>
                    ({action.result.executionMs}ms)
                  </Typography>
                )}
              </Box>

              {/* Input */}
              <Box sx={{ ml: 2.5 }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'grey.500' }}>
                  Input:
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    mt: 0.5,
                    p: 1,
                    borderRadius: 0.5,
                    bgcolor: 'grey.800',
                    fontSize: '0.7rem',
                    overflow: 'auto',
                  }}
                >
                  {JSON.stringify(action.input, null, 2)}
                </Box>
              </Box>

              {/* Result */}
              <Box sx={{ ml: 2.5, mt: 1 }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'grey.500' }}>
                  Result:
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    mt: 0.5,
                    p: 1,
                    borderRadius: 0.5,
                    bgcolor: 'grey.800',
                    fontSize: '0.7rem',
                    overflow: 'auto',
                    maxHeight: 150,
                  }}
                >
                  {action.result.error
                    ? action.result.error
                    : JSON.stringify(action.result.data, null, 2)}
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}
