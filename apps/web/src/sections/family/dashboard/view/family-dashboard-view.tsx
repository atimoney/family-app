import type { Task, ShoppingItem, CalendarEvent } from '@family/shared';

import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import ListItem from '@mui/material/ListItem';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import ListItemText from '@mui/material/ListItemText';

import { DashboardContent } from 'src/layouts/dashboard';

// ----------------------------------------------------------------------

type HomeDeviceStatus = {
  id: string;
  name: string;
  status: string;
};

type HomeSummary = {
  mode: string;
  alarm: string;
  temperature: string;
  poolTemperature: string;
  devices: HomeDeviceStatus[];
};

export function FamilyDashboardView() {
  const [homeSummary] = useState<HomeSummary>({
    mode: 'Home',
    alarm: 'Armed away',
    temperature: '22°C',
    poolTemperature: '27°C',
    devices: [
      { id: 'device-1', name: 'Front Door', status: 'Locked' },
      { id: 'device-2', name: 'Living Room Lights', status: 'On' },
    ],
  });

  const [events] = useState<CalendarEvent[]>([
    {
      id: 'event-1',
      title: 'Morning drop-off',
      start: '2026-01-25T08:00:00.000Z',
      end: '2026-01-25T08:30:00.000Z',
    },
    {
      id: 'event-2',
      title: 'Swim practice',
      start: '2026-01-25T16:30:00.000Z',
      end: '2026-01-25T18:00:00.000Z',
    },
  ]);

  const [tasks] = useState<Task[]>([
    {
      id: 'task-1',
      title: 'Pack school lunches',
      assigneeId: 'member-1',
      dueDate: '2026-01-25',
      completed: false,
      createdAt: '2026-01-20T08:00:00.000Z',
    },
    {
      id: 'task-2',
      title: 'Pay electricity bill',
      assigneeId: 'member-2',
      dueDate: '2026-01-25',
      completed: false,
      createdAt: '2026-01-19T12:45:00.000Z',
    },
    {
      id: 'task-3',
      title: 'Book dentist appointment',
      completed: false,
      createdAt: '2026-01-18T09:15:00.000Z',
    },
    {
      id: 'task-4',
      title: 'Return library books',
      completed: false,
      createdAt: '2026-01-17T10:30:00.000Z',
    },
    {
      id: 'task-5',
      title: 'Schedule HVAC maintenance',
      completed: true,
      createdAt: '2026-01-16T11:00:00.000Z',
    },
    {
      id: 'task-6',
      title: 'Pick up dry cleaning',
      completed: false,
      createdAt: '2026-01-15T14:00:00.000Z',
    },
  ]);

  const [shoppingItems] = useState<ShoppingItem[]>([
    { id: 'shop-1', name: 'Milk', quantity: '2L', category: 'Dairy', purchased: false },
    { id: 'shop-2', name: 'Whole grain bread', quantity: '1 loaf', category: 'Bakery', purchased: false },
    { id: 'shop-3', name: 'Chicken breast', quantity: '2 lb', category: 'Meat', purchased: false },
    { id: 'shop-4', name: 'Strawberries', quantity: '1 box', category: 'Produce', purchased: false },
    { id: 'shop-5', name: 'Laundry detergent', category: 'Household', purchased: false },
    { id: 'shop-6', name: 'Sparkling water', quantity: '12-pack', category: 'Beverages', purchased: true },
  ]);

  const openTasks = useMemo(() => tasks.filter((task) => !task.completed).slice(0, 5), [tasks]);

  const todayTasks = useMemo(() => tasks.filter((task) => !task.completed).slice(0, 3), [tasks]);

  const topShoppingItems = useMemo(
    () => shoppingItems.filter((item) => !item.purchased).slice(0, 5),
    [shoppingItems]
  );

  return (
    <DashboardContent maxWidth="xl">
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="Home" subheader="Home Assistant" />
            <CardContent sx={{ pt: 0 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Mode
                  </Typography>
                  <Chip label={homeSummary.mode} size="small" color="primary" variant="soft" />
                </Stack>

                <Stack direction="row" spacing={2} alignItems="center">
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Alarm
                    </Typography>
                    <Typography variant="subtitle2">{homeSummary.alarm}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Indoor temp
                    </Typography>
                    <Typography variant="subtitle2">{homeSummary.temperature}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Pool temp
                    </Typography>
                    <Typography variant="subtitle2">{homeSummary.poolTemperature}</Typography>
                  </Box>
                </Stack>

                <Divider />

                <Stack spacing={0.75}>
                  <Typography variant="subtitle2">Devices</Typography>
                  {homeSummary.devices.map((device) => (
                    <Stack key={device.id} direction="row" justifyContent="space-between">
                      <Typography variant="body2">{device.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {device.status}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="Today" subheader="Events & tasks" />
            <CardContent sx={{ pt: 0 }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Events
                  </Typography>
                  <List disablePadding>
                    {events.map((event) => (
                      <ListItem key={event.id} disablePadding sx={{ py: 0.75 }}>
                        <ListItemText
                          primary={event.title}
                          secondary={event.start.slice(11, 16)}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Tasks
                  </Typography>
                  <List disablePadding>
                    {todayTasks.map((task) => (
                      <ListItem key={task.id} disablePadding sx={{ py: 0.75 }}>
                        <ListItemText
                          primary={task.title}
                          secondary={task.dueDate ?? 'Today'}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title="Tasks"
              subheader="Open items"
              action={<Chip label={`${openTasks.length} open`} size="small" color="warning" />}
            />
            <CardContent sx={{ pt: 0 }}>
              <List disablePadding>
                {openTasks.map((task) => (
                  <ListItem key={task.id} disablePadding sx={{ py: 0.75 }}>
                    <ListItemText
                      primary={task.title}
                      secondary={task.dueDate ?? 'No due date'}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title="Shopping"
              subheader="Next trip"
              action={<Chip label={`${topShoppingItems.length} items`} size="small" color="success" />}
            />
            <CardContent sx={{ pt: 0 }}>
              <List disablePadding>
                {topShoppingItems.map((item) => (
                  <ListItem key={item.id} disablePadding sx={{ py: 0.75 }}>
                    <ListItemText
                      primary={item.name}
                      secondary={item.quantity ?? item.category}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </DashboardContent>
  );
}
