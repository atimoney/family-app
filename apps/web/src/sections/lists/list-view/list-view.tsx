import type { ListConfig, ListItemDTO, FieldDefinition, CreateListItemInput, UpdateListItemInput } from '@family/shared';

import { useState, useCallback } from 'react';
import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { EmptyContent } from 'src/components/empty-content';

import { ListItemRow } from './list-item-row';
import { QuickAddInput } from './quick-add-input';
import { ItemEditorDialog } from '../item-editor-dialog';

// ----------------------------------------------------------------------

type ListViewProps = {
  listId: string;
  items: ListItemDTO[];
  config: ListConfig;
  loading?: boolean;
  onCreateItem: (input: CreateListItemInput) => Promise<ListItemDTO | null>;
  onUpdateItem: (itemId: string, input: UpdateListItemInput) => Promise<ListItemDTO | null>;
  onDeleteItem: (itemId: string) => Promise<boolean>;
};

export function ListView({
  listId,
  items,
  config,
  loading,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
}: ListViewProps) {
  // Item editor dialog state
  const editorDialog = useBoolean();
  const [editingItem, setEditingItem] = useState<ListItemDTO | null>(null);

  // Separate open and done items
  const openItems = items.filter((item) => item.status === 'open');
  const doneItems = items.filter((item) => item.status === 'done');

  // Get inline fields (non-hidden fields marked for inline display)
  const inlineFields = getInlineFields(config.fields);

  // Quick add handler
  const handleQuickAdd = useCallback(
    async (title: string) => {
      if (!title.trim()) return;
      
      // Create item with default field values
      const defaultFields: Record<string, unknown> = {};
      config.fields.forEach((field) => {
        if (field.defaultValue !== undefined) {
          defaultFields[field.key] = field.defaultValue;
        }
      });

      await onCreateItem({
        title: title.trim(),
        status: 'open',
        fields: defaultFields,
      });
    },
    [config.fields, onCreateItem]
  );

  // Toggle item status
  const handleToggleStatus = useCallback(
    async (item: ListItemDTO) => {
      const newStatus = item.status === 'done' ? 'open' : 'done';
      await onUpdateItem(item.id, { status: newStatus });
    },
    [onUpdateItem]
  );

  // Update item title inline
  const handleUpdateTitle = useCallback(
    async (item: ListItemDTO, title: string) => {
      if (title.trim() && title !== item.title) {
        await onUpdateItem(item.id, { title: title.trim() });
      }
    },
    [onUpdateItem]
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

  // Delete item from editor
  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      const success = await onDeleteItem(itemId);
      if (success) {
        handleCloseEditor();
      }
    },
    [onDeleteItem, handleCloseEditor]
  );

  return (
    <Box>
      {/* Quick Add Input */}
      <QuickAddInput
        onAdd={handleQuickAdd}
        placeholder="Add an item..."
        disabled={loading}
      />

      {/* Empty state */}
      {items.length === 0 && !loading && (
        <EmptyContent
          title="No items yet"
          description="Type above to add your first item"
          sx={{ py: 5 }}
        />
      )}

      {/* Open items */}
      {openItems.length > 0 && (
        <Stack spacing={0} sx={{ mt: 2 }}>
          {openItems.map((item) => (
            <ListItemRow
              key={item.id}
              item={item}
              inlineFields={inlineFields}
              onToggleStatus={() => handleToggleStatus(item)}
              onUpdateTitle={(title) => handleUpdateTitle(item, title)}
              onOpenEditor={() => handleOpenEditor(item)}
            />
          ))}
        </Stack>
      )}

      {/* Done items section */}
      {doneItems.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', mb: 1, display: 'block' }}
          >
            Completed ({doneItems.length})
          </Typography>
          <Stack spacing={0}>
            {doneItems.map((item) => (
              <ListItemRow
                key={item.id}
                item={item}
                inlineFields={inlineFields}
                onToggleStatus={() => handleToggleStatus(item)}
                onUpdateTitle={(title) => handleUpdateTitle(item, title)}
                onOpenEditor={() => handleOpenEditor(item)}
              />
            ))}
          </Stack>
        </>
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

// ----------------------------------------------------------------------

/**
 * Get fields that should be shown inline in the list view.
 * For shopping lists: quantity, unit
 * For meal plans: meal_slot, day_of_week
 * Only non-hidden fields with width 'sm' or 'md'
 */
function getInlineFields(fields: FieldDefinition[]): FieldDefinition[] {
  // Prioritize certain field keys for inline display
  const inlinePriority = ['quantity', 'unit', 'meal_slot', 'day_of_week', 'category'];
  
  return fields
    .filter((field) => {
      // Skip hidden fields
      if (field.hidden) return false;
      // Include fields with small/medium width or priority keys
      return (
        inlinePriority.includes(field.key) ||
        field.width === 'sm' ||
        field.width === 'md'
      );
    })
    .sort((a, b) => {
      // Sort by priority order
      const aIndex = inlinePriority.indexOf(a.key);
      const bIndex = inlinePriority.indexOf(b.key);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    })
    .slice(0, 3); // Max 3 inline fields
}
