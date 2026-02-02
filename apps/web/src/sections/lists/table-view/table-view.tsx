import type {
  ListDTO,
  ListConfig,
  ListItemDTO,
  FieldDefinition,
  CreateListItemInput,
  UpdateListItemInput,
} from '@family/shared';

import { useBoolean } from 'minimal-shared/hooks';
import { useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import TableSortLabel from '@mui/material/TableSortLabel';
import TableContainer from '@mui/material/TableContainer';

import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

import { TableViewRow } from './table-view-row';
import { ItemEditorDialog } from '../item-editor-dialog';
import { QuickAddInput } from '../list-view/quick-add-input';
import { ColumnChooserDialog } from './column-chooser-dialog';

// ----------------------------------------------------------------------

// Built-in columns that are always available
const BUILT_IN_COLUMNS = ['title', 'status'] as const;

type SortConfig = {
  field: string;
  direction: 'asc' | 'desc';
};

type TableViewProps = {
  list: ListDTO;
  items: ListItemDTO[];
  config: ListConfig;
  loading?: boolean;
  preferences: { sort?: SortConfig | null } | null;
  onCreateItem: (input: CreateListItemInput) => Promise<ListItemDTO | null>;
  onUpdateItem: (itemId: string, input: UpdateListItemInput) => Promise<ListItemDTO | null>;
  onDeleteItem: (itemId: string) => Promise<boolean>;
  onUpdateList: (listId: string, input: { config: ListConfig }) => Promise<ListDTO | null>;
  onUpdatePreferences: (input: { sort?: SortConfig | null }) => Promise<unknown>;
};

export function TableView({
  list,
  items,
  config,
  loading,
  preferences,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onUpdateList,
  onUpdatePreferences,
}: TableViewProps) {
  // Dialog states
  const editorDialog = useBoolean();
  const columnChooserDialog = useBoolean();
  const [editingItem, setEditingItem] = useState<ListItemDTO | null>(null);

  // Sort state (from preferences or default)
  const [sortConfig, setSortConfig] = useState<SortConfig>(() => 
    preferences?.sort ?? { field: 'title', direction: 'asc' }
  );

  // Get visible columns from config
  const visibleColumns = useMemo(() => {
    const tableConfig = config.views?.table;
    // Default: title + status + first 3 fields
    if (!tableConfig?.visibleColumns?.length) {
      return [...BUILT_IN_COLUMNS, ...config.fields.slice(0, 3).map((f) => f.key)];
    }
    return tableConfig.visibleColumns;
  }, [config]);

  // Build column definitions
  const columns = useMemo(() => {
    const cols: ColumnDef[] = [];

    // Add visible columns in order
    visibleColumns.forEach((key) => {
      if (key === 'title') {
        cols.push({
          key: 'title',
          label: 'Title',
          type: 'title',
          sortable: true,
          width: 'auto',
        });
      } else if (key === 'status') {
        cols.push({
          key: 'status',
          label: 'Status',
          type: 'status',
          sortable: true,
          width: 80,
        });
      } else {
        // Find field definition
        const field = config.fields.find((f) => f.key === key);
        if (field) {
          cols.push({
            key: field.key,
            label: field.label,
            type: field.type,
            field,
            sortable: ['text', 'number', 'date', 'select'].includes(field.type),
            width: getFieldWidth(field),
          });
        }
      }
    });

    return cols;
  }, [visibleColumns, config.fields]);

  // Sort items
  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const { field, direction } = sortConfig;
      let aVal: unknown;
      let bVal: unknown;

      if (field === 'title') {
        aVal = a.title;
        bVal = b.title;
      } else if (field === 'status') {
        aVal = a.status;
        bVal = b.status;
      } else {
        aVal = a.fields?.[field];
        bVal = b.fields?.[field];
      }

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return direction === 'asc' ? 1 : -1;
      if (bVal == null) return direction === 'asc' ? -1 : 1;

      // Compare based on type
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Default string comparison
      return direction === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    return sorted;
  }, [items, sortConfig]);

  // Handle sort change
  const handleSort = useCallback(
    async (field: string) => {
      const newDirection: 'asc' | 'desc' =
        sortConfig.field === field && sortConfig.direction === 'asc' ? 'desc' : 'asc';
      
      const newSort = { field, direction: newDirection };
      setSortConfig(newSort);
      
      // Persist to preferences
      await onUpdatePreferences({ sort: newSort });
    },
    [sortConfig, onUpdatePreferences]
  );

  // Quick add handler
  const handleQuickAdd = useCallback(
    async (title: string) => {
      if (!title.trim()) return;

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

  // Update item field inline
  const handleUpdateField = useCallback(
    async (item: ListItemDTO, fieldKey: string, value: unknown) => {
      if (fieldKey === 'title') {
        if (value && value !== item.title) {
          await onUpdateItem(item.id, { title: String(value).trim() });
        }
      } else {
        await onUpdateItem(item.id, {
          fields: { ...item.fields, [fieldKey]: value },
        });
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

  // Save column configuration
  const handleSaveColumns = useCallback(
    async (newVisibleColumns: string[]) => {
      const newConfig: ListConfig = {
        ...config,
        views: {
          ...config.views,
          table: {
            ...config.views?.table,
            visibleColumns: newVisibleColumns,
          },
        },
      };
      await onUpdateList(list.id, { config: newConfig });
      columnChooserDialog.onFalse();
    },
    [config, list.id, onUpdateList, columnChooserDialog]
  );

  return (
    <Box>
      {/* Header with Quick Add and Column Chooser */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <QuickAddInput
            onAdd={handleQuickAdd}
            placeholder="Add an item..."
            disabled={loading}
          />
        </Box>
        <Tooltip title="Choose columns">
          <IconButton onClick={columnChooserDialog.onTrue}>
            <Iconify icon={'solar:settings-bold' as any} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Empty state */}
      {items.length === 0 && !loading && (
        <EmptyContent
          title="No items yet"
          description="Type above to add your first item"
          sx={{ py: 5 }}
        />
      )}

      {/* Table */}
      {items.length > 0 && (
        <TableContainer sx={{ borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {/* Checkbox column */}
                <TableCell padding="checkbox" />

                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    sx={{ width: col.width }}
                    sortDirection={sortConfig.field === col.key ? sortConfig.direction : false}
                  >
                    {col.sortable ? (
                      <TableSortLabel
                        active={sortConfig.field === col.key}
                        direction={sortConfig.field === col.key ? sortConfig.direction : 'asc'}
                        onClick={() => handleSort(col.key)}
                      >
                        {col.label}
                      </TableSortLabel>
                    ) : (
                      col.label
                    )}
                  </TableCell>
                ))}

                {/* Actions column */}
                <TableCell sx={{ width: 48 }} />
              </TableRow>
            </TableHead>

            <TableBody>
              {sortedItems.map((item) => (
                <TableViewRow
                  key={item.id}
                  item={item}
                  columns={columns}
                  onToggleStatus={() => handleToggleStatus(item)}
                  onUpdateField={(fieldKey, value) => handleUpdateField(item, fieldKey, value)}
                  onOpenEditor={() => handleOpenEditor(item)}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
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

      {/* Column Chooser Dialog */}
      <ColumnChooserDialog
        open={columnChooserDialog.value}
        fields={config.fields}
        visibleColumns={visibleColumns}
        onClose={columnChooserDialog.onFalse}
        onSave={handleSaveColumns}
      />
    </Box>
  );
}

// ----------------------------------------------------------------------

export type ColumnDef = {
  key: string;
  label: string;
  type: string;
  field?: FieldDefinition;
  sortable?: boolean;
  width?: number | 'auto';
};

function getFieldWidth(field: FieldDefinition): number | 'auto' {
  if (field.width) {
    if (typeof field.width === 'number') return field.width;
    switch (field.width) {
      case 'sm':
        return 80;
      case 'md':
        return 120;
      case 'lg':
        return 180;
      default:
        return 'auto';
    }
  }

  // Default widths by type
  switch (field.type) {
    case 'checkbox':
      return 80;
    case 'number':
      return 100;
    case 'date':
      return 120;
    case 'datetime':
      return 160;
    case 'select':
      return 140;
    default:
      return 'auto';
  }
}
