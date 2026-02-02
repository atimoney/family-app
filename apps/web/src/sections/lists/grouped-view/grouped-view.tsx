import type {
  ListConfig,
  ListItemDTO,
  CreateListItemInput,
  UpdateListItemInput,
  UserListPreferencesDTO,
} from '@family/shared';

import { useBoolean } from 'minimal-shared/hooks';
import { useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';

import { EmptyContent } from 'src/components/empty-content';

import { GroupSection } from './group-section';
import { ItemEditorDialog } from '../item-editor-dialog';
import { QuickAddInput } from '../list-view/quick-add-input';

// ----------------------------------------------------------------------

type GroupedViewProps = {
  listId: string;
  items: ListItemDTO[];
  config: ListConfig;
  loading?: boolean;
  preferences: UserListPreferencesDTO | null;
  onCreateItem: (input: CreateListItemInput) => Promise<ListItemDTO | null>;
  onUpdateItem: (itemId: string, input: UpdateListItemInput) => Promise<ListItemDTO | null>;
  onDeleteItem: (itemId: string) => Promise<boolean>;
  onUpdatePreferences: (input: {
    groupBy?: string | null;
    collapsedGroups?: string[] | null;
  }) => Promise<unknown>;
};

export function GroupedView({
  listId,
  items,
  config,
  loading,
  preferences,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onUpdatePreferences,
}: GroupedViewProps) {
  // Dialog state
  const editorDialog = useBoolean();
  const [editingItem, setEditingItem] = useState<ListItemDTO | null>(null);

  // Get groupable fields (select, multi_select, text)
  const groupableFields = useMemo(
    () =>
      config.fields.filter((f) =>
        ['select', 'multi_select', 'text'].includes(f.type)
      ),
    [config.fields]
  );

  // Current groupBy field - from preferences, config default, or first groupable
  const defaultGroupBy = config.views?.grouped?.groupBy ?? groupableFields[0]?.key ?? null;
  const currentGroupBy = preferences?.groupBy ?? defaultGroupBy;

  // Get collapsed groups from preferences
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(preferences?.collapsedGroups ?? [])
  );

  // Get the selected field definition
  const groupByField = useMemo(
    () => config.fields.find((f) => f.key === currentGroupBy) ?? null,
    [config.fields, currentGroupBy]
  );

  // Group items by the selected field
  const groupedItems = useMemo(() => {
    if (!currentGroupBy) {
      return [{ key: '__all__', label: 'All Items', items }];
    }

    const groups = new Map<string, ListItemDTO[]>();
    const ungroupedKey = '__ungrouped__';

    items.forEach((item) => {
      const value = item.fields?.[currentGroupBy];

      if (value == null || value === '') {
        // Ungrouped items
        if (!groups.has(ungroupedKey)) {
          groups.set(ungroupedKey, []);
        }
        groups.get(ungroupedKey)!.push(item);
      } else if (Array.isArray(value)) {
        // Multi-select: item appears in multiple groups
        value.forEach((v) => {
          const key = String(v);
          if (!groups.has(key)) {
            groups.set(key, []);
          }
          groups.get(key)!.push(item);
        });
      } else {
        // Single value
        const key = String(value);
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(item);
      }
    });

    // Build result with proper labels
    const result: { key: string; label: string; items: ListItemDTO[] }[] = [];

    // For select fields, use option order
    if (groupByField?.options) {
      groupByField.options.forEach((opt) => {
        if (groups.has(opt.value)) {
          result.push({
            key: opt.value,
            label: opt.label,
            items: groups.get(opt.value)!,
          });
          groups.delete(opt.value);
        }
      });
    }

    // Add any remaining groups (text values or unknown options)
    groups.forEach((groupItems, key) => {
      if (key === ungroupedKey) return; // Handle at end
      result.push({
        key,
        label: key,
        items: groupItems,
      });
    });

    // Sort non-option groups alphabetically
    if (!groupByField?.options) {
      result.sort((a, b) => a.label.localeCompare(b.label));
    }

    // Add ungrouped at end
    if (groups.has(ungroupedKey)) {
      result.push({
        key: ungroupedKey,
        label: 'Ungrouped',
        items: groups.get(ungroupedKey)!,
      });
    }

    return result;
  }, [items, currentGroupBy, groupByField]);

  // Handle group-by change
  const handleGroupByChange = useCallback(
    async (newGroupBy: string) => {
      await onUpdatePreferences({ groupBy: newGroupBy, collapsedGroups: [] });
      setCollapsedGroups(new Set());
    },
    [onUpdatePreferences]
  );

  // Handle group collapse toggle
  const handleToggleCollapse = useCallback(
    async (groupKey: string) => {
      const newCollapsed = new Set(collapsedGroups);
      if (newCollapsed.has(groupKey)) {
        newCollapsed.delete(groupKey);
      } else {
        newCollapsed.add(groupKey);
      }
      setCollapsedGroups(newCollapsed);
      await onUpdatePreferences({ collapsedGroups: Array.from(newCollapsed) });
    },
    [collapsedGroups, onUpdatePreferences]
  );

  // Quick add handler - adds to selected group if we're in a group context
  const handleQuickAdd = useCallback(
    async (title: string, groupKey?: string) => {
      if (!title.trim()) return;

      const defaultFields: Record<string, unknown> = {};
      config.fields.forEach((field) => {
        if (field.defaultValue !== undefined) {
          defaultFields[field.key] = field.defaultValue;
        }
      });

      // If adding to a specific group, set the group field value
      if (groupKey && currentGroupBy && groupKey !== '__ungrouped__' && groupKey !== '__all__') {
        defaultFields[currentGroupBy] = groupKey;
      }

      await onCreateItem({
        title: title.trim(),
        status: 'open',
        fields: defaultFields,
      });
    },
    [config.fields, currentGroupBy, onCreateItem]
  );

  // Toggle item status
  const handleToggleStatus = useCallback(
    async (item: ListItemDTO) => {
      const newStatus = item.status === 'done' ? 'open' : 'done';
      await onUpdateItem(item.id, { status: newStatus });
    },
    [onUpdateItem]
  );

  // Update item title
  const handleUpdateTitle = useCallback(
    async (item: ListItemDTO, title: string) => {
      if (title.trim() && title !== item.title) {
        await onUpdateItem(item.id, { title: title.trim() });
      }
    },
    [onUpdateItem]
  );

  // Move item to different group
  const handleMoveToGroup = useCallback(
    async (item: ListItemDTO, newGroupKey: string) => {
      if (!currentGroupBy) return;

      const newValue = newGroupKey === '__ungrouped__' ? null : newGroupKey;
      await onUpdateItem(item.id, {
        fields: { ...item.fields, [currentGroupBy]: newValue },
      });
    },
    [currentGroupBy, onUpdateItem]
  );

  // Open editor dialog
  const handleOpenEditor = useCallback(
    (item: ListItemDTO) => {
      setEditingItem(item);
      editorDialog.onTrue();
    },
    [editorDialog]
  );

  // Close editor dialog
  const handleCloseEditor = useCallback(() => {
    setEditingItem(null);
    editorDialog.onFalse();
  }, [editorDialog]);

  // Save item from editor
  const handleSaveItem = useCallback(
    async (input: UpdateListItemInput) => {
      if (!editingItem) return;
      const result = await onUpdateItem(editingItem.id, input);
      if (result) {
        handleCloseEditor();
      }
    },
    [editingItem, onUpdateItem, handleCloseEditor]
  );

  // Delete item
  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      const success = await onDeleteItem(itemId);
      if (success) {
        handleCloseEditor();
      }
    },
    [onDeleteItem, handleCloseEditor]
  );

  // Get inline fields for display
  const inlineFields = useMemo(() => {
    const inlinePriority = ['quantity', 'unit', 'meal_slot', 'day_of_week'];
    return config.fields
      .filter((f) => !f.hidden && f.key !== currentGroupBy) // Exclude the group-by field
      .filter((f) => inlinePriority.includes(f.key) || f.width === 'sm' || f.width === 'md')
      .slice(0, 2);
  }, [config.fields, currentGroupBy]);

  return (
    <Box>
      {/* Header with Group-by selector */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <QuickAddInput
            onAdd={(title) => handleQuickAdd(title)}
            placeholder="Add an item..."
            disabled={loading}
          />
        </Box>

        {groupableFields.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Group by</InputLabel>
            <Select
              value={currentGroupBy ?? ''}
              label="Group by"
              onChange={(e) => handleGroupByChange(e.target.value)}
            >
              {groupableFields.map((field) => (
                <MenuItem key={field.key} value={field.key}>
                  {field.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Stack>

      {/* Empty state */}
      {items.length === 0 && !loading && (
        <EmptyContent
          title="No items yet"
          description="Type above to add your first item"
          sx={{ py: 5 }}
        />
      )}

      {/* Grouped sections */}
      {items.length > 0 && (
        <Stack spacing={1}>
          {groupedItems.map((group) => (
            <GroupSection
              key={group.key}
              groupKey={group.key}
              label={group.label}
              items={group.items}
              collapsed={collapsedGroups.has(group.key)}
              inlineFields={inlineFields}
              groupByField={groupByField}
              allGroups={groupedItems.map((g) => ({ key: g.key, label: g.label }))}
              onToggleCollapse={() => handleToggleCollapse(group.key)}
              onToggleStatus={handleToggleStatus}
              onUpdateTitle={handleUpdateTitle}
              onMoveToGroup={handleMoveToGroup}
              onOpenEditor={handleOpenEditor}
              onQuickAdd={(title) => handleQuickAdd(title, group.key)}
            />
          ))}
        </Stack>
      )}

      {/* Item Editor Dialog */}
      <ItemEditorDialog
        open={editorDialog.value}
        item={editingItem}
        fields={config.fields}
        onClose={handleCloseEditor}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
      />
    </Box>
  );
}
