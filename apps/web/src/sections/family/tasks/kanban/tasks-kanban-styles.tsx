
import { varAlpha } from 'minimal-shared/utils';

import { styled } from '@mui/material/styles';

// ----------------------------------------------------------------------

// Global CSS variables for kanban (set via GlobalStyles in parent)
export const kanbanGlobalStyles = {
  '--kanban-item-gap': '12px',
  '--kanban-item-radius': '12px',
  '--kanban-column-gap': '20px',
  '--kanban-column-width': '320px',
  '--kanban-column-radius': '16px',
  '--kanban-column-pt': '16px',
  '--kanban-column-pb': '12px',
  '--kanban-column-px': '12px',
};

// ----------------------------------------------------------------------

export const KanbanColumnWrapper = styled('div')({
  flexShrink: 0,
  display: 'flex',
  userSelect: 'none',
  flexDirection: 'column',
  width: 'var(--kanban-column-width)',
});

export const KanbanColumnRoot = styled('div')(({ theme }) => ({
  display: 'flex',
  position: 'relative',
  flexDirection: 'column',
  gap: 'var(--kanban-item-gap)',
  borderRadius: 'var(--kanban-column-radius)',
  backgroundColor: theme.vars.palette.background.neutral,
  paddingTop: 'var(--kanban-column-pt)',
  paddingBottom: 'var(--kanban-column-pb)',
  paddingLeft: 'var(--kanban-column-px)',
  paddingRight: 'var(--kanban-column-px)',
  minHeight: 200,
  // Drag over styles
  '&[data-drag-over="true"]': {
    backgroundColor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
    outline: `2px dashed ${theme.vars.palette.primary.main}`,
    outlineOffset: -2,
  },
}));

export const KanbanColumnHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingBottom: theme.spacing(1.5),
  marginBottom: theme.spacing(0.5),
  borderBottom: `1px solid ${varAlpha(theme.vars.palette.grey['500Channel'], 0.12)}`,
}));

export const KanbanColumnList = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--kanban-item-gap)',
  minHeight: 100,
  flex: 1,
});

// ----------------------------------------------------------------------

export const KanbanItemRoot = styled('div')(({ theme }) => ({
  cursor: 'grab',
  display: 'flex',
  position: 'relative',
  flexDirection: 'column',
  borderRadius: 'var(--kanban-item-radius)',
  backgroundColor: theme.vars.palette.common.white,
  transition: theme.transitions.create(['filter', 'box-shadow', 'transform', 'opacity']),
  ...theme.applyStyles('dark', {
    backgroundColor: theme.vars.palette.grey[900],
  }),
  '&:hover': {
    boxShadow: theme.vars.customShadows.z8,
  },
  '&:active': {
    cursor: 'grabbing',
  },
  // Dragging state
  '&[data-dragging="true"]': {
    opacity: 0.4,
    transform: 'scale(1.02)',
    boxShadow: theme.vars.customShadows.z16,
  },
}));

export const KanbanItemContent = styled('div')(({ theme }) => ({
  position: 'relative',
  padding: theme.spacing(2),
}));

export const KanbanItemStatus = styled('div')<{ status?: 'todo' | 'doing' | 'done' }>(
  ({ theme, status }) => {
    const statusColors: Record<string, string> = {
      todo: theme.vars.palette.grey[500],
      doing: theme.vars.palette.info.main,
      done: theme.vars.palette.success.main,
    };

    return {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 4,
      height: '100%',
      borderRadius: 'var(--kanban-item-radius) 0 0 var(--kanban-item-radius)',
      backgroundColor: statusColors[status || 'todo'],
    };
  }
);

// Priority indicator
export const KanbanItemPriority = styled('div')<{
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}>(({ theme, priority }) => {
  const priorityColors: Record<string, string> = {
    low: theme.vars.palette.grey[400],
    medium: theme.vars.palette.info.main,
    high: theme.vars.palette.warning.main,
    urgent: theme.vars.palette.error.main,
  };

  return {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: priorityColors[priority || 'medium'],
  };
});

// ----------------------------------------------------------------------

// Scroll container for the board
export const KanbanBoardRoot = styled('div')(({ theme }) => ({
  ...theme.mixins.scrollbarStyles(theme),
  display: 'flex',
  overflowX: 'auto',
  gap: 'var(--kanban-column-gap)',
  padding: theme.spacing(2, 0),
  minHeight: 0,
  flex: '1 1 auto',
}));

// Drop placeholder
export const KanbanDropPlaceholder = styled('div')(({ theme }) => ({
  flexShrink: 0,
  borderRadius: 'var(--kanban-item-radius)',
  backgroundColor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
  border: `dashed 2px ${varAlpha(theme.vars.palette.primary.mainChannel, 0.24)}`,
  minHeight: 60,
}));
