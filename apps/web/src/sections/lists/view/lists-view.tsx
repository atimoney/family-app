import type { ListDTO, ListTemplateKey } from '@family/shared';

import { useCallback } from 'react';
import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import CardActionArea from '@mui/material/CardActionArea';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { DashboardContent } from 'src/layouts/dashboard';
import { useLists, useListMutations } from 'src/features/lists';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { CreateListDialog } from '../create-list-dialog';

// ----------------------------------------------------------------------

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

export function ListsView() {
  const router = useRouter();
  const { lists, loading, error, refresh } = useLists();
  const { create, loading: creating } = useListMutations(refresh);

  const createDialog = useBoolean();

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
        createDialog.onFalse();
        router.push(paths.lists.view(list.id));
      }
    },
    [create, createDialog, router]
  );

  // Group lists by visibility
  const pinnedLists = lists.filter((l) => l.navVisibility === 'pinned');
  const visibleLists = lists.filter((l) => l.navVisibility === 'visible');
  const hiddenLists = lists.filter((l) => l.navVisibility === 'hidden');

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
          <Typography variant="h4">Lists</Typography>
          <Button
            variant="contained"
            startIcon={<Iconify icon={'solar:add-circle-bold' as any} />}
            onClick={createDialog.onTrue}
          >
            New List
          </Button>
        </Stack>

        {/* Empty state */}
        {lists.length === 0 && (
          <EmptyContent
            title="No lists yet"
            description="Create your first list to get started"
            action={
              <Button
                variant="contained"
                startIcon={<Iconify icon={'solar:add-circle-bold' as any} />}
                onClick={createDialog.onTrue}
              >
                Create List
              </Button>
            }
          />
        )}

        {/* Pinned lists */}
        {pinnedLists.length > 0 && (
          <ListSection
            title="Pinned"
            lists={pinnedLists}
            onListClick={handleListClick}
          />
        )}

        {/* Visible lists */}
        {visibleLists.length > 0 && (
          <ListSection
            title="Lists"
            lists={visibleLists}
            onListClick={handleListClick}
          />
        )}

        {/* Hidden lists */}
        {hiddenLists.length > 0 && (
          <>
            <Divider />
            <ListSection
              title="Hidden"
              lists={hiddenLists}
              onListClick={handleListClick}
            />
          </>
        )}
      </Stack>

      {/* Create List Dialog */}
      <CreateListDialog
        open={createDialog.value}
        onClose={createDialog.onFalse}
        onSubmit={handleCreateList}
        loading={creating}
      />
    </DashboardContent>
  );
}

// ----------------------------------------------------------------------

type ListSectionProps = {
  title: string;
  lists: ListDTO[];
  onListClick: (listId: string) => void;
};

function ListSection({ title, lists, onListClick }: ListSectionProps) {
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
        {title}
      </Typography>
      <Grid container spacing={2}>
        {lists.map((list) => (
          <Grid key={list.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <ListCard list={list} onClick={() => onListClick(list.id)} />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

// ----------------------------------------------------------------------

type ListCardProps = {
  list: ListDTO;
  onClick: () => void;
};

function ListCard({ list, onClick }: ListCardProps) {
  const templateKey = list.templateKey as ListTemplateKey;

  return (
    <Card>
      <CardActionArea onClick={onClick} sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
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
              }}
            >
              <Iconify icon={getListIcon(templateKey) as any} width={24} />
            </Box>
            <Stack sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" noWrap>
                {list.name}
              </Typography>
              <Label
                variant="soft"
                color={getTemplateColor(templateKey)}
                sx={{ alignSelf: 'flex-start' }}
              >
                {getTemplateLabel(templateKey)}
              </Label>
            </Stack>
            {list.navVisibility === 'pinned' && (
              <Iconify
                icon={'solar:pin-bold' as any}
                width={16}
                sx={{ color: 'text.disabled' }}
              />
            )}
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
}
