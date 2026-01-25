import type { CalendarEvent } from '@family/shared';
import type { CalendarRange } from './hooks/use-calendar';

import * as z from 'zod';
import dayjs from 'dayjs';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { uuidv4 } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import DialogActions from '@mui/material/DialogActions';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { Form, Field, zodResolver } from 'src/components/hook-form';

// ----------------------------------------------------------------------

export type EventSchemaType = z.infer<typeof EventSchema>;

export const EventSchema = z.object({
  title: z
    .string()
    .min(1, { error: 'Title is required!' })
    .max(100, { error: 'Title must be less than 100 characters' }),
  allDay: z.boolean(),
  start: z.union([z.string(), z.number()]),
  end: z.union([z.string(), z.number()]),
});

// ----------------------------------------------------------------------

type Props = {
  onClose: () => void;
  currentEvent?: CalendarEvent | null;
  selectedRange: CalendarRange;
  onCreateEvent: (event: CalendarEvent) => void;
  onUpdateEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (eventId: string) => void;
};

export function CalendarForm({
  currentEvent,
  selectedRange,
  onClose,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
}: Props) {
  const isEdit = !!currentEvent?.id;

  const defaultValues = {
    title: currentEvent?.title || '',
    allDay: currentEvent?.allDay ?? false,
    start: currentEvent?.start || selectedRange?.start || dayjs().format(),
    end: currentEvent?.end || selectedRange?.end || dayjs().add(1, 'hour').format(),
  };

  const methods = useForm({
    mode: 'all',
    resolver: zodResolver(EventSchema),
    defaultValues,
  });

  const {
    reset,
    watch,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const values = watch();

  // Check if end date is after start date
  const dateError = dayjs(values.end).isBefore(dayjs(values.start));

  const onSubmit = handleSubmit(async (data) => {
    const eventData: CalendarEvent = {
      id: currentEvent?.id || uuidv4(),
      title: data.title,
      allDay: data.allDay,
      start: dayjs(data.start).toISOString(),
      end: dayjs(data.end).toISOString(),
    };

    try {
      if (!dateError) {
        if (isEdit) {
          onUpdateEvent(eventData);
        } else {
          onCreateEvent(eventData);
        }
        onClose();
        reset();
      }
    } catch (error) {
      console.error(error);
    }
  });

  const onDelete = useCallback(() => {
    if (currentEvent?.id) {
      onDeleteEvent(currentEvent.id);
      onClose();
    }
  }, [currentEvent?.id, onClose, onDeleteEvent]);

  return (
    <Form methods={methods} onSubmit={onSubmit}>
      <Scrollbar sx={{ p: 3, bgcolor: 'background.neutral' }}>
        <Stack spacing={3}>
          <Field.Text name="title" label="Title" />

          <Field.Switch name="allDay" label="All day" />

          <Field.DateTimePicker name="start" label="Start date" />

          <Field.DateTimePicker
            name="end"
            label="End date"
            slotProps={{
              textField: {
                error: dateError,
                helperText: dateError ? 'End date must be later than start date' : null,
              },
            }}
          />
        </Stack>
      </Scrollbar>

      <DialogActions sx={{ flexShrink: 0 }}>
        {isEdit && (
          <Tooltip title="Delete event">
            <IconButton color="error" onClick={onDelete} edge="start">
              <Iconify icon="solar:trash-bin-trash-bold" />
            </IconButton>
          </Tooltip>
        )}

        <Box component="span" sx={{ flexGrow: 1 }} />

        <Button variant="outlined" color="inherit" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" loading={isSubmitting} disabled={dateError}>
          {isEdit ? 'Save changes' : 'Create'}
        </Button>
      </DialogActions>
    </Form>
  );
}
