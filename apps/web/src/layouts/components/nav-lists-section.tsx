import type { ListDTO, ListTemplateKey } from '@family/shared';

import { useState, useCallback } from 'react';
import { useBoolean, usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import ButtonBase from '@mui/material/ButtonBase';
import FormControl from '@mui/material/FormControl';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useLists, useListMutations } from 'src/features/lists';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';

// ----------------------------------------------------------------------

const TEMPLATE_OPTIONS: { value: ListTemplateKey; label: string; icon: string }[] = [
  { value: 'shopping', label: 'Shopping List', icon: 'solar:cart-large-2-bold-duotone' },
  { value: 'meal_plan', label: 'Meal Plan', icon: 'solar:chef-hat-bold-duotone' },
  { value: 'custom', label: 'Custom List', icon: 'solar:checklist-bold-duotone' },
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

// ----------------------------------------------------------------------

export function NavListsSection() {
  const router = useRouter();
  const { lists, loading, refresh } = useLists();
  const { create, update, remove, loading: mutating } = useListMutations(refresh);

  // Dialog states
  const createDialog = useBoolean();
  const renameDialog = useBoolean();
  const deleteDialog = useBoolean();

  // Form state
  const [newListName, setNewListName] = useState('');
  const [newListTemplate, setNewListTemplate] = useState<ListTemplateKey>('custom');
  const [selectedList, setSelectedList] = useState<ListDTO | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Filter lists by visibility
  const pinnedLists = lists.filter((l) => l.navVisibility === 'pinned');
  const visibleLists = lists.filter((l) => l.navVisibility === 'visible');
  const displayedLists = [...pinnedLists, ...visibleLists];

  // Handlers
  const handleCreateList = useCallback(async () => {
    if (!newListName.trim()) return;

    const list = await create({
      name: newListName.trim(),
      templateKey: newListTemplate,
      navVisibility: 'visible',
    });

    if (list) {
      toast.success('List created');
      createDialog.onFalse();
      setNewListName('');
      setNewListTemplate('custom');
      router.push(paths.lists.view(list.id));
    }
  }, [newListName, newListTemplate, create, createDialog, router]);

  const handleTogglePin = useCallback(
    async (list: ListDTO) => {
      const newVisibility = list.navVisibility === 'pinned' ? 'visible' : 'pinned';
      const result = await update(list.id, { navVisibility: newVisibility });
      if (result) {
        toast.success(newVisibility === 'pinned' ? 'List pinned' : 'List unpinned');
      }
    },
    [update]
  );

  const handleHideList = useCallback(
    async (list: ListDTO) => {
      const result = await update(list.id, { navVisibility: 'hidden' });
      if (result) {
        toast.success('List hidden from sidebar');
      }
    },
    [update]
  );

  const handleOpenRename = useCallback(
    (list: ListDTO) => {
      setSelectedList(list);
      setRenameValue(list.name);
      renameDialog.onTrue();
    },
    [renameDialog]
  );

  const handleRename = useCallback(async () => {
    if (!selectedList || !renameValue.trim()) return;

    const result = await update(selectedList.id, { name: renameValue.trim() });
    if (result) {
      toast.success('List renamed');
      renameDialog.onFalse();
      setSelectedList(null);
      setRenameValue('');
    }
  }, [selectedList, renameValue, update, renameDialog]);

  const handleOpenDelete = useCallback(
    (list: ListDTO) => {
      setSelectedList(list);
      deleteDialog.onTrue();
    },
    [deleteDialog]
  );

  const handleDelete = useCallback(async () => {
    if (!selectedList) return;

    const success = await remove(selectedList.id);
    if (success) {
      toast.success('List deleted');
      deleteDialog.onFalse();
      setSelectedList(null);
    }
  }, [selectedList, remove, deleteDialog]);

  const handleNavigate = useCallback(
    (listId: string) => {
      router.push(paths.lists.view(listId));
    },
    [router]
  );

  return (
    <>
      {/* Section Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pl: 3.5,
          pr: 2,
          pt: 2,
          pb: 1,
        }}
      >
        <Typography
          component="div"
          sx={{
            fontSize: (theme) => theme.typography.pxToRem(11),
            fontWeight: 700,
            lineHeight: '18px',
            letterSpacing: '0.55px',
            textTransform: 'uppercase',
            color: 'var(--nav-subheader-color)',
          }}
        >
          Lists
        </Typography>
        <IconButton
          size="small"
          onClick={createDialog.onTrue}
          sx={{ color: 'var(--nav-subheader-color)' }}
        >
          <Iconify icon="mingcute:add-line" width={18} />
        </IconButton>
      </Box>

      {/* Lists */}
      <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, px: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={20} />
          </Box>
        ) : displayedLists.length === 0 ? (
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}
          >
            No lists yet
          </Typography>
        ) : (
          displayedLists.map((list) => (
            <NavListItem
              key={list.id}
              list={list}
              onNavigate={handleNavigate}
              onTogglePin={handleTogglePin}
              onHide={handleHideList}
              onRename={handleOpenRename}
              onDelete={handleOpenDelete}
            />
          ))
        )}

        {/* View All Lists link */}
        <Box component="li" sx={{ mt: 1 }}>
          <ButtonBase
            onClick={() => router.push(paths.lists.root)}
            sx={{
              width: '100%',
              borderRadius: 1,
              px: 1.5,
              py: 0.75,
              justifyContent: 'flex-start',
              color: 'text.secondary',
              fontSize: '0.8125rem',
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            <Iconify icon={'solar:folder-2-bold' as any} width={18} sx={{ mr: 1.5, opacity: 0.6 }} />
            View all lists
            {lists.filter((l) => l.navVisibility === 'hidden').length > 0 && (
              <Typography
                component="span"
                variant="caption"
                sx={{ ml: 'auto', color: 'text.disabled' }}
              >
                +{lists.filter((l) => l.navVisibility === 'hidden').length} hidden
              </Typography>
            )}
          </ButtonBase>
        </Box>
      </Box>

      {/* Create List Dialog */}
      <Dialog
        open={createDialog.value}
        onClose={createDialog.onFalse}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Create New List</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="List Name"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            sx={{ mt: 2 }}
          />
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Template</InputLabel>
            <Select
              value={newListTemplate}
              label="Template"
              onChange={(e) => setNewListTemplate(e.target.value as ListTemplateKey)}
            >
              {TEMPLATE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Iconify icon={opt.icon as any} width={20} />
                    {opt.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={createDialog.onFalse} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleCreateList}
            variant="contained"
            disabled={!newListName.trim() || mutating}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog
        open={renameDialog.value}
        onClose={renameDialog.onFalse}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Rename List</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="List Name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={renameDialog.onFalse} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleRename}
            variant="contained"
            disabled={!renameValue.trim() || mutating}
          >
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={deleteDialog.value}
        onClose={deleteDialog.onFalse}
        title="Delete List"
        content={
          <>
            Are you sure you want to delete <strong>{selectedList?.name}</strong>? This will
            permanently delete all items in this list.
          </>
        }
        action={
          <Button variant="contained" color="error" onClick={handleDelete} disabled={mutating}>
            Delete
          </Button>
        }
      />
    </>
  );
}

// ----------------------------------------------------------------------

type NavListItemProps = {
  list: ListDTO;
  onNavigate: (listId: string) => void;
  onTogglePin: (list: ListDTO) => void;
  onHide: (list: ListDTO) => void;
  onRename: (list: ListDTO) => void;
  onDelete: (list: ListDTO) => void;
};

function NavListItem({
  list,
  onNavigate,
  onTogglePin,
  onHide,
  onRename,
  onDelete,
}: NavListItemProps) {
  const popover = usePopover();

  const isPinned = list.navVisibility === 'pinned';

  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        alignItems: 'center',
        borderRadius: 1,
        mb: 0.5,
        '&:hover': {
          bgcolor: 'action.hover',
        },
        '&:hover .more-button': {
          opacity: 1,
        },
      }}
    >
      <ButtonBase
        onClick={() => onNavigate(list.id)}
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          py: 0.75,
          px: 1.5,
          borderRadius: 1,
          justifyContent: 'flex-start',
          textAlign: 'left',
          minHeight: 36,
        }}
      >
        <Iconify
          icon={getListIcon(list.templateKey as ListTemplateKey) as any}
          width={20}
          sx={{ color: list.color || 'text.secondary', flexShrink: 0 }}
        />
        <ListItemText
          primary={list.name}
          primaryTypographyProps={{
            variant: 'body2',
            noWrap: true,
            sx: { color: 'var(--nav-item-color)', fontWeight: 500 },
          }}
        />
        {isPinned && (
          <Iconify
            icon={'solar:pin-bold' as any}
            width={14}
            sx={{ color: 'text.disabled', flexShrink: 0 }}
          />
        )}
      </ButtonBase>

      <IconButton
        className="more-button"
        size="small"
        onClick={popover.onOpen}
        sx={{
          mr: 0.5,
          opacity: 0,
          transition: 'opacity 0.2s',
        }}
      >
        <Iconify icon="eva:more-vertical-fill" width={16} />
      </IconButton>

      <CustomPopover open={popover.open} anchorEl={popover.anchorEl} onClose={popover.onClose}>
        <MenuItem
          onClick={() => {
            onTogglePin(list);
            popover.onClose();
          }}
        >
          <Iconify icon={(isPinned ? 'solar:pin-slash-bold' : 'solar:pin-bold') as any} />
          {isPinned ? 'Unpin' : 'Pin to top'}
        </MenuItem>
        <MenuItem
          onClick={() => {
            onHide(list);
            popover.onClose();
          }}
        >
          <Iconify icon={'solar:eye-closed-bold' as any} />
          Hide from sidebar
        </MenuItem>
        <MenuItem
          onClick={() => {
            onRename(list);
            popover.onClose();
          }}
        >
          <Iconify icon={'solar:pen-bold' as any} />
          Rename
        </MenuItem>
        <MenuItem
          onClick={() => {
            onDelete(list);
            popover.onClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <Iconify icon={'solar:trash-bin-trash-bold' as any} />
          Delete
        </MenuItem>
      </CustomPopover>
    </Box>
  );
}
