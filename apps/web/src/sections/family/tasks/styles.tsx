import type { CSSObject } from '@mui/material/styles';

import { varAlpha } from 'minimal-shared/utils';

import { styled } from '@mui/material/styles';

// ----------------------------------------------------------------------

export const TasksCalendarRoot = styled('div')(({ theme }) => {
  const cssVars: CSSObject = {
    '--fc-small-font-size': '0.813rem',
    '--fc-border-color': theme.vars.palette.TableCell.border,
    '--fc-page-bg-color': theme.vars.palette.background.default,
    '--fc-neutral-text-color': theme.vars.palette.text.secondary,
    '--fc-neutral-bg-color': theme.vars.palette.background.neutral,
    /********/
    '--fc-more-link-bg-color': 'var(--fc-neutral-bg-color)',
    '--fc-more-link-text-color': 'var(--fc-neutral-text-color)',
    /********/
    '--fc-bg-event-opacity': 0.48,
    '--fc-bg-event-color': 'transparent',
    '--fc-event-selected-overlay-color': 'transparent',
    '--fc-list-event-hover-bg-color': theme.vars.palette.action.hover,
    /********/
    '--fc-today-bg-color': 'transparent',
    '--fc-now-indicator-color': theme.vars.palette.error.main,
    '--fc-highlight-color': varAlpha(theme.vars.palette.grey['500Channel'], 0.12),
    '--fc-non-business-color': varAlpha(theme.vars.palette.grey['500Channel'], 0.08),
    /********/
    '--custom-event-bg-opacity': 0.24,
    '--custom-day-number-py': '4px',
    '--custom-day-number-px': '8px',
    '--custom-day-number-active-size': '26px',
    '--custom-day-other-color': theme.vars.palette.action.disabled,
    '--custom-day-business-color': theme.vars.palette.text.secondary,
    '--custom-today-color': theme.vars.palette.error.contrastText,
    '--custom-today-bg': theme.vars.palette.error.main,
    // Task-specific colors
    '--task-todo-color': theme.vars.palette.grey[500],
    '--task-doing-color': theme.vars.palette.info.main,
    '--task-done-color': theme.vars.palette.success.main,
    '--task-overdue-color': theme.vars.palette.error.main,
  };

  const containerStyles: CSSObject = {
    '& .fc-license-message': { display: 'none' },
    '& .fc-media-screen': {
      flex: '1 1 auto',
      marginLeft: -1,
      marginBottom: -1,
      width: 'calc(100% + 2px)',
    },
  };

  const tableHeadStyles: CSSObject = {
    '& .fc-col-header-cell': {
      borderRightColor: 'transparent',
      '& .fc-col-header-cell-cushion': {
        ...theme.typography.subtitle2,
        paddingTop: 12.5,
        paddingBottom: 12.5,
      },
    },
  };

  const tableBodyStyles: CSSObject = {
    // base day
    '& .fc-daygrid-day-number': {
      ...theme.typography.body2,
      lineHeight: 'var(--custom-day-number-active-size)',
      padding: 'var(--custom-day-number-py) var(--custom-day-number-px)',
    },
    // today
    '& .fc-day-today .fc-daygrid-day-number': {
      display: 'inline-flex',
      justifyContent: 'center',
      color: 'var(--custom-today-color)',
      fontWeight: theme.typography.fontWeightSemiBold,
      width: 'calc(var(--custom-day-number-active-size) + var(--custom-day-number-px))',
      '&::before': {
        zIndex: -1,
        content: '""',
        borderRadius: '50%',
        position: 'absolute',
        backgroundColor: 'var(--custom-today-bg)',
        width: 'var(--custom-day-number-active-size)',
        height: 'var(--custom-day-number-active-size)',
      },
    },
    // sat & sun days
    '& .fc-day-sat, & .fc-day-sun': {
      '&.fc-col-header-cell, & .fc-daygrid-day-top': {
        color: 'var(--custom-day-business-color)',
      },
    },
    // other days
    '& .fc-day-other .fc-daygrid-day-top': {
      opacity: 1,
      color: 'var(--custom-day-other-color)',
    },
  };

  const eventStyles: CSSObject = {
    '& .fc-event': {
      borderWidth: 0,
      borderRadius: 6,
      boxShadow: 'none',
      cursor: 'pointer',
      '& .fc-event-main': {
        padding: '2px 6px',
        borderRadius: 'inherit',
        backgroundColor: 'inherit',
        transition: theme.transitions.create(['filter']),
        '&:hover': {
          filter: 'brightness(0.92)',
        },
      },
      '& .fc-event-main-frame': {
        lineHeight: 20 / 13,
        color: 'inherit',
      },
      '& .fc-event-title': {
        textOverflow: 'ellipsis',
      },
      '& .fc-event-time': {
        overflow: 'unset',
        fontWeight: theme.typography.fontWeightBold,
      },
    },
    '& .fc-daygrid-event': {
      marginTop: 0,
      marginBottom: 4,
    },
    '& .fc-daygrid-event.fc-event-end, & .fc-daygrid-event.fc-event-start': {
      marginLeft: 4,
      marginRight: 4,
    },
    // Task status-based styling
    '& .fc-event[data-status="done"]': {
      opacity: 0.6,
      '& .fc-event-title': {
        textDecoration: 'line-through',
      },
    },
    '& .fc-event[data-overdue="true"]': {
      borderLeft: `3px solid var(--task-overdue-color)`,
    },
  };

  const timeGridStyles: CSSObject = {
    '& .fc-timegrid-axis-cushion': {
      ...theme.typography.body2,
      color: theme.vars.palette.text.secondary,
    },
    '& .fc-timegrid-slot-label-cushion': {
      ...theme.typography.body2,
    },
  };

  const popoverStyles: CSSObject = {
    '& .fc-popover': {
      borderWidth: 0,
      boxShadow: theme.vars.customShadows.dropdown,
      borderRadius: Number(theme.shape.borderRadius) * 1.5,
    },
    '& .fc-popover-header': {
      ...theme.typography.subtitle2,
      padding: theme.spacing(1),
      borderTopLeftRadius: 'inherit',
      borderTopRightRadius: 'inherit',
    },
    '& .fc-more-popover .fc-popover-body': {
      padding: theme.spacing(0.5),
    },
    '& .fc-popover-close': {
      opacity: 0.48,
      transition: theme.transitions.create(['opacity']),
      '&:hover': {
        opacity: 0.8,
      },
    },
  };

  const moreLinkStyles: CSSObject = {
    '& .fc-daygrid-more-link': {
      ...theme.typography.caption,
      padding: theme.spacing(0, 1),
      color: theme.vars.palette.text.secondary,
      fontWeight: theme.typography.fontWeightMedium,
      transition: theme.transitions.create(['color']),
      '&:hover': {
        textDecoration: 'underline',
        backgroundColor: 'transparent',
        color: theme.vars.palette.text.primary,
      },
    },
    '& .fc-timegrid-more-link': {
      padding: theme.spacing(0.5),
      fontWeight: theme.typography.fontWeightSemiBold,
    },
  };

  // Resource (Family Day) view styles
  const resourceStyles: CSSObject = {
    '& .fc-resource-timeline-divider, & .fc-resource-group': {
      backgroundColor: theme.vars.palette.background.neutral,
    },
    '& .fc-col-header-cell.fc-resource': {
      '& .fc-col-header-cell-cushion': {
        paddingTop: 8,
        paddingBottom: 8,
      },
    },
    '& .fc-resource': {
      borderColor: 'var(--fc-border-color)',
    },
    '& .fc-timegrid-col.fc-resource:nth-of-type(even)': {
      backgroundColor: varAlpha(theme.vars.palette.grey['500Channel'], 0.02),
    },
    '& .fc-datagrid-cell-frame': {
      display: 'flex',
      alignItems: 'center',
    },
    '& .fc-resource[data-resource-id="unassigned"]': {
      backgroundColor: varAlpha(theme.vars.palette.grey['500Channel'], 0.04),
    },
  };

  return {
    ...cssVars,
    ...containerStyles,
    ...tableHeadStyles,
    ...tableBodyStyles,
    ...timeGridStyles,
    ...eventStyles,
    ...popoverStyles,
    ...moreLinkStyles,
    ...resourceStyles,
  };
});
