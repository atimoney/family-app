import type { EventCategoryConfig, CreateCategoryInput, UpdateCategoryInput } from '@family/shared';

import { varAlpha } from 'minimal-shared/utils';
import { useBoolean } from 'minimal-shared/hooks';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import ListItem from '@mui/material/ListItem';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';

import { useFamily } from 'src/features/family';
import { useEventCategories } from 'src/features/calendar/hooks/use-event-categories';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

// ----------------------------------------------------------------------

// Popular icons for category picker
const POPULAR_ICONS = [
  'solar:cup-star-bold',
  'custom:fast-food-fill',
  'mdi:school',
  'solar:dumbbell-large-minimalistic-bold',
  'mdi:broom',
  'solar:calendar-date-bold',
  'mdi:briefcase',
  'mdi:airplane',
  'mdi:home',
  'solar:file-text-bold',
  'mdi:basketball',
  'mdi:football',
  'mdi:soccer',
  'mdi:swim',
  'mdi:bike',
  'mdi:run',
  'mdi:car',
  'mdi:bus',
  'mdi:train',
  'mdi:hospital-building',
  'mdi:tooth',
  'mdi:eye',
  'mdi:pill',
  'mdi:dog',
  'mdi:cat',
  'mdi:party-popper',
  'mdi:cake',
  'mdi:gift',
  'mdi:music',
  'mdi:movie',
  'mdi:book',
  'mdi:palette',
  'mdi:camera',
  'mdi:shopping',
  'mdi:cart',
  'mdi:cash',
  'mdi:bank',
  'mdi:phone',
  'mdi:email',
  'mdi:web',
];

// ----------------------------------------------------------------------

type CategoryFormData = {
  name: string;
  label: string;
  icon: string;
  color: string;
};

const defaultFormData: CategoryFormData = {
  name: '',
  label: '',
  icon: 'mdi:tag',
  color: '',
};

// ----------------------------------------------------------------------

export function SettingsCategories() {
  const { family, loading: familyLoading } = useFamily();
  const familyId = family?.id ?? null;
  
  const {
    categories,
    loading: categoriesLoading,
    error,
    create,
    update,
    remove,
  } = useEventCategories(familyId);

  // Dialog states
  const addDialog = useBoolean();
  const editDialog = useBoolean();
  const deleteDialog = useBoolean();
  const iconPickerDialog = useBoolean();

  // Form state
  const [formData, setFormData] = useState<CategoryFormData>(defaultFormData);
  const [editingCategory, setEditingCategory] = useState<EventCategoryConfig | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<EventCategoryConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [iconSearch, setIconSearch] = useState('');

  // User's role
  const myRole = family?.myMembership?.role;
  const isAdmin = myRole === 'admin' || myRole === 'owner';

  // Reset form on dialog close
  useEffect(() => {
    if (!addDialog.value && !editDialog.value) {
      setFormData(defaultFormData);
      setEditingCategory(null);
      setIconSearch('');
    }
  }, [addDialog.value, editDialog.value]);

  // Generate name from label
  const generateName = useCallback(
    (label: string): string =>
      label
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 50),
    []
  );

  // Handle form field changes
  const handleFieldChange = useCallback((field: keyof CategoryFormData, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-generate name from label for new categories
      if (field === 'label' && !editingCategory) {
        updated.name = generateName(value);
      }
      return updated;
    });
  }, [editingCategory, generateName]);

  // Open add dialog
  const handleOpenAdd = useCallback(() => {
    setFormData(defaultFormData);
    setEditingCategory(null);
    addDialog.onTrue();
  }, [addDialog]);

  // Open edit dialog
  const handleOpenEdit = useCallback((category: EventCategoryConfig) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      label: category.label,
      icon: category.icon,
      color: category.color || '',
    });
    editDialog.onTrue();
  }, [editDialog]);

  // Open delete confirmation
  const handleOpenDelete = useCallback((category: EventCategoryConfig) => {
    setDeletingCategory(category);
    deleteDialog.onTrue();
  }, [deleteDialog]);

  // Select icon
  const handleSelectIcon = useCallback((icon: string) => {
    handleFieldChange('icon', icon);
    iconPickerDialog.onFalse();
  }, [handleFieldChange, iconPickerDialog]);

  // Create category
  const handleCreate = useCallback(async () => {
    if (!formData.name || !formData.label || !formData.icon) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    const input: CreateCategoryInput = {
      name: formData.name,
      label: formData.label,
      icon: formData.icon,
      color: formData.color || null,
    };

    const result = await create(input);
    setSubmitting(false);

    if (result) {
      toast.success(`Category "${formData.label}" created`);
      addDialog.onFalse();
    } else {
      toast.error('Failed to create category. It may already exist.');
    }
  }, [formData, create, addDialog]);

  // Update category
  const handleUpdate = useCallback(async () => {
    if (!editingCategory || !formData.label || !formData.icon) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    const input: UpdateCategoryInput = {
      label: formData.label,
      icon: formData.icon,
      color: formData.color || null,
    };

    const result = await update(editingCategory.id, input);
    setSubmitting(false);

    if (result) {
      toast.success(`Category "${formData.label}" updated`);
      editDialog.onFalse();
    } else {
      toast.error('Failed to update category');
    }
  }, [editingCategory, formData, update, editDialog]);

  // Delete category
  const handleDelete = useCallback(async () => {
    if (!deletingCategory) return;

    setSubmitting(true);
    const success = await remove(deletingCategory.id);
    setSubmitting(false);

    if (success) {
      toast.success(`Category "${deletingCategory.label}" deleted`);
      deleteDialog.onFalse();
      setDeletingCategory(null);
    } else {
      toast.error('Failed to delete category. It may be in use by existing events.');
    }
  }, [deletingCategory, remove, deleteDialog]);

  // Filter icons for search
  const filteredIcons = iconSearch
    ? POPULAR_ICONS.filter((icon) => icon.toLowerCase().includes(iconSearch.toLowerCase()))
    : POPULAR_ICONS;

  // Loading state
  if (familyLoading || categoriesLoading) {
    return (
      <Card>
        <CardHeader title="Event Categories" />
        <CardContent>
          <Stack spacing={2}>
            <Skeleton variant="rectangular" height={60} />
            <Skeleton variant="rectangular" height={40} />
            <Skeleton variant="rectangular" height={40} />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  // No family state
  if (!family) {
    return (
      <Card>
        <CardHeader 
          title="Event Categories" 
          subheader="Create or join a family to customize event categories" 
        />
        <CardContent>
          <Box
            sx={[
              (theme) => ({
                p: 4,
                textAlign: 'center',
                borderRadius: 2,
                bgcolor: varAlpha(theme.vars.palette.grey['500Channel'], 0.04),
                border: `1px dashed ${varAlpha(theme.vars.palette.grey['500Channel'], 0.2)}`,
              }),
            ]}
          >
            <Iconify 
              icon={"solar:tag-bold-duotone" as any}
              width={64} 
              sx={{ mb: 2, color: 'text.secondary' }} 
            />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Join a family to manage event categories.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Main content
  return (
    <>
      <Card>
        <CardHeader
          title="Event Categories"
          subheader="Customize categories for your family's calendar events"
          action={
            isAdmin && (
              <Button
                variant="contained"
                size="small"
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={handleOpenAdd}
              >
                Add Category
              </Button>
            )
          }
        />
        <CardContent>
          {error && (
            <Box sx={{ mb: 2 }}>
              <Label color="error">Failed to load categories</Label>
            </Box>
          )}

          {categories.length === 0 ? (
            <Box
              sx={[
                (theme) => ({
                  p: 4,
                  textAlign: 'center',
                  borderRadius: 2,
                  bgcolor: varAlpha(theme.vars.palette.grey['500Channel'], 0.04),
                  border: `1px dashed ${varAlpha(theme.vars.palette.grey['500Channel'], 0.2)}`,
                }),
              ]}
            >
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No categories yet. Add your first category to organize events.
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {categories.map((category, index) => (
                <ListItem
                  key={category.id}
                  divider={index < categories.length - 1}
                  sx={{ px: 0 }}
                >
                  <ListItemIcon sx={{ minWidth: 48 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 1,
                        bgcolor: category.color 
                          ? `${category.color}20` 
                          : 'action.hover',
                        color: category.color || 'text.primary',
                      }}
                    >
                      <Iconify icon={category.icon as any} width={24} />
                    </Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="subtitle2">{category.label}</Typography>
                        {category.isSystem && (
                          <Chip label="System" size="small" variant="outlined" />
                        )}
                      </Stack>
                    }
                    secondary={category.name}
                  />
                  <ListItemSecondaryAction>
                    <Stack direction="row" spacing={0.5}>
                      {isAdmin && (
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEdit(category)}
                        >
                          <Iconify icon="solar:pen-bold" width={18} />
                        </IconButton>
                      )}
                      {isAdmin && !category.isSystem && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleOpenDelete(category)}
                        >
                          <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                        </IconButton>
                      )}
                    </Stack>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Add Category Dialog */}
      <Dialog open={addDialog.value} onClose={addDialog.onFalse} maxWidth="xs" fullWidth>
        <DialogTitle>Add Category</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              autoFocus
              fullWidth
              label="Label"
              placeholder="e.g., Piano Lesson"
              value={formData.label}
              onChange={(e) => handleFieldChange('label', e.target.value)}
              helperText="Display name for the category"
            />
            <TextField
              fullWidth
              label="Name (ID)"
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              helperText="Lowercase identifier (auto-generated from label)"
              slotProps={{
                input: {
                  sx: { fontFamily: 'monospace' },
                },
              }}
            />
            <TextField
              fullWidth
              label="Icon"
              value={formData.icon}
              onChange={(e) => handleFieldChange('icon', e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Iconify icon={(formData.icon || 'mdi:tag') as any} width={24} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button size="small" onClick={iconPickerDialog.onTrue}>
                        Browse
                      </Button>
                    </InputAdornment>
                  ),
                },
              }}
              helperText="Iconify icon name"
            />
            <TextField
              fullWidth
              label="Color (optional)"
              placeholder="#3b82f6"
              value={formData.color}
              onChange={(e) => handleFieldChange('color', e.target.value)}
              slotProps={{
                input: {
                  startAdornment: formData.color && (
                    <InputAdornment position="start">
                      <Box
                        sx={{
                          width: 20,
                          height: 20,
                          borderRadius: 0.5,
                          bgcolor: formData.color,
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      />
                    </InputAdornment>
                  ),
                },
              }}
              helperText="Hex color code for the category"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={addDialog.onFalse} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!formData.name || !formData.label || !formData.icon || submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : undefined}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={editDialog.value} onClose={editDialog.onFalse} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Category</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Name (ID)"
              value={formData.name}
              disabled
              helperText="Category identifier cannot be changed"
              slotProps={{
                input: {
                  sx: { fontFamily: 'monospace' },
                },
              }}
            />
            <TextField
              autoFocus
              fullWidth
              label="Label"
              value={formData.label}
              onChange={(e) => handleFieldChange('label', e.target.value)}
              helperText="Display name for the category"
            />
            <TextField
              fullWidth
              label="Icon"
              value={formData.icon}
              onChange={(e) => handleFieldChange('icon', e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Iconify icon={(formData.icon || 'mdi:tag') as any} width={24} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button size="small" onClick={iconPickerDialog.onTrue}>
                        Browse
                      </Button>
                    </InputAdornment>
                  ),
                },
              }}
              helperText="Iconify icon name"
            />
            <TextField
              fullWidth
              label="Color (optional)"
              placeholder="#3b82f6"
              value={formData.color}
              onChange={(e) => handleFieldChange('color', e.target.value)}
              slotProps={{
                input: {
                  startAdornment: formData.color && (
                    <InputAdornment position="start">
                      <Box
                        sx={{
                          width: 20,
                          height: 20,
                          borderRadius: 0.5,
                          bgcolor: formData.color,
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      />
                    </InputAdornment>
                  ),
                },
              }}
              helperText="Hex color code for the category"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={editDialog.onFalse} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdate}
            disabled={!formData.label || !formData.icon || submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : undefined}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Icon Picker Dialog */}
      <Dialog 
        open={iconPickerDialog.value} 
        onClose={iconPickerDialog.onFalse} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>Choose Icon</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            placeholder="Search icons..."
            value={iconSearch}
            onChange={(e) => setIconSearch(e.target.value)}
            sx={{ mb: 2 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" width={20} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))',
              gap: 1,
              maxHeight: 300,
              overflow: 'auto',
            }}
          >
            {filteredIcons.map((icon) => (
              <IconButton
                key={icon}
                onClick={() => handleSelectIcon(icon)}
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: formData.icon === icon ? 'primary.main' : 'divider',
                  bgcolor: formData.icon === icon ? 'primary.lighter' : 'transparent',
                }}
              >
                <Iconify icon={icon as any} width={24} />
              </IconButton>
            ))}
          </Box>
          <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
            Tip: You can also type any Iconify icon name directly (e.g., mdi:star, solar:heart-bold)
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={iconPickerDialog.onFalse} color="inherit">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.value}
        onClose={() => {
          deleteDialog.onFalse();
          setDeletingCategory(null);
        }}
        title="Delete Category"
        content={
          <>
            Are you sure you want to delete <strong>{deletingCategory?.label}</strong>?
            <br />
            <br />
            This action cannot be undone. Events using this category will no longer have a category assigned.
          </>
        }
        action={
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : undefined}
          >
            Delete
          </Button>
        }
      />
    </>
  );
}
