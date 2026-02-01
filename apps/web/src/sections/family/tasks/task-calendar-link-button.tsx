import type { Task } from 'src/features/tasks/types';

import { toast } from 'sonner';
import { useState } from 'react';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { unlinkCalendarEvent, createCalendarEventFromTask } from 'src/features/tasks/api';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  task: Task;
  onUpdate?: (task: Task) => void;
  variant?: 'button' | 'icon';
  disabled?: boolean;
};

export function TaskCalendarLinkButton({ task, onUpdate, variant = 'button', disabled }: Props) {
  const [loading, setLoading] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(menuAnchorEl);

  const isLinked = Boolean(task.linkedCalendarEventId);
  const canLink = Boolean(task.dueAt) && !isLinked;

  const handleCreateEvent = async () => {
    if (!task.dueAt) {
      toast.error('Task must have a due date to create a calendar event');
      return;
    }

    setLoading(true);
    try {
      const result = await createCalendarEventFromTask(task.id);
      toast.success('Calendar event created');
      onUpdate?.(result.task);
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      toast.error('Failed to create calendar event');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async (deleteEvent: boolean) => {
    setMenuAnchorEl(null);
    setLoading(true);
    try {
      const updatedTask = await unlinkCalendarEvent(task.id, deleteEvent);
      toast.success(deleteEvent ? 'Calendar event removed' : 'Calendar event unlinked');
      onUpdate?.(updatedTask);
    } catch (error) {
      console.error('Failed to unlink calendar event:', error);
      toast.error('Failed to unlink calendar event');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkedClick = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  // Icon-only variant (for task list items)
  if (variant === 'icon') {
    if (isLinked) {
      return (
        <>
          <Tooltip title="Linked to calendar">
            <IconButton
              size="small"
              color="primary"
              onClick={handleLinkedClick}
              disabled={loading || disabled}
            >
              {loading ? (
                <CircularProgress size={16} />
              ) : (
                <Iconify icon="solar:calendar-date-bold" width={18} />
              )}
            </IconButton>
          </Tooltip>
          <Menu anchorEl={menuAnchorEl} open={menuOpen} onClose={handleMenuClose}>
            <MenuItem onClick={() => handleUnlink(false)}>
              <Iconify icon="eva:close-fill" width={18} sx={{ mr: 1 }} />
              Unlink from calendar
            </MenuItem>
            <MenuItem onClick={() => handleUnlink(true)} sx={{ color: 'error.main' }}>
              <Iconify icon="solar:trash-bin-trash-bold" width={18} sx={{ mr: 1 }} />
              Remove event from calendar
            </MenuItem>
          </Menu>
        </>
      );
    }

    if (canLink) {
      return (
        <Tooltip title="Add to calendar">
          <IconButton
            size="small"
            onClick={handleCreateEvent}
            disabled={loading || disabled}
          >
            {loading ? (
              <CircularProgress size={16} />
            ) : (
              <Iconify icon="mingcute:add-line" width={18} />
            )}
          </IconButton>
        </Tooltip>
      );
    }

    return null;
  }

  // Button variant (for task form)
  if (isLinked) {
    return (
      <Box>
        <Button
          variant="outlined"
          color="primary"
          onClick={handleLinkedClick}
          disabled={loading || disabled}
          startIcon={
            loading ? (
              <CircularProgress size={16} />
            ) : (
              <Iconify icon="solar:calendar-date-bold" />
            )
          }
          sx={{ justifyContent: 'flex-start' }}
        >
          <Box sx={{ textAlign: 'left' }}>
            <Typography variant="body2">Linked to Calendar</Typography>
          </Box>
        </Button>
        <Menu anchorEl={menuAnchorEl} open={menuOpen} onClose={handleMenuClose}>
          <MenuItem onClick={() => handleUnlink(false)}>
            <Iconify icon="eva:close-fill" width={18} sx={{ mr: 1 }} />
            Unlink from calendar
          </MenuItem>
          <MenuItem onClick={() => handleUnlink(true)} sx={{ color: 'error.main' }}>
            <Iconify icon="solar:trash-bin-trash-bold" width={18} sx={{ mr: 1 }} />
            Remove event from calendar
          </MenuItem>
        </Menu>
      </Box>
    );
  }

  return (
    <Button
      variant="outlined"
      color="inherit"
      onClick={handleCreateEvent}
      disabled={!canLink || loading || disabled}
      startIcon={
        loading ? (
          <CircularProgress size={16} />
        ) : (
          <Iconify icon="mingcute:add-line" />
        )
      }
      sx={{ justifyContent: 'flex-start' }}
    >
      {!task.dueAt ? 'Set due date to add to calendar' : 'Add to Calendar'}
    </Button>
  );
}
