import type { ListDTO, ListTemplateKey, ListNavVisibility } from '@family/shared';

import { useMemo, useState, useCallback } from 'react';
import { useBoolean, usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import CardActionArea from '@mui/material/CardActionArea';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { DashboardContent } from 'src/layouts/dashboard';
import { useLists, useListMutations } from 'src/features/lists';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';
import { LoadingScreen } from 'src/components/loading-screen';

import { CreateListDialog } from '../create-list-dialog';

// ----------------------------------------------------------------------

type FilterTab = 'all' | 'pinned' | 'visible' | 'hidden';
type TemplateFilter = 'all' | ListTemplateKey;

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pinned', label: 'Pinned' },
  { value: 'visible', label: 'Visible' },
  { value: 'hidden', label: 'Hidden' },
];

const TEMPLATE_OPTIONS: { value: TemplateFilter; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'meal_plan', label: 'Meal Plan' },
  { value: 'custom', label: 'Custom' },
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

export function AllListsView() {
  const router = useRouter();
  const { lists, loading, error, refresh } = useLists();
  const { create, update, remove, loading: mutating } = useListMutations(refresh);

  // Dialogs
  const createDialog = useBoolean();
  const deleteDialog = useBoolean();
  const renameDialog = useBoolean();

  // Filters
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [templateFilter, setTemplateFilter] = useState<TemplateFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected list for actions
  const [selectedList, setSelectedList] = useState<ListDTO | null>(null);
  const [editedName, setEditedName] = useState('');

  // Action popover
  const actionPopover = usePopover<HTMLButtonElement>();

  // Filter lists
  const filteredLists = useMemo(() => {
    let result = lists;

    // Filter by visibility
    if (filterTab !== 'all') {
      result = result.filter((list) => list.navVisibility === filterTab);
    }

    // Filter by template
    if (templateFilter !== 'all') {
      result = result.filter((list) => list.templateKey === templateFilter);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((list) => list.name.toLowerCase().includes(query));
    }

    return result;
  }, [lists, filterTab, templateFilter, searchQuery]);

  // Count by visibility for tab badges
  const counts = useMemo(
    () => ({
      all: lists.length,
      pinned: lists.filter((l) => l.navVisibility === 'pinned').length,
      visible: lists.filter((l) => l.navVisibility === 'visible').length,
      hidden: lists.filter((l) => l.navVisibility === 'hidden').length,
    }),
    [lists]
  );

  // Handlers
  const handleListClick = useCallback(
    (listId: string) => {
      router.push(paths.lists.view(listId));
    },
    [router]
  );

  const handleCreateList = useCallback(
    async (name: string, templateKey: ListTemplateKey) => {
      const list = await create({ name, templateKey });
      if (list) {
        toast.success('List created');
        createDialog.onFalse();
        router.push(paths.lists.view(list.id));
      } else {
        toast.error('Failed to create list');
      }
    },
    [create, createDialog, router]
  );

  const handleOpenActions = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>, list: ListDTO) => {
      event.stopPropagation();
      setSelectedList(list);
      actionPopover.onOpen(event);
    },
    [actionPopover]
  );

  const handleTogglePin = useCallback(async () => {
    if (!selectedList) return;
    const newVisibility: ListNavVisibility =
      selectedList.navVisibility === 'pinned' ? 'visible' : 'pinned';
    const result = await update(selectedList.id, { navVisibility: newVisibility });
    if (result) {
      toast.success(newVisibility === 'pinned' ? 'List pinned' : 'List unpinned');
    }
    actionPopover.onClose();
  }, [selectedList, update, actionPopover]);

  const handleToggleHide = useCallback(async () => {
    if (!selectedList) return;
    const newVisibility: ListNavVisibility =
      selectedList.navVisibility === 'hidden' ? 'visible' : 'hidden';
    const result = await update(selectedList.id, { navVisibility: newVisibility });
    if (result) {
      toast.success(newVisibility === 'hidden' ? 'List hidden' : 'List visible');
    }
    actionPopover.onClose();
  }, [selectedList, update, actionPopover]);

  const handleOpenRename = useCallback(() => {
    if (selectedList) {
      setEditedName(selectedList.name);
      renameDialog.onTrue();
    }
    actionPopover.onClose();
  }, [selectedList, renameDialog, actionPopover]);

  const handleRename = useCallback(async () => {
    if (!selectedList || !editedName.trim()) return;
    const result = await update(selectedList.id, { name: editedName.trim() });
    if (result) {
      toast.success('List renamed');
      renameDialog.onFalse();
      setSelectedList(null);
    }
  }, [selectedList, editedName, update, renameDialog]);

  const handleOpenDelete = useCallback(() => {
    actionPopover.onClose();
    deleteDialog.onTrue();
  }, [actionPopover, deleteDialog]);

  const handleDelete = useCallback(async () => {
    if (!selectedList) return;
    const success = await remove(selectedList.id);
    if (success) {
      toast.success('List deleted');
      deleteDialog.onFalse();
      setSelectedList(null);
    }
  }, [selectedList, remove, deleteDialog]);

  // Loading state
  if (loading) {
    return (
      <DashboardContent>
        <LoadingScreen />
      </DashboardContent>
    );
  }

  // Error state
  if (error) {
    return (
      <DashboardContent>
        <EmptyContent
          title="Error loading lists"
          description={error.message}
          action={
            <Button variant="contained" onClick={refresh}>
              Retry
            </Button>
          }
        />
      </DashboardContent>
    );
  }

  return (
    <DashboardContent>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h4">All Lists</Typography>
          <Button
            variant="contained"
            startIcon={<Iconify icon="solar:add-circle-bold" />}
            onClick={createDialog.onTrue}
          >
            New List
          </Button>
        </Stack>

        {/* Filters */}
        <Card sx={{ p: 2 }}>
          <Stack spacing={2}>
            {/* Tabs for visibility */}
            <Tabs
              value={filterTab}
              onChange={(_, value) => setFilterTab(value)}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              {FILTER_TABS.map((tab) => (
                <Tab
                  key={tab.value}
                  value={tab.value}
                  label={
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <span>{tab.label}</span>
                      <Chip
                        size="small"
                        label={counts[tab.value]}
                        color={filterTab === tab.value ? 'primary' : 'default'}
                        sx={{ height: 20, minWidth: 20 }}
                      />
                    </Stack>
                  }
                />
              ))}
            </Tabs>

            {/* Search and template filter */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                size="small"
                placeholder="Search lists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Iconify icon={'solar:magnifer-bold' as any} width={20} />
                      </InputAdornment>
                    ),
                    endAdornment: searchQuery && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setSearchQuery('')}>
                          <Iconify icon={'solar:close-circle-bold' as any} width={18} />
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ minWidth: 240 }}
              />

              <TextField
                select
                size="small"
                value={templateFilter}
                onChange={(e) => setTemplateFilter(e.target.value as TemplateFilter)}
                sx={{ minWidth: 140 }}
              >
                {TEMPLATE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </Stack>
        </Card>

        {/* Empty state */}
        {lists.length === 0 ? (
          <EmptyContent
            title="No lists yet"
            description="Create your first list to get started"
            action={
              <Button
                variant="contained"
                startIcon={<Iconify icon="solar:add-circle-bold" />}
                onClick={createDialog.onTrue}
              >
                Create List
              </Button>
            }
          />
        ) : filteredLists.length === 0 ? (
          <EmptyContent
            title="No lists found"
            description="Try adjusting your filters or search query"
            action={
              <Button
                variant="outlined"
                onClick={() => {
                  setFilterTab('all');
                  setTemplateFilter('all');
                  setSearchQuery('');
                }}
              >
                Clear Filters
              </Button>
            }
          />
        ) : (
          <Grid container spacing={2}>
            {filteredLists.map((list) => (
              <Grid key={list.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <ListCard
                  list={list}
                  onClick={() => handleListClick(list.id)}
                  onOpenActions={(e) => handleOpenActions(e, list)}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Stack>

      {/* Create List Dialog */}
      <CreateListDialog
        open={createDialog.value}
        onClose={createDialog.onFalse}
        onSubmit={handleCreateList}
        loading={mutating}
      />

      {/* Actions Popover */}
      <CustomPopover
        open={actionPopover.open}
        anchorEl={actionPopover.anchorEl}
        onClose={actionPopover.onClose}
        slotProps={{ arrow: { placement: 'right-top' } }}
      >
        {selectedList && (
          <>
            <MenuItem onClick={handleTogglePin}>
              <Iconify
                icon={
                  (selectedList.navVisibility === 'pinned'
                    ? 'solar:pin-slash-bold'
                    : 'solar:pin-bold') as any
                }
              />
              {selectedList.navVisibility === 'pinned' ? 'Unpin' : 'Pin to sidebar'}
            </MenuItem>
            <MenuItem onClick={handleToggleHide}>
              <Iconify
                icon={
                  (selectedList.navVisibility === 'hidden'
                    ? 'solar:eye-bold'
                    : 'solar:eye-closed-bold') as any
                }
              />
              {selectedList.navVisibility === 'hidden' ? 'Show in sidebar' : 'Hide from sidebar'}
            </MenuItem>
            <MenuItem onClick={handleOpenRename}>
              <Iconify icon="solar:pen-bold" />
              Rename
            </MenuItem>
            <Divider sx={{ borderStyle: 'dashed' }} />
            <MenuItem onClick={handleOpenDelete} sx={{ color: 'error.main' }}>
              <Iconify icon="solar:trash-bin-trash-bold" />
              Delete
            </MenuItem>
          </>
        )}
      </CustomPopover>

      {/* Rename Dialog */}
      <CustomPopover
        open={renameDialog.value}
        onClose={renameDialog.onFalse}
        anchorOrigin={{ vertical: 'center', horizontal: 'center' }}
        transformOrigin={{ vertical: 'center', horizontal: 'center' }}
        slotProps={{ paper: { sx: { p: 2, width: 320 } } }}
      >
        <Stack spacing={2}>
          <Typography variant="subtitle1">Rename List</Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Name"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && editedName.trim()) {
                handleRename();
              }
            }}
          />
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" onClick={renameDialog.onFalse} disabled={mutating}>
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleRename}
              disabled={!editedName.trim() || mutating}
            >
              Save
            </Button>
          </Stack>
        </Stack>
      </CustomPopover>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialog.value}
        onClose={deleteDialog.onFalse}
        title="Delete List"
        content={`Are you sure you want to delete "${selectedList?.name}"? This action cannot be undone.`}
        action={
          <Button variant="contained" color="error" onClick={handleDelete} disabled={mutating}>
            Delete
          </Button>
        }
      />
    </DashboardContent>
  );
}

// ----------------------------------------------------------------------

type ListCardProps = {
  list: ListDTO;
  onClick: () => void;
  onOpenActions: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

function ListCard({ list, onClick, onOpenActions }: ListCardProps) {
  const templateKey = list.templateKey as ListTemplateKey;
  const isPinned = list.navVisibility === 'pinned';
  const isHidden = list.navVisibility === 'hidden';

  return (
    <Card sx={{ position: 'relative' }}>
      <CardActionArea onClick={onClick} sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="flex-start" spacing={1.5}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.neutral',
                color: list.color || 'text.secondary',
                flexShrink: 0,
              }}
            >
              <Iconify icon={getListIcon(templateKey) as any} width={24} />
            </Box>
            <Stack sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" noWrap>
                {list.name}
              </Typography>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                <Label variant="soft" color={getTemplateColor(templateKey)}>
                  {getTemplateLabel(templateKey)}
                </Label>
                {isPinned && (
                  <Iconify icon={'solar:pin-bold' as any} width={14} sx={{ color: 'info.main' }} />
                )}
                {isHidden && (
                  <Iconify icon={'solar:eye-closed-bold' as any} width={14} sx={{ color: 'text.disabled' }} />
                )}
              </Stack>
            </Stack>
          </Stack>
        </Stack>
      </CardActionArea>

      {/* Actions button */}
      <IconButton
        size="small"
        onClick={onOpenActions}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          bgcolor: 'background.paper',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Iconify icon={'solar:menu-dots-bold' as any} width={16} />
      </IconButton>
    </Card>
  );
}
