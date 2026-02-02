import type { ListViewKey, ListTemplateKey } from '@family/shared';

import { useBoolean, usePopover } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { DashboardContent } from 'src/layouts/dashboard';
import {
  useList,
  useListMutations,
  useListPreferences,
  useListItemsOptimistic,
  useListPreferencesMutations,
} from 'src/features/lists';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';
import { LoadingScreen } from 'src/components/loading-screen';

import { ListView } from '../list-view';
import { WeekView } from '../week-view';
import { TableView } from '../table-view';
import { GroupedView } from '../grouped-view';

// ----------------------------------------------------------------------

type ListDetailViewProps = {
  listId: string;
};

// ----------------------------------------------------------------------

const VIEW_OPTIONS: { value: ListViewKey; label: string; icon: string }[] = [
  { value: 'list', label: 'List', icon: 'solar:list-bold' },
  { value: 'table', label: 'Table', icon: 'solar:widget-5-bold' },
  { value: 'grouped', label: 'Grouped', icon: 'solar:folder-2-bold' },
  { value: 'week', label: 'Week', icon: 'solar:calendar-bold' },
];

const getListIcon = (templateKey: ListTemplateKey) => {
  switch (templateKey) {
    case 'shopping':
      return 'solar:cart-large-2-bold-duotone';
    case 'meal_plan':
      return 'solar:chef-hat-bold-duotone';
    default:
      return 'solar:checklist-bold-duotone';
  }
};

const getTemplateLabel = (templateKey: ListTemplateKey) => {
  switch (templateKey) {
    case 'shopping':
      return 'Shopping';
    case 'meal_plan':
      return 'Meal Plan';
    default:
      return 'Custom';
  }
};

const getTemplateColor = (templateKey: ListTemplateKey): 'primary' | 'warning' | 'default' => {
  switch (templateKey) {
    case 'shopping':
      return 'primary';
    case 'meal_plan':
      return 'warning';
    default:
      return 'default';
  }
};

// ----------------------------------------------------------------------

export function ListDetailView({ listId }: ListDetailViewProps) {
  const router = useRouter();

  // Data fetching
  const { list, loading: listLoading, error: listError, refresh: refreshList } = useList(listId);
  const { preferences, refresh: refreshPreferences } = useListPreferences(listId);
  
  // Items with optimistic updates
  const {
    items,
    loading: itemsLoading,
    mutating: itemMutating,
    create: createItem,
    update: updateItem,
    remove: removeItem,
  } = useListItemsOptimistic(listId);

  // List mutations (non-optimistic)
  const { update: updateList, remove: removeList, loading: listMutating } = useListMutations(refreshList);
  const { upsert: upsertPreferences } = useListPreferencesMutations(refreshPreferences);

  // UI state
  const editNameDialog = useBoolean();
  const deleteDialog = useBoolean();
  const actionsPopover = usePopover<HTMLButtonElement>();

  const [editedName, setEditedName] = useState('');
  const [currentView, setCurrentView] = useState<ListViewKey | null>(null);

  // Determine enabled views from list config
  const enabledViews = useMemo(() => list?.config?.views?.enabled ?? ['list'], [list?.config?.views?.enabled]);
  const defaultView = list?.config?.views?.defaultView ?? 'list';

  // Initialize current view from preferences or default
  useEffect(() => {
    if (list && currentView === null) {
      const preferredView = preferences?.lastViewKey;
      // Use preferred view if it's enabled, otherwise use default
      if (preferredView && enabledViews.includes(preferredView)) {
        setCurrentView(preferredView);
      } else {
        setCurrentView(defaultView);
      }
    }
  }, [list, preferences, currentView, enabledViews, defaultView]);

  // Handle view change - persist to preferences
  const handleViewChange = useCallback(
    async (_: React.MouseEvent<HTMLElement>, newView: ListViewKey | null) => {
      if (newView && newView !== currentView) {
        setCurrentView(newView);
        // Persist preference
        await upsertPreferences(listId, { lastViewKey: newView });
      }
    },
    [currentView, listId, upsertPreferences]
  );

  // Handle name edit
  const handleOpenEditName = useCallback(() => {
    if (list) {
      setEditedName(list.name);
      editNameDialog.onTrue();
    }
  }, [list, editNameDialog]);

  const handleSaveName = useCallback(async () => {
    if (!editedName.trim() || !list) return;
    const result = await updateList(listId, { name: editedName.trim() });
    if (result) {
      toast.success('List renamed');
      editNameDialog.onFalse();
    }
  }, [editedName, list, listId, updateList, editNameDialog]);

  // Handle pin/hide actions
  const handleTogglePin = useCallback(async () => {
    if (!list) return;
    const newVisibility = list.navVisibility === 'pinned' ? 'visible' : 'pinned';
    const result = await updateList(listId, { navVisibility: newVisibility });
    if (result) {
      toast.success(newVisibility === 'pinned' ? 'List pinned' : 'List unpinned');
    }
    actionsPopover.onClose();
  }, [list, listId, updateList, actionsPopover]);

  const handleToggleHide = useCallback(async () => {
    if (!list) return;
    const newVisibility = list.navVisibility === 'hidden' ? 'visible' : 'hidden';
    const result = await updateList(listId, { navVisibility: newVisibility });
    if (result) {
      toast.success(newVisibility === 'hidden' ? 'List hidden from sidebar' : 'List shown in sidebar');
    }
    actionsPopover.onClose();
  }, [list, listId, updateList, actionsPopover]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    const success = await removeList(listId);
    if (success) {
      toast.success('List deleted');
      router.push(paths.lists.root);
    }
  }, [listId, removeList, router]);

  // Loading state
  if (listLoading) {
    return (
      <DashboardContent>
        <LoadingScreen />
      </DashboardContent>
    );
  }

  // Error state
  if (listError || !list) {
    return (
      <DashboardContent>
        <EmptyContent
          title="List not found"
          description={listError?.message || 'The list you are looking for does not exist.'}
          action={
            <Button variant="contained" onClick={() => router.push(paths.lists.root)}>
              Back to Lists
            </Button>
          }
        />
      </DashboardContent>
    );
  }

  const templateKey = list.templateKey as ListTemplateKey;
  const isPinned = list.navVisibility === 'pinned';
  const isHidden = list.navVisibility === 'hidden';

  return (
    <DashboardContent>
      <Stack spacing={3}>
        {/* Header */}
        <Stack spacing={2}>
          {/* Breadcrumb */}
          <Stack direction="row" alignItems="center" spacing={1}>
            <Button
              size="small"
              color="inherit"
              startIcon={<Iconify icon={'solar:arrow-left-bold' as any} />}
              onClick={() => router.push(paths.lists.root)}
              sx={{ mr: 1 }}
            >
              Lists
            </Button>
          </Stack>

          {/* Title row */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            spacing={2}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'background.neutral',
                  color: list.color || 'text.secondary',
                }}
              >
                <Iconify icon={getListIcon(templateKey) as any} width={28} />
              </Box>
              <Stack>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="h4">{list.name}</Typography>
                  <Tooltip title="Rename">
                    <IconButton size="small" onClick={handleOpenEditName}>
                      <Iconify icon={'solar:pen-bold' as any} width={18} />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Label variant="soft" color={getTemplateColor(templateKey)}>
                    {getTemplateLabel(templateKey)}
                  </Label>
                  {isPinned && (
                    <Iconify
                      icon={'solar:pin-bold' as any}
                      width={14}
                      sx={{ color: 'text.disabled' }}
                    />
                  )}
                </Stack>
              </Stack>
            </Stack>

            {/* Actions */}
            <Stack direction="row" alignItems="center" spacing={1}>
              {/* View Switcher */}
              <ToggleButtonGroup
                exclusive
                value={currentView}
                onChange={handleViewChange}
                size="small"
              >
                {VIEW_OPTIONS.filter((opt) => enabledViews.includes(opt.value)).map((opt) => (
                  <ToggleButton key={opt.value} value={opt.value}>
                    <Tooltip title={opt.label}>
                      <Box sx={{ display: 'flex' }}>
                        <Iconify icon={opt.icon as any} width={20} />
                      </Box>
                    </Tooltip>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>

              {/* More actions */}
              <IconButton onClick={actionsPopover.onOpen}>
                <Iconify icon={'solar:menu-dots-bold' as any} />
              </IconButton>
            </Stack>
          </Stack>
        </Stack>

        {/* View Content */}
        <Box sx={{ minHeight: 400 }}>
          {itemsLoading ? (
            <Box
              sx={{
                p: 4,
                borderRadius: 2,
                bgcolor: 'background.neutral',
                minHeight: 400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LoadingScreen />
            </Box>
          ) : currentView === 'list' ? (
            <ListView
              listId={listId}
              items={items}
              config={list.config}
              loading={itemMutating}
              onCreateItem={createItem}
              onUpdateItem={updateItem}
              onDeleteItem={removeItem}
            />
          ) : currentView === 'table' ? (
            <TableView
              list={list}
              items={items}
              config={list.config}
              loading={itemMutating}
              preferences={preferences}
              onCreateItem={createItem}
              onUpdateItem={updateItem}
              onDeleteItem={removeItem}
              onUpdateList={updateList}
              onUpdatePreferences={(input) => upsertPreferences(listId, input)}
            />
          ) : currentView === 'grouped' ? (
            <GroupedView
              listId={listId}
              items={items}
              config={list.config}
              loading={itemMutating}
              preferences={preferences}
              onCreateItem={createItem}
              onUpdateItem={updateItem}
              onDeleteItem={removeItem}
              onUpdatePreferences={(input) => upsertPreferences(listId, input)}
            />
          ) : currentView === 'week' ? (
            <WeekView
              list={list}
              templateKey={templateKey}
              items={items}
              config={list.config}
              loading={itemMutating}
              onCreateItem={createItem}
              onUpdateItem={updateItem}
              onDeleteItem={removeItem}
            />
          ) : (
            <Box
              sx={{
                p: 4,
                borderRadius: 2,
                bgcolor: 'background.neutral',
                minHeight: 400,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ViewPlaceholder
                view={currentView ?? 'list'}
                itemCount={items.length}
                onAddItem={() => {
                  toast.info('Add item from this view coming soon!');
                }}
              />
            </Box>
          )}
        </Box>
      </Stack>

      {/* Actions Popover */}
      <CustomPopover
        open={actionsPopover.open}
        anchorEl={actionsPopover.anchorEl}
        onClose={actionsPopover.onClose}
        slotProps={{ arrow: { placement: 'right-top' } }}
      >
        <MenuItem onClick={handleTogglePin}>
          <Iconify icon={(isPinned ? 'solar:pin-slash-bold' : 'solar:pin-bold') as any} />
          {isPinned ? 'Unpin' : 'Pin to sidebar'}
        </MenuItem>
        <MenuItem onClick={handleToggleHide}>
          <Iconify icon={(isHidden ? 'solar:eye-bold' : 'solar:eye-closed-bold') as any} />
          {isHidden ? 'Show in sidebar' : 'Hide from sidebar'}
        </MenuItem>
        <MenuItem onClick={handleOpenEditName}>
          <Iconify icon={'solar:pen-bold' as any} />
          Rename
        </MenuItem>
        <MenuItem onClick={deleteDialog.onTrue} sx={{ color: 'error.main' }}>
          <Iconify icon={'solar:trash-bin-trash-bold' as any} />
          Delete
        </MenuItem>
      </CustomPopover>

      {/* Rename Dialog */}
      <EditNameDialog
        open={editNameDialog.value}
        name={editedName}
        onChange={setEditedName}
        onClose={editNameDialog.onFalse}
        onSave={handleSaveName}
        loading={listMutating}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialog.value}
        onClose={deleteDialog.onFalse}
        title="Delete List"
        content={`Are you sure you want to delete "${list.name}"? This action cannot be undone.`}
        action={
          <Button variant="contained" color="error" onClick={handleDelete}>
            Delete
          </Button>
        }
      />
    </DashboardContent>
  );
}

// ----------------------------------------------------------------------

type ViewPlaceholderProps = {
  view: ListViewKey;
  itemCount: number;
  onAddItem: () => void;
};

function ViewPlaceholder({ view, itemCount, onAddItem }: ViewPlaceholderProps) {
  const viewConfig = VIEW_OPTIONS.find((opt) => opt.value === view);

  if (itemCount === 0) {
    return (
      <EmptyContent
        title="No items yet"
        description="Add items to get started"
        action={
          <Button
            variant="contained"
            startIcon={<Iconify icon={'solar:add-circle-bold' as any} />}
            onClick={onAddItem}
          >
            Add Item
          </Button>
        }
      />
    );
  }

  return (
    <Stack alignItems="center" spacing={2}>
      <Iconify icon={viewConfig?.icon as any} width={64} sx={{ color: 'text.disabled' }} />
      <Typography variant="h6" color="text.secondary">
        {viewConfig?.label} View
      </Typography>
      <Typography variant="body2" color="text.disabled">
        {itemCount} item{itemCount !== 1 ? 's' : ''} • View implementation coming soon
      </Typography>
      <Button
        variant="soft"
        startIcon={<Iconify icon={'solar:add-circle-bold' as any} />}
        onClick={onAddItem}
      >
        Add Item
      </Button>
    </Stack>
  );
}

// ----------------------------------------------------------------------

type EditNameDialogProps = {
  open: boolean;
  name: string;
  onChange: (name: string) => void;
  onClose: () => void;
  onSave: () => void;
  loading?: boolean;
};

function EditNameDialog({ open, name, onChange, onClose, onSave, loading }: EditNameDialogProps) {
  return (
    <CustomPopover
      open={open}
      onClose={onClose}
      anchorOrigin={{ vertical: 'center', horizontal: 'center' }}
      transformOrigin={{ vertical: 'center', horizontal: 'center' }}
      slotProps={{
        paper: {
          sx: { p: 2, width: 320 },
        },
      }}
    >
      <Stack spacing={2}>
        <Typography variant="subtitle1">Rename List</Typography>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="Name"
          value={name}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) {
              onSave();
            }
          }}
        />
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={onSave}
            disabled={!name.trim() || loading}
          >
            Save
          </Button>
        </Stack>
      </Stack>
    </CustomPopover>
  );
}
