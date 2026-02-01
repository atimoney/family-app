import type { TaskTemplate, FamilyMember } from '@family/shared';

import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import CardContent from '@mui/material/CardContent';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';

import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

// ----------------------------------------------------------------------

type Props = {
  templates: TaskTemplate[];
  members: FamilyMember[];
  loading?: boolean;
  onEdit: (template: TaskTemplate) => void;
  onDelete: (template: TaskTemplate) => void;
  onCreate: () => void;
};

export function TaskTemplateList({
  templates,
  members,
  loading = false,
  onEdit,
  onDelete,
  onCreate,
}: Props) {
  const [deleteConfirm, setDeleteConfirm] = useState<TaskTemplate | null>(null);

  const getMemberName = useCallback(
    (memberId: string | null | undefined) => {
      if (!memberId) return null;
      const member = members.find((m) => m.id === memberId);
      return member?.displayName || member?.profile?.displayName || 'Unknown';
    },
    [members]
  );

  const formatDueDate = (days: number | null | undefined, time: string | null | undefined) => {
    if (days === null || days === undefined) return null;
    let text = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
    if (time) {
      text += ` at ${time}`;
    }
    return text;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      default:
        return 'default';
    }
  };

  const handleConfirmDelete = useCallback(() => {
    if (deleteConfirm) {
      onDelete(deleteConfirm);
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, onDelete]);

  if (loading) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">Loading templates...</Typography>
      </Box>
    );
  }

  if (templates.length === 0) {
    return (
      <EmptyContent
        title="No templates yet"
        description="Create templates to quickly add common tasks"
        action={
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={onCreate}
          >
            Create Template
          </Button>
        }
        sx={{ py: 8 }}
      />
    );
  }

  return (
    <>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Task Templates</Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={onCreate}
          >
            New Template
          </Button>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
            },
          }}
        >
          {templates.map((template) => (
            <Card
              key={template.id}
              sx={{
                position: 'relative',
                '&:hover .template-actions': {
                  opacity: 1,
                },
              }}
            >
              <CardContent>
                <Stack spacing={1.5}>
                  {/* Header */}
                  <Stack direction="row" alignItems="flex-start" spacing={1}>
                    {template.icon && (
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 1,
                          bgcolor: template.color || 'primary.lighter',
                          flexShrink: 0,
                        }}
                      >
                        <Iconify
                          icon={template.icon as any}
                          width={20}
                          sx={{ color: template.color ? 'common.white' : 'primary.main' }}
                        />
                      </Box>
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" noWrap>
                        {template.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {template.title}
                      </Typography>
                    </Box>
                  </Stack>

                  {/* Priority & Usage */}
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      size="small"
                      label={template.priority}
                      color={getPriorityColor(template.priority) as any}
                      sx={{ height: 20, fontSize: 10 }}
                    />
                    <Typography variant="caption" color="text.disabled">
                      {template.usageCount} uses
                    </Typography>
                  </Stack>

                  {/* Details */}
                  <Stack spacing={0.5}>
                    {getMemberName(template.defaultAssigneeId) && (
                      <Typography variant="caption" color="text.secondary">
                        <Iconify
                          icon="solar:user-id-bold"
                          width={14}
                          sx={{ mr: 0.5, verticalAlign: 'middle' }}
                        />
                        {getMemberName(template.defaultAssigneeId)}
                      </Typography>
                    )}
                    {formatDueDate(template.dueDaysFromNow, template.dueTimeOfDay) && (
                      <Typography variant="caption" color="text.secondary">
                        <Iconify
                          icon="solar:calendar-date-bold"
                          width={14}
                          sx={{ mr: 0.5, verticalAlign: 'middle' }}
                        />
                        {formatDueDate(template.dueDaysFromNow, template.dueTimeOfDay)}
                      </Typography>
                    )}
                    {template.labels.length > 0 && (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                        {template.labels.slice(0, 3).map((label) => (
                          <Chip key={label} label={label} size="small" sx={{ height: 18, fontSize: 10 }} />
                        ))}
                        {template.labels.length > 3 && (
                          <Typography variant="caption" color="text.secondary">
                            +{template.labels.length - 3}
                          </Typography>
                        )}
                      </Stack>
                    )}
                  </Stack>
                </Stack>
              </CardContent>

              {/* Actions overlay */}
              <Stack
                className="template-actions"
                direction="row"
                spacing={0.5}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  opacity: 0,
                  transition: 'opacity 0.2s',
                }}
              >
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => onEdit(template)}>
                    <Iconify icon="solar:pen-bold" width={16} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => setDeleteConfirm(template)}
                  >
                    <Iconify icon="solar:trash-bin-trash-bold" width={16} />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Card>
          ))}
        </Box>
      </Stack>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Delete Template</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete &ldquo;{deleteConfirm?.name}&rdquo;? This action cannot
            be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
