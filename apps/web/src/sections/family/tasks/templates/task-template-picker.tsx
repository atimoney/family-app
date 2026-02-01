import type { TaskTemplate, FamilyMember } from '@family/shared';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import ListItem from '@mui/material/ListItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';

import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: () => void;
  templates: TaskTemplate[];
  members: FamilyMember[];
  onSelect: (template: TaskTemplate) => void;
  onManageTemplates?: () => void;
  loading?: boolean;
};

export function TaskTemplatePicker({
  open,
  onClose,
  templates,
  members,
  onSelect,
  onManageTemplates,
  loading = false,
}: Props) {
  const [search, setSearch] = useState('');

  // Reset search when dialog opens
  useEffect(() => {
    if (open) {
      setSearch('');
    }
  }, [open]);

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.title.toLowerCase().includes(search.toLowerCase())
  );

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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Create from Template</Typography>
          {onManageTemplates && (
            <Tooltip title="Manage templates">
              <IconButton onClick={onManageTemplates} size="small">
                <Iconify icon="solar:settings-bold" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {loading ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">Loading templates...</Typography>
          </Box>
        ) : filteredTemplates.length === 0 ? (
          <EmptyContent
            title={search ? 'No templates found' : 'No templates yet'}
            description={
              search
                ? 'Try a different search term'
                : 'Create templates to quickly add common tasks'
            }
            sx={{ py: 4 }}
          />
        ) : (
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredTemplates.map((template) => (
              <ListItem
                key={template.id}
                onClick={() => onSelect(template)}
                sx={{
                  px: 2,
                  py: 1.5,
                  mb: 1,
                  borderRadius: 1,
                  cursor: 'pointer',
                  bgcolor: 'background.neutral',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
                  {template.icon && (
                    <Box
                      sx={{
                        mr: 1.5,
                        mt: 0.5,
                        width: 32,
                        height: 32,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 1,
                        bgcolor: template.color || 'primary.lighter',
                      }}
                    >
                      <Iconify
                        icon={template.icon as any}
                        sx={{ color: template.color ? 'common.white' : 'primary.main' }}
                      />
                    </Box>
                  )}

                  <ListItemText
                    primary={
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="subtitle2">{template.title}</Typography>
                        <Chip
                          size="small"
                          label={template.priority}
                          color={getPriorityColor(template.priority) as any}
                          sx={{ height: 20, fontSize: 10 }}
                        />
                      </Stack>
                    }
                    secondary={
                      <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                        {template.description && (
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {template.description}
                          </Typography>
                        )}
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {getMemberName(template.defaultAssigneeId) && (
                            <Typography variant="caption" color="text.secondary">
                              👤 {getMemberName(template.defaultAssigneeId)}
                            </Typography>
                          )}
                          {formatDueDate(template.dueDaysFromNow, template.dueTimeOfDay) && (
                            <Typography variant="caption" color="text.secondary">
                              📅 {formatDueDate(template.dueDaysFromNow, template.dueTimeOfDay)}
                            </Typography>
                          )}
                          {template.labels.length > 0 && (
                            <Typography variant="caption" color="text.secondary">
                              🏷️ {template.labels.slice(0, 2).join(', ')}
                              {template.labels.length > 2 && ` +${template.labels.length - 2}`}
                            </Typography>
                          )}
                        </Stack>
                      </Stack>
                    }
                  />
                </Box>

                <ListItemSecondaryAction>
                  <Typography variant="caption" color="text.disabled">
                    {template.usageCount} uses
                  </Typography>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
