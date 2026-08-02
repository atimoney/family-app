import { useMemo } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import ListItem from '@mui/material/ListItem';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import ListItemText from '@mui/material/ListItemText';
import CardActionArea from '@mui/material/CardActionArea';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fDate, fTime } from 'src/utils/format-time';

import { useTasks } from 'src/features/tasks';
import { DashboardContent } from 'src/layouts/dashboard';
import { useCalendarEvents } from 'src/features/calendar/hooks/use-calendar-events';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const MAX_ITEMS = 5;

export function FamilyDashboardView() {
  // Today's date range for the calendar query
  const todayRange = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }, []);

  const { events, loading: eventsLoading } = useCalendarEvents(todayRange);

  const { tasks, loading: tasksLoading } = useTasks();

  const todayEvents = useMemo(
    () =>
      [...events]
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
        .slice(0, MAX_ITEMS),
    [events]
  );

  const openTasks = useMemo(
    () => tasks.filter((task) => task.status !== 'done').slice(0, MAX_ITEMS),
    [tasks]
  );

  const renderLoading = () => (
    <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
      <CircularProgress size={24} />
    </Box>
  );

  const renderEmpty = (message: string) => (
    <Typography variant="body2" sx={{ py: 2, color: 'text.secondary' }}>
      {message}
    </Typography>
  );

  return (
    <DashboardContent maxWidth="xl">
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title="Today"
              subheader="Today's events"
              action={
                <Link
                  component={RouterLink}
                  href={paths.family.calendar}
                  variant="body2"
                  sx={{ mt: 1 }}
                >
                  View calendar
                </Link>
              }
            />
            <CardContent sx={{ pt: 0 }}>
              {eventsLoading && todayEvents.length === 0 ? (
                renderLoading()
              ) : todayEvents.length === 0 ? (
                renderEmpty('No events today')
              ) : (
                <List disablePadding>
                  {todayEvents.map((event) => (
                    <ListItem key={event.id} disablePadding sx={{ py: 0.75 }}>
                      <ListItemText
                        primary={event.title}
                        secondary={event.allDay ? 'All day' : fTime(event.start)}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title="Tasks"
              subheader="Open items"
              action={
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1 }}>
                  {!tasksLoading && (
                    <Chip label={`${openTasks.length} open`} size="small" color="warning" />
                  )}
                  <Link component={RouterLink} href={paths.family.tasks} variant="body2">
                    View tasks
                  </Link>
                </Stack>
              }
            />
            <CardContent sx={{ pt: 0 }}>
              {tasksLoading && openTasks.length === 0 ? (
                renderLoading()
              ) : openTasks.length === 0 ? (
                renderEmpty('No open tasks')
              ) : (
                <List disablePadding>
                  {openTasks.map((task) => (
                    <ListItem key={task.id} disablePadding sx={{ py: 0.75 }}>
                      <ListItemText
                        primary={task.title}
                        secondary={task.dueAt ? `Due ${fDate(task.dueAt)}` : 'No due date'}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardActionArea component={RouterLink} href={paths.assistant} sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Iconify
                    icon="solar:chat-round-dots-bold"
                    width={32}
                    sx={{ color: 'primary.main' }}
                  />
                  <Box>
                    <Typography variant="subtitle1">Assistant</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Chat with your family assistant
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardActionArea component={RouterLink} href={paths.lists.root} sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Iconify
                    icon="solar:list-bold"
                    width={32}
                    sx={{ color: 'primary.main' }}
                  />
                  <Box>
                    <Typography variant="subtitle1">Lists</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Shopping and other family lists
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>
    </DashboardContent>
  );
}
