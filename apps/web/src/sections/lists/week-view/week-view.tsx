import type {
  ListDTO,
  ListConfig,
  ListItemDTO,
  ListTemplateKey,
  CreateListItemInput,
  UpdateListItemInput,
} from '@family/shared';

import { useBoolean } from 'minimal-shared/hooks';
import { useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

import { WeekGrid } from './week-grid';
import { ItemEditorDialog } from '../item-editor-dialog';
import { GenerateShoppingDialog } from '../generate-shopping-dialog';

// ----------------------------------------------------------------------

type WeekViewProps = {
  list: ListDTO;
  templateKey: ListTemplateKey;
  items: ListItemDTO[];
  config: ListConfig;
  loading?: boolean;
  onCreateItem: (input: CreateListItemInput) => Promise<ListItemDTO | null>;
  onUpdateItem: (itemId: string, input: UpdateListItemInput) => Promise<ListItemDTO | null>;
  onDeleteItem: (itemId: string) => Promise<boolean>;
};

// Default meal slots if not configured
const DEFAULT_MEAL_SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export function WeekView({
  list,
  templateKey,
  items,
  config,
  loading,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
}: WeekViewProps) {
  // Dialog state
  const editorDialog = useBoolean();
  const shoppingDialog = useBoolean();
  const [editingItem, setEditingItem] = useState<ListItemDTO | null>(null);
  const [prefillData, setPrefillData] = useState<{ date: string; mealSlot: string } | null>(null);

  // Week navigation state
  const [weekOffset, setWeekOffset] = useState(0);

  // Get week config
  const weekConfig = config.views?.week;
  const mealSlots = weekConfig?.mealSlots ?? DEFAULT_MEAL_SLOTS;
  const weekStartsOn = weekConfig?.weekStartsOn ?? 1; // Default Monday

  // Calculate current week's dates
  const weekDates = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay();
    
    // Calculate start of current week
    const diff = currentDay - weekStartsOn;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - (diff < 0 ? diff + 7 : diff) + (weekOffset * 7));
    startOfWeek.setHours(0, 0, 0, 0);

    // Generate 7 days
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push(date);
    }

    return dates;
  }, [weekOffset, weekStartsOn]);

  // Format date for display
  const weekRangeLabel = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    
    if (start.getMonth() === end.getMonth()) {
      return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${end.getDate()}, ${end.getFullYear()}`;
    }
    
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${end.getFullYear()}`;
  }, [weekDates]);

  // Check if current week includes today
  const isCurrentWeek = useMemo(() => {
    const today = formatDateToString(new Date());
    return weekDates.some((d) => formatDateToString(d) === today);
  }, [weekDates]);

  // Group items by date and meal slot
  const itemsByDateAndSlot = useMemo(() => {
    const map = new Map<string, ListItemDTO[]>();

    items.forEach((item) => {
      const date = item.fields?.date as string | undefined;
      const slot = item.fields?.meal_slot as string | undefined;

      if (!date || !slot) return;

      // Normalize slot to lowercase for matching
      const key = `${date}|${slot.toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    });

    return map;
  }, [items]);

  // Navigation handlers
  const handlePrevWeek = useCallback(() => {
    setWeekOffset((prev) => prev - 1);
  }, []);

  const handleNextWeek = useCallback(() => {
    setWeekOffset((prev) => prev + 1);
  }, []);

  const handleToday = useCallback(() => {
    setWeekOffset(0);
  }, []);

  // Cell click handler - open add dialog with prefilled date/slot
  const handleCellClick = useCallback(
    (date: Date, mealSlot: string) => {
      setPrefillData({
        date: formatDateToString(date),
        mealSlot: mealSlot.toLowerCase(),
      });
      setEditingItem(null);
      editorDialog.onTrue();
    },
    [editorDialog]
  );

  // Item click handler - open edit dialog
  const handleItemClick = useCallback(
    (item: ListItemDTO) => {
      setPrefillData(null);
      setEditingItem(item);
      editorDialog.onTrue();
    },
    [editorDialog]
  );

  // Toggle item status
  const handleToggleStatus = useCallback(
    async (item: ListItemDTO) => {
      const newStatus = item.status === 'done' ? 'open' : 'done';
      await onUpdateItem(item.id, { status: newStatus });
    },
    [onUpdateItem]
  );

  // Close editor dialog
  const handleCloseEditor = useCallback(() => {
    setEditingItem(null);
    setPrefillData(null);
    editorDialog.onFalse();
  }, [editorDialog]);

  // Save item (create or update)
  const handleSaveItem = useCallback(
    async (input: UpdateListItemInput) => {
      if (editingItem) {
        // Update existing
        const result = await onUpdateItem(editingItem.id, input);
        if (result) {
          handleCloseEditor();
        }
      } else if (prefillData) {
        // Create new with prefilled data
        const createInput: CreateListItemInput = {
          title: input.title ?? '',
          status: 'open',
          fields: {
            ...input.fields,
            date: prefillData.date,
            meal_slot: prefillData.mealSlot,
          },
        };
        const result = await onCreateItem(createInput);
        if (result) {
          handleCloseEditor();
        }
      }
    },
    [editingItem, prefillData, onUpdateItem, onCreateItem, handleCloseEditor]
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

  // Check if this is a meal plan list
  if (templateKey !== 'meal_plan') {
    return (
      <EmptyContent
        title="Week view is only available for Meal Plans"
        description="This view is designed for planning meals throughout the week."
        imgUrl="/assets/icons/empty/ic-content.svg"
      />
    );
  }

  return (
    <Box>
      {/* Header with navigation */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton onClick={handlePrevWeek}>
            <Iconify icon={'solar:alt-arrow-left-bold' as any} />
          </IconButton>
          <IconButton onClick={handleNextWeek}>
            <Iconify icon={'solar:alt-arrow-right-bold' as any} />
          </IconButton>
          <Typography variant="h6" sx={{ minWidth: 200 }}>
            {weekRangeLabel}
          </Typography>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1}>
          <Button
            variant={isCurrentWeek ? 'contained' : 'outlined'}
            size="small"
            onClick={handleToday}
            disabled={isCurrentWeek}
          >
            Today
          </Button>

          <Tooltip title="Add meals to shopping list">
            <Button
              variant="outlined"
              size="small"
              onClick={shoppingDialog.onTrue}
              startIcon={<Iconify icon="solar:cart-plus-bold" />}
            >
              Add to Shopping List
            </Button>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Week Grid */}
      <WeekGrid
        dates={weekDates}
        mealSlots={mealSlots}
        itemsByDateAndSlot={itemsByDateAndSlot}
        onCellClick={handleCellClick}
        onItemClick={handleItemClick}
        onToggleStatus={handleToggleStatus}
      />

      {/* Item Editor Dialog */}
      <ItemEditorDialog
        open={editorDialog.value}
        item={editingItem}
        fields={config.fields}
        onClose={handleCloseEditor}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
        initialValues={
          prefillData
            ? {
                title: '',
                fields: {
                  date: prefillData.date,
                  meal_slot: prefillData.mealSlot,
                },
              }
            : undefined
        }
      />

      {/* Generate Shopping List Dialog */}
      <GenerateShoppingDialog
        open={shoppingDialog.value}
        onClose={shoppingDialog.onFalse}
        mealPlanList={list}
        weekStart={formatDateToString(weekDates[0])}
      />
    </Box>
  );
}

// ----------------------------------------------------------------------

/**
 * Format a Date to YYYY-MM-DD string in local timezone
 */
function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
