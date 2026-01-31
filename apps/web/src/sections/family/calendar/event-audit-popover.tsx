import type { EventAuditInfo } from 'src/features/calendar/types';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Timeline from '@mui/lab/Timeline';
import Popover from '@mui/material/Popover';
import TimelineDot from '@mui/lab/TimelineDot';
import Typography from '@mui/material/Typography';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineItem, { timelineItemClasses } from '@mui/lab/TimelineItem';

import { fToNow, fDateTime } from 'src/utils/format-time';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  open: HTMLElement | null;
  onClose: () => void;
  createdAudit?: EventAuditInfo | null;
  lastModifiedAudit?: EventAuditInfo | null;
};

export function EventAuditPopover({ open, onClose, createdAudit, lastModifiedAudit }: Props) {
  // Build timeline entries from audit info
  const timelineItems: Array<{
    id: string;
    action: 'created' | 'updated';
    audit: EventAuditInfo;
  }> = [];

  if (createdAudit) {
    timelineItems.push({
      id: 'created',
      action: 'created',
      audit: createdAudit,
    });
  }

  // Only show lastModified if it's different from created
  if (lastModifiedAudit && lastModifiedAudit.modifiedAt !== createdAudit?.modifiedAt) {
    timelineItems.push({
      id: 'updated',
      action: 'updated',
      audit: lastModifiedAudit,
    });
  }

  // Sort by date descending (most recent first)
  timelineItems.sort((a, b) => 
    new Date(b.audit.modifiedAt).getTime() - new Date(a.audit.modifiedAt).getTime()
  );

  const hasHistory = timelineItems.length > 0;

  return (
    <Popover
      open={Boolean(open)}
      anchorEl={open}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{
        paper: {
          sx: { width: 320, maxHeight: 400 },
        },
      }}
    >
      <Box sx={{ p: 2, pb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Event History
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Track who made changes
        </Typography>
      </Box>

      {hasHistory ? (
        <Timeline
          sx={{
            m: 0,
            px: 2,
            pb: 2,
            [`& .${timelineItemClasses.root}:before`]: { flex: 0, padding: 0 },
          }}
        >
          {timelineItems.map((item, index) => (
            <AuditTimelineItem
              key={item.id}
              action={item.action}
              audit={item.audit}
              lastItem={index === timelineItems.length - 1}
            />
          ))}
        </Timeline>
      ) : (
        <Box sx={{ px: 2, pb: 3 }}>
          <Stack 
            alignItems="center" 
            spacing={1} 
            sx={{ 
              py: 3, 
              color: 'text.secondary',
              bgcolor: 'background.neutral',
              borderRadius: 1,
            }}
          >
            <Iconify icon="solar:clock-circle-bold" width={32} sx={{ opacity: 0.5 }} />
            <Typography variant="body2">No history available</Typography>
            <Typography variant="caption">
              Changes will be tracked after you save
            </Typography>
          </Stack>
        </Box>
      )}
    </Popover>
  );
}

// ----------------------------------------------------------------------

type AuditTimelineItemProps = {
  action: 'created' | 'updated';
  audit: EventAuditInfo;
  lastItem: boolean;
};

function AuditTimelineItem({ action, audit, lastItem }: AuditTimelineItemProps) {
  const getActionLabel = () => {
    if (action === 'created') return 'Created';
    return 'Updated';
  };

  const getSourceLabel = () => {
    if (audit.isDashboardMode) {
      return 'Dashboard';
    }
    switch (audit.editSource) {
      case 'sync':
        return 'Google Sync';
      case 'system':
        return 'System';
      default:
        return null;
    }
  };

  const sourceLabel = getSourceLabel();

  return (
    <TimelineItem>
      <TimelineSeparator>
        <TimelineDot
          color={action === 'created' ? 'success' : 'primary'}
          sx={{ m: 0 }}
        />
        {!lastItem && <TimelineConnector />}
      </TimelineSeparator>

      <TimelineContent sx={{ py: 0.5, px: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
          <Typography variant="subtitle2">
            {getActionLabel()}
          </Typography>
          {sourceLabel && (
            <Chip
              label={sourceLabel}
              size="small"
              variant="soft"
              color={audit.isDashboardMode ? 'warning' : 'default'}
              sx={{ 
                height: 20, 
                fontSize: '0.675rem',
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          )}
        </Stack>

        <Typography variant="body2" sx={{ color: 'text.primary' }}>
          {audit.modifiedByName || (audit.isDashboardMode ? 'Unknown (Dashboard)' : 'Unknown')}
        </Typography>

        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          {fDateTime(audit.modifiedAt)} ({fToNow(audit.modifiedAt)})
        </Typography>

        {audit.changeNote && (
          <Typography 
            variant="caption" 
            sx={{ 
              display: 'block',
              mt: 0.5,
              color: 'text.secondary',
              fontStyle: 'italic',
            }}
          >
            &ldquo;{audit.changeNote}&rdquo;
          </Typography>
        )}
      </TimelineContent>
    </TimelineItem>
  );
}
