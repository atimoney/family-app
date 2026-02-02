import type { ListItemDTO, FieldDefinition } from '@family/shared';

import { useState, useCallback } from 'react';
import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ButtonBase from '@mui/material/ButtonBase';
import InputAdornment from '@mui/material/InputAdornment';

import { Iconify } from 'src/components/iconify';

import { GroupedItemRow } from './grouped-item-row';

// ----------------------------------------------------------------------

type GroupSectionProps = {
  groupKey: string;
  label: string;
  items: ListItemDTO[];
  collapsed: boolean;
  inlineFields: FieldDefinition[];
  groupByField: FieldDefinition | null;
  allGroups: { key: string; label: string }[];
  onToggleCollapse: () => void;
  onToggleStatus: (item: ListItemDTO) => void;
  onUpdateTitle: (item: ListItemDTO, title: string) => void;
  onMoveToGroup: (item: ListItemDTO, newGroupKey: string) => void;
  onOpenEditor: (item: ListItemDTO) => void;
  onQuickAdd: (title: string) => void;
};

export function GroupSection({
  groupKey,
  label,
  items,
  collapsed,
  inlineFields,
  groupByField,
  allGroups,
  onToggleCollapse,
  onToggleStatus,
  onUpdateTitle,
  onMoveToGroup,
  onOpenEditor,
  onQuickAdd,
}: GroupSectionProps) {
  const quickAdd = useBoolean();
  const [quickAddValue, setQuickAddValue] = useState('');

  // Stats
  const totalCount = items.length;
  const doneCount = items.filter((i) => i.status === 'done').length;
  const openCount = totalCount - doneCount;

  // Handle quick add submit
  const handleQuickAddSubmit = useCallback(() => {
    if (quickAddValue.trim()) {
      onQuickAdd(quickAddValue.trim());
      setQuickAddValue('');
      // Keep input open for rapid entry
    }
  }, [quickAddValue, onQuickAdd]);

  // Handle quick add key press
  const handleQuickAddKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleQuickAddSubmit();
      } else if (e.key === 'Escape') {
        quickAdd.onFalse();
        setQuickAddValue('');
      }
    },
    [handleQuickAddSubmit, quickAdd]
  );

  // Get option color if available
  const optionColor = groupByField?.options?.find((o) => o.value === groupKey)?.color;

  return (
    <Box
      sx={{
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <ButtonBase
        onClick={onToggleCollapse}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1.5,
          bgcolor: 'background.neutral',
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Iconify
            icon={(collapsed ? 'solar:alt-arrow-right-bold' : 'solar:alt-arrow-down-bold') as any}
            width={16}
            sx={{ color: 'text.secondary' }}
          />
          {optionColor && (
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: optionColor,
              }}
            />
          )}
          <Typography variant="subtitle2">{label}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {openCount} open{doneCount > 0 && `, ${doneCount} done`}
          </Typography>
        </Stack>

        {/* Add button (when expanded) */}
        {!collapsed && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              quickAdd.onTrue();
            }}
            sx={{ mr: 0.5 }}
          >
            <Iconify icon={'solar:add-circle-bold' as any} width={18} />
          </IconButton>
        )}
      </ButtonBase>

      {/* Content */}
      <Collapse in={!collapsed}>
        <Box sx={{ p: 1 }}>
          {/* Quick Add Input (shown when enabled) */}
          {quickAdd.value && (
            <TextField
              autoFocus
              fullWidth
              size="small"
              placeholder={`Add to ${label}...`}
              value={quickAddValue}
              onChange={(e) => setQuickAddValue(e.target.value)}
              onKeyDown={handleQuickAddKeyDown}
              onBlur={() => {
                if (!quickAddValue.trim()) {
                  quickAdd.onFalse();
                }
              }}
              slotProps={{
                input: {
                  endAdornment: quickAddValue.trim() && (
                    <InputAdornment position="end">
                      <IconButton size="small" edge="end" onClick={handleQuickAddSubmit}>
                        <Iconify icon={'solar:arrow-right-bold' as any} width={18} />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ mb: 1 }}
            />
          )}

          {/* Items */}
          {items.length === 0 ? (
            <Typography
              variant="body2"
              sx={{ color: 'text.disabled', py: 2, textAlign: 'center' }}
            >
              No items in this group
            </Typography>
          ) : (
            <Stack spacing={0}>
              {items.map((item) => (
                <GroupedItemRow
                  key={item.id}
                  item={item}
                  inlineFields={inlineFields}
                  allGroups={allGroups}
                  currentGroupKey={groupKey}
                  onToggleStatus={() => onToggleStatus(item)}
                  onUpdateTitle={(title) => onUpdateTitle(item, title)}
                  onMoveToGroup={(newGroupKey) => onMoveToGroup(item, newGroupKey)}
                  onOpenEditor={() => onOpenEditor(item)}
                />
              ))}
            </Stack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
