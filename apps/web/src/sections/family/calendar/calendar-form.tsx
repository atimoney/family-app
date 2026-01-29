import type { FamilyMember } from '@family/shared';
import type { CalendarRange } from './hooks/use-calendar';
import type { 
  CalendarInfo, 
  EventReminder, 
  RecurrenceRule, 
  ReminderMethod, 
  CalendarEventItem, 
  RecurrenceFrequency, 
  EventFamilyAssignments,
  EventCategory,
  EventAudience,
  CategoryMetadata,
} from 'src/features/calendar/types';

import * as z from 'zod';
import dayjs from 'dayjs';
import { uuidv4 } from 'minimal-shared/utils';
import { useForm, Controller } from 'react-hook-form';
import { useState, useCallback, useMemo } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import {
  info,
  primary,
  success,
  warning,
  secondary,
  error as errorColor,
} from 'src/theme/core/palette';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { ColorPicker } from 'src/components/color-utils';
import { Form, Field, zodResolver } from 'src/components/hook-form';

// ----------------------------------------------------------------------

// Color options for event picker
export const CALENDAR_COLOR_OPTIONS = [
  primary.main,
  secondary.main,
  info.main,
  info.darker,
  success.main,
  warning.main,
  errorColor.main,
  errorColor.darker,
];

// E1: Event category options
export const EVENT_CATEGORIES: { value: EventCategory; label: string; icon: string }[] = [
  { value: 'Activity', label: 'Activity', icon: 'solar:cup-star-bold' },
  { value: 'Meal', label: 'Meal', icon: 'custom:fast-food-fill' },
  { value: 'School', label: 'School', icon: 'mdi:school' },
  { value: 'Sport', label: 'Sport', icon: 'solar:dumbbell-large-minimalistic-bold' },
  { value: 'Chore', label: 'Chore', icon: 'mdi:broom' },
  { value: 'Appointment', label: 'Appointment', icon: 'solar:calendar-date-bold' },
  { value: 'Work', label: 'Work', icon: 'mdi:briefcase' },
  { value: 'Travel', label: 'Travel', icon: 'mdi:airplane' },
  { value: 'Home', label: 'Home', icon: 'mdi:home' },
  { value: 'Admin', label: 'Admin', icon: 'solar:file-text-bold' },
];

// E1: Event audience options
export const EVENT_AUDIENCES: { value: EventAudience; label: string }[] = [
  { value: 'family', label: 'Everyone' },
  { value: 'adults', label: 'Adults only' },
  { value: 'kids', label: 'Kids only' },
];

// Recurrence options
export const RECURRENCE_OPTIONS = [
  { value: '', label: 'Does not repeat' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
  { value: 'CUSTOM', label: 'Custom...' },
] as const;

// Reminder time presets (in minutes)
export const REMINDER_PRESETS = [
  { value: 0, label: 'At time of event' },
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
  { value: 2880, label: '2 days before' },
  { value: 10080, label: '1 week before' },
] as const;

// Days of week for weekly recurrence
export const DAYS_OF_WEEK = [
  { value: 'SU', label: 'Sun' },
  { value: 'MO', label: 'Mon' },
  { value: 'TU', label: 'Tue' },
  { value: 'WE', label: 'Wed' },
  { value: 'TH', label: 'Thu' },
  { value: 'FR', label: 'Fri' },
  { value: 'SA', label: 'Sat' },
] as const;

// ----------------------------------------------------------------------

// Recurrence schema
const recurrenceRuleSchema = z.object({
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  interval: z.number().int().positive().optional(),
  count: z.number().int().positive().optional(),
  until: z.string().optional(),
  byDay: z.array(z.string()).optional(),
  byMonthDay: z.array(z.number()).optional(),
  byMonth: z.array(z.number()).optional(),
}).nullable().optional();

// Reminder schema
const eventReminderSchema = z.object({
  method: z.enum(['email', 'popup']),
  minutes: z.number().int().min(0),
});

// E2: Family assignments schema
const familyAssignmentsSchema = z.object({
  primaryFamilyMemberId: z.string().nullable().optional(),
  participantFamilyMemberIds: z.array(z.string()).nullable().optional(),
  cookMemberId: z.string().nullable().optional(),
  assignedToMemberId: z.string().nullable().optional(),
}).passthrough().nullable().optional();

// E1: Category schema
const eventCategorySchema = z.enum([
  'Meal', 'School', 'Sport', 'Activity', 'Chore', 
  'Appointment', 'Work', 'Travel', 'Home', 'Admin'
]).nullable().optional();

// E1: Audience schema
const eventAudienceSchema = z.enum(['family', 'adults', 'kids']).default('family');

// E1: Category-specific metadata schemas
const mealMetadataSchema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  cuisine: z.string().optional(),
  recipeUrl: z.string().url().optional().or(z.literal('')),
  ingredients: z.array(z.string()).optional(),
  servings: z.number().int().positive().optional(),
}).optional();

const schoolMetadataSchema = z.object({
  subject: z.string().optional(),
  teacher: z.string().optional(),
  dueDate: z.string().optional(),
  gradeLevel: z.string().optional(),
}).optional();

const sportMetadataSchema = z.object({
  sportType: z.string().optional(),
  team: z.string().optional(),
  opponent: z.string().optional(),
  isGame: z.boolean().optional(),
  isPractice: z.boolean().optional(),
  location: z.string().optional(),
  uniform: z.string().optional(),
}).optional();

const choreMetadataSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly', 'as-needed']).optional(),
  points: z.number().int().min(0).optional(),
  verifiedBy: z.string().optional(),
}).optional();

const appointmentMetadataSchema = z.object({
  appointmentType: z.enum(['medical', 'dental', 'vision', 'therapy', 'consultation', 'other']).optional(),
  provider: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
}).optional();

const travelMetadataSchema = z.object({
  destination: z.string().optional(),
  transportMode: z.enum(['car', 'plane', 'train', 'bus', 'boat', 'other']).optional(),
  confirmationNumber: z.string().optional(),
  departureTime: z.string().optional(),
  arrivalTime: z.string().optional(),
}).optional();

const homeMetadataSchema = z.object({
  area: z.string().optional(),
  contractor: z.string().optional(),
  cost: z.number().min(0).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
}).optional();

const adminMetadataSchema = z.object({
  documentType: z.string().optional(),
  deadline: z.string().optional(),
  organization: z.string().optional(),
  referenceNumber: z.string().optional(),
}).optional();

// Union for all category metadata - use passthrough to allow any structure
const categoryMetadataSchema = z.object({}).passthrough().nullable().optional();

export type EventSchemaType = z.infer<typeof EventSchema>;

export const EventSchema = z.object({
  title: z
    .string()
    .min(1, { message: 'Title is required!' })
    .max(100, { message: 'Title must be less than 100 characters' }),
  description: z.string().max(8000).nullable().optional(),
  location: z.string().max(1000).nullable().optional(),
  color: z.string().nullable().optional(),
  allDay: z.boolean(),
  start: z.union([z.string(), z.number()]),
  end: z.union([z.string(), z.number()]),
  calendarId: z.string().optional(),
  recurrence: recurrenceRuleSchema,
  reminders: z.array(eventReminderSchema).max(5).nullable().optional(),
  familyAssignments: familyAssignmentsSchema,
  // E1: Event metadata fields
  category: eventCategorySchema,
  audience: eventAudienceSchema,
  tags: z.array(z.string()).max(20).default([]),
  categoryMetadata: categoryMetadataSchema,
});

// ----------------------------------------------------------------------

type Props = {
  onClose: () => void;
  currentEvent?: CalendarEventItem | null;
  selectedRange: CalendarRange;
  calendars: CalendarInfo[];
  familyMembers?: FamilyMember[];
  onCreateEvent: (event: CalendarEventItem) => void | Promise<void>;
  onUpdateEvent: (event: CalendarEventItem) => void;
  onDeleteEvent: (eventId: string) => void;
};

export function CalendarForm({
  currentEvent,
  selectedRange,
  calendars,
  familyMembers = [],
  onClose,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
}: Props) {
  const isEdit = !!currentEvent?.id;

  // Get default calendar (first selected one)
  const defaultCalendarId = calendars[0]?.id ?? '';

  // E2: Check if family members are available for assignment
  const hasFamilyMembers = familyMembers.length > 0;

  // E2: Create a map for quick member lookup by ID
  const memberById = useMemo(() => {
    const map = new Map<string, FamilyMember>();
    familyMembers.forEach((m) => map.set(m.id, m));
    return map;
  }, [familyMembers]);

  // E2: Get display name for a member
  const getMemberDisplayName = useCallback(
    (member: FamilyMember) =>
      member.displayName || member.profile?.displayName || member.profile?.email || 'Unknown',
    []
  );

  // State for custom recurrence dialog
  const [showCustomRecurrence, setShowCustomRecurrence] = useState(false);
  const [customRecurrence, setCustomRecurrence] = useState<{
    frequency: RecurrenceFrequency;
    interval: number;
    byDay: string[];
    endType: 'never' | 'count' | 'until';
    count: number;
    until: string;
  }>({
    frequency: 'WEEKLY',
    interval: 1,
    byDay: [],
    endType: 'never',
    count: 10,
    until: dayjs().add(1, 'month').format('YYYY-MM-DD'),
  });

  // E2: Get existing family assignments from event
  const existingAssignments = currentEvent?.familyAssignments || currentEvent?.extendedProps?.metadata?.familyAssignments;

  // E1: Get existing metadata from event
  const existingMetadata = currentEvent?.extendedProps?.metadata;

  const defaultValues = {
    title: currentEvent?.title || '',
    description: currentEvent?.description || currentEvent?.extendedProps?.description || '',
    location: currentEvent?.location || currentEvent?.extendedProps?.location || '',
    color: currentEvent?.color || currentEvent?.extendedProps?.metadata?.color || '',
    allDay: currentEvent?.allDay ?? false,
    start: currentEvent?.start || selectedRange?.start || dayjs().format(),
    end: currentEvent?.end || selectedRange?.end || dayjs().add(1, 'hour').format(),
    calendarId: currentEvent?.calendarId || defaultCalendarId,
    recurrence: currentEvent?.recurrence || null,
    reminders: currentEvent?.reminders || [{ method: 'popup' as ReminderMethod, minutes: 30 }],
    familyAssignments: existingAssignments || null,
    // E1: Event metadata defaults
    category: existingMetadata?.category || null,
    audience: existingMetadata?.audience || 'family',
    tags: existingMetadata?.tags || [],
    categoryMetadata: existingMetadata?.categoryMetadata || null,
  };

  const methods = useForm({
    mode: 'all',
    resolver: zodResolver(EventSchema),
    defaultValues,
  });

  const {
    reset,
    watch,
    control,
    setValue,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = methods;

  // Debug: log form errors
  if (Object.keys(errors).length > 0) {
    console.log('[FORM VALIDATION ERRORS]', errors);
  }

  const values = watch();

  // Check if end date is after start date
  const dateError = dayjs(values.end).isBefore(dayjs(values.start));

  // Handle recurrence selection
  const handleRecurrenceChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      if (value === 'CUSTOM') {
        // Initialize custom recurrence with current values or defaults
        const currentRecurrence = values.recurrence;
        setCustomRecurrence({
          frequency: currentRecurrence?.frequency || 'WEEKLY',
          interval: currentRecurrence?.interval || 1,
          byDay: currentRecurrence?.byDay || [],
          endType: currentRecurrence?.count ? 'count' : currentRecurrence?.until ? 'until' : 'never',
          count: currentRecurrence?.count || 10,
          until: currentRecurrence?.until || dayjs().add(1, 'month').format('YYYY-MM-DD'),
        });
        setShowCustomRecurrence(true);
      } else if (value === '') {
        setValue('recurrence', null);
      } else {
        setValue('recurrence', { frequency: value as RecurrenceFrequency });
      }
    },
    [setValue, values.recurrence]
  );

  // Handle custom recurrence save
  const handleSaveCustomRecurrence = useCallback(() => {
    const rule: RecurrenceRule = {
      frequency: customRecurrence.frequency,
      interval: customRecurrence.interval > 1 ? customRecurrence.interval : undefined,
      byDay: customRecurrence.frequency === 'WEEKLY' && customRecurrence.byDay.length > 0 ? customRecurrence.byDay : undefined,
    };

    if (customRecurrence.endType === 'count') {
      rule.count = customRecurrence.count;
    } else if (customRecurrence.endType === 'until') {
      rule.until = customRecurrence.until;
    }

    setValue('recurrence', rule);
    setShowCustomRecurrence(false);
  }, [customRecurrence, setValue]);

  // Toggle day selection for weekly recurrence
  const handleToggleDay = useCallback((day: string) => {
    setCustomRecurrence((prev) => ({
      ...prev,
      byDay: prev.byDay.includes(day)
        ? prev.byDay.filter((d) => d !== day)
        : [...prev.byDay, day],
    }));
  }, []);

  // Get human-readable recurrence summary
  const getRecurrenceSummary = useCallback((recurrence: RecurrenceRule | null | undefined): string => {
    if (!recurrence) return '';
    
    const { frequency, interval, byDay, count, until } = recurrence;
    const isCustom = (interval && interval > 1) || (byDay && byDay.length > 0) || count || until;
    
    if (!isCustom) {
      return frequency;
    }
    
    // It's a custom recurrence - return 'CUSTOM' to show in dropdown
    return 'CUSTOM';
  }, []);

  // Get display label for current recurrence
  const getRecurrenceDisplayValue = useCallback((): string => {
    const recurrence = values.recurrence;
    if (!recurrence) return '';
    
    const summary = getRecurrenceSummary(recurrence);
    return summary;
  }, [values.recurrence, getRecurrenceSummary]);

  // Add a new reminder
  const handleAddReminder = useCallback(() => {
    const currentReminders = values.reminders || [];
    if (currentReminders.length < 5) {
      setValue('reminders', [...currentReminders, { method: 'popup' as ReminderMethod, minutes: 30 }]);
    }
  }, [values.reminders, setValue]);

  // Remove a reminder
  const handleRemoveReminder = useCallback(
    (index: number) => {
      const currentReminders = values.reminders || [];
      setValue(
        'reminders',
        currentReminders.filter((_, i) => i !== index)
      );
    },
    [values.reminders, setValue]
  );

  // Update a reminder
  const handleUpdateReminder = useCallback(
    (index: number, field: 'method' | 'minutes', value: string | number) => {
      const currentReminders = [...(values.reminders || [])];
      currentReminders[index] = {
        ...currentReminders[index],
        [field]: field === 'minutes' ? Number(value) : value,
      };
      setValue('reminders', currentReminders);
    },
    [values.reminders, setValue]
  );

  const onSubmit = handleSubmit(async (data) => {
    const eventData: CalendarEventItem = {
      id: currentEvent?.id || uuidv4(),
      title: data.title,
      description: data.description || null,
      location: data.location || null,
      color: data.color || undefined,
      allDay: data.allDay,
      start: dayjs(data.start).toISOString(),
      end: dayjs(data.end).toISOString(),
      calendarId: data.calendarId,
      recurrence: data.recurrence as RecurrenceRule | null,
      reminders: data.reminders as EventReminder[] | null,
      familyAssignments: data.familyAssignments as EventFamilyAssignments | null,
      // E1: Event metadata fields
      category: data.category as EventCategory | null,
      audience: data.audience as EventAudience,
      tags: data.tags || [],
      categoryMetadata: data.categoryMetadata as CategoryMetadata | null,
    };

    try {
      if (!dateError) {
        if (isEdit) {
          onUpdateEvent(eventData);
          onClose();
        } else {
          // onCreateEvent handles closing the form after API success
          await onCreateEvent(eventData);
        }
        reset();
      }
    } catch (err) {
      console.error(err);
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

          <Field.Text
            name="description"
            label="Description"
            multiline
            rows={3}
            placeholder="Add a description..."
          />

          <Field.Text
            name="location"
            label="Location"
            placeholder="Add a location..."
            slotProps={{
              input: {
                startAdornment: (
                  <Iconify icon="mingcute:location-fill" sx={{ mr: 1, color: 'text.disabled' }} />
                ),
              },
            }}
          />

          {calendars.length > 1 && (
            <Field.Select name="calendarId" label="Calendar">
              {calendars.map((calendar) => (
                <MenuItem key={calendar.id} value={calendar.id}>
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-block',
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: calendar.backgroundColor || 'primary.main',
                      mr: 1.5,
                    }}
                  />
                  {calendar.summary}
                </MenuItem>
              ))}
            </Field.Select>
          )}

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

          {/* Color Picker */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Event color
            </Typography>
            <Controller
              name="color"
              control={control}
              render={({ field }) => (
                <ColorPicker
                  value={field.value || ''}
                  onChange={(color) => field.onChange(color as string)}
                  options={CALENDAR_COLOR_OPTIONS}
                />
              )}
            />
          </Box>

          {/* Recurrence */}
          <Field.Select
            name="recurrence"
            label="Repeat"
            value={getRecurrenceDisplayValue()}
            onChange={handleRecurrenceChange}
          >
            {RECURRENCE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Field.Select>

          {/* Reminders */}
          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="subtitle2">Reminders</Typography>
              {(values.reminders?.length || 0) < 5 && (
                <Button
                  size="small"
                  startIcon={<Iconify icon="mingcute:add-line" />}
                  onClick={handleAddReminder}
                >
                  Add
                </Button>
              )}
            </Stack>

            <Stack spacing={1.5}>
              {values.reminders?.map((reminder, index) => (
                <Stack key={index} direction="row" spacing={1.5} alignItems="center">
                  <Field.Select
                    name={`reminders.${index}.method`}
                    size="small"
                    sx={{ width: 130, flexShrink: 0 }}
                    value={reminder.method}
                    onChange={(e) => handleUpdateReminder(index, 'method', e.target.value)}
                  >
                    <MenuItem value="popup">Notification</MenuItem>
                    <MenuItem value="email">Email</MenuItem>
                  </Field.Select>

                  <Field.Select
                    name={`reminders.${index}.minutes`}
                    size="small"
                    sx={{ flexGrow: 1, minWidth: 120 }}
                    value={reminder.minutes}
                    onChange={(e) => handleUpdateReminder(index, 'minutes', e.target.value)}
                  >
                    {REMINDER_PRESETS.map((preset) => (
                      <MenuItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </MenuItem>
                    ))}
                  </Field.Select>

                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleRemoveReminder(index)}
                    sx={{ flexShrink: 0 }}
                  >
                    <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                  </IconButton>
                </Stack>
              ))}

              {(!values.reminders || values.reminders.length === 0) && (
                <Typography variant="body2" color="text.secondary">
                  No reminders set
                </Typography>
              )}
            </Stack>
          </Box>

          {/* E2: Family Member Assignments */}
          {hasFamilyMembers && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                Family
              </Typography>

              <Stack spacing={2}>
                {/* Primary Family Member */}
                <Controller
                  name="familyAssignments.primaryFamilyMemberId"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      {...field}
                      value={field.value ? memberById.get(field.value) || null : null}
                      onChange={(_, newValue) => {
                        field.onChange(newValue?.id || null);
                      }}
                      options={familyMembers}
                      getOptionLabel={(option) => getMemberDisplayName(option)}
                      isOptionEqualToValue={(option, value) => option.id === value?.id}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Primary member"
                          placeholder="Who is responsible?"
                          size="small"
                        />
                      )}
                      renderOption={(props, option) => {
                        const { key, ...otherProps } = props;
                        return (
                          <li key={key} {...otherProps}>
                            <Avatar
                              alt={getMemberDisplayName(option)}
                              src={option.profile?.avatarUrl || undefined}
                              sx={{ mr: 1, width: 24, height: 24, flexShrink: 0 }}
                            />
                            <Box component="span" sx={{ flexGrow: 1 }}>
                              {getMemberDisplayName(option)}
                            </Box>
                            {option.color && (
                              <Box
                                sx={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: '50%',
                                  bgcolor: option.color,
                                  ml: 1,
                                }}
                              />
                            )}
                          </li>
                        );
                      }}
                    />
                  )}
                />

                {/* Participants (multi-select) */}
                <Controller
                  name="familyAssignments.participantFamilyMemberIds"
                  control={control}
                  render={({ field }) => {
                    // Get current primary member to exclude from participants
                    const primaryMemberId = values.familyAssignments?.primaryFamilyMemberId;
                    
                    // Filter out primary member from available options
                    const availableMembers = primaryMemberId
                      ? familyMembers.filter((m) => m.id !== primaryMemberId)
                      : familyMembers;

                    // Also remove primary member from current selection if they were selected
                    const filteredValue = (field.value || []).filter(
                      (id: string) => id !== primaryMemberId
                    );
                    if (filteredValue.length !== (field.value || []).length) {
                      // Primary was in participants, remove them
                      field.onChange(filteredValue);
                    }

                    const selectedMembers = filteredValue
                      .map((id: string) => memberById.get(id))
                      .filter((m): m is FamilyMember => !!m);

                    const allSelected = selectedMembers.length === availableMembers.length && availableMembers.length > 0;

                    return (
                      <Box>
                        <Autocomplete
                          multiple
                          value={selectedMembers}
                          onChange={(_, newValue) => {
                            field.onChange(newValue.map((m) => m.id));
                          }}
                          options={availableMembers}
                          getOptionLabel={(option) => getMemberDisplayName(option)}
                          isOptionEqualToValue={(option, value) => option.id === value.id}
                          disableCloseOnSelect
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Participants"
                              placeholder="Who is participating?"
                              size="small"
                            />
                          )}
                          renderOption={(props, option, { selected }) => {
                            const { key, ...otherProps } = props;
                            return (
                              <li key={key} {...otherProps}>
                                <Avatar
                                  alt={getMemberDisplayName(option)}
                                  src={option.profile?.avatarUrl || undefined}
                                  sx={{ mr: 1, width: 24, height: 24, flexShrink: 0 }}
                                />
                                <Box component="span" sx={{ flexGrow: 1 }}>
                                  {getMemberDisplayName(option)}
                                </Box>
                                {selected && (
                                  <Iconify icon="eva:checkmark-fill" sx={{ color: 'primary.main' }} />
                                )}
                              </li>
                            );
                          }}
                          renderTags={(selected, getTagProps) =>
                            selected.map((option, index) => (
                              <Chip
                                {...getTagProps({ index })}
                                key={option.id}
                                label={getMemberDisplayName(option)}
                                avatar={
                                  <Avatar
                                    alt={getMemberDisplayName(option)}
                                    src={option.profile?.avatarUrl || undefined}
                                  />
                                }
                                size="small"
                                variant="soft"
                              />
                            ))
                          }
                        />
                        <Button
                          size="small"
                          onClick={() => {
                            if (allSelected) {
                              field.onChange([]);
                            } else {
                              field.onChange(availableMembers.map((m) => m.id));
                            }
                          }}
                          sx={{ mt: 0.5 }}
                        >
                          {allSelected ? 'Clear all' : 'Add all'}
                        </Button>
                      </Box>
                    );
                  }}
                />
              </Stack>
            </Box>
          )}

          {/* E1: Event Metadata Section */}
          <Divider sx={{ borderStyle: 'dashed' }} />
          
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              Event Details
            </Typography>

            <Stack spacing={2}>
              {/* Category */}
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    fullWidth
                    label="Category"
                    size="small"
                    value={field.value || ''}
                    onChange={(e) => {
                      const newCategory = e.target.value || null;
                      field.onChange(newCategory);
                      // Clear category-specific metadata when category changes
                      if (newCategory !== values.category) {
                        setValue('categoryMetadata', null);
                      }
                    }}
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {EVENT_CATEGORIES.map((cat) => (
                      <MenuItem key={cat.value} value={cat.value}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Iconify icon={cat.icon as any} width={20} />
                          <span>{cat.label}</span>
                        </Stack>
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />

              {/* Audience */}
              <Controller
                name="audience"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    fullWidth
                    label="Who should see this?"
                    size="small"
                    value={field.value || 'family'}
                  >
                    {EVENT_AUDIENCES.map((aud) => (
                      <MenuItem key={aud.value} value={aud.value}>
                        {aud.label}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />

              {/* Tags */}
              <Controller
                name="tags"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    multiple
                    freeSolo
                    options={[]}
                    value={field.value || []}
                    onChange={(_, newValue) => {
                      // Limit to 20 tags and filter out empty strings
                      const filtered = newValue
                        .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
                        .slice(0, 20);
                      field.onChange(filtered);
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Tags"
                        placeholder="Add tags..."
                        size="small"
                        helperText="Press Enter to add a tag"
                      />
                    )}
                    renderTags={(selected, getTagProps) =>
                      selected.map((tag, index) => (
                        <Chip
                          {...getTagProps({ index })}
                          key={tag}
                          label={tag}
                          size="small"
                          variant="soft"
                          color="primary"
                        />
                      ))
                    }
                  />
                )}
              />

              {/* E1: Category-specific metadata sections */}
              {values.category === 'Meal' && (
                <Box sx={{ pl: 2, borderLeft: 2, borderColor: 'primary.light' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Meal Details
                  </Typography>
                  <Stack spacing={1.5}>
                    <Controller
                      name="categoryMetadata.mealType"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          select
                          fullWidth
                          label="Meal type"
                          size="small"
                          value={field.value || ''}
                        >
                          <MenuItem value=""><em>None</em></MenuItem>
                          <MenuItem value="breakfast">Breakfast</MenuItem>
                          <MenuItem value="lunch">Lunch</MenuItem>
                          <MenuItem value="dinner">Dinner</MenuItem>
                          <MenuItem value="snack">Snack</MenuItem>
                        </TextField>
                      )}
                    />
                    <Controller
                      name="categoryMetadata.cuisine"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Cuisine"
                          placeholder="e.g., Italian, Mexican..."
                          size="small"
                          value={field.value || ''}
                        />
                      )}
                    />
                    <Controller
                      name="categoryMetadata.recipeUrl"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Recipe URL"
                          placeholder="https://..."
                          size="small"
                          value={field.value || ''}
                        />
                      )}
                    />
                  </Stack>
                </Box>
              )}

              {values.category === 'School' && (
                <Box sx={{ pl: 2, borderLeft: 2, borderColor: 'info.light' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    School Details
                  </Typography>
                  <Stack spacing={1.5}>
                    <Controller
                      name="categoryMetadata.subject"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Subject"
                          placeholder="e.g., Math, Science..."
                          size="small"
                          value={field.value || ''}
                        />
                      )}
                    />
                    <Controller
                      name="categoryMetadata.teacher"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Teacher"
                          size="small"
                          value={field.value || ''}
                        />
                      )}
                    />
                  </Stack>
                </Box>
              )}

              {values.category === 'Sport' && (
                <Box sx={{ pl: 2, borderLeft: 2, borderColor: 'success.light' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Sport Details
                  </Typography>
                  <Stack spacing={1.5}>
                    <Controller
                      name="categoryMetadata.sportType"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Sport"
                          placeholder="e.g., Soccer, Basketball..."
                          size="small"
                          value={field.value || ''}
                        />
                      )}
                    />
                    <Controller
                      name="categoryMetadata.team"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Team"
                          size="small"
                          value={field.value || ''}
                        />
                      )}
                    />
                    <Stack direction="row" spacing={2}>
                      <Controller
                        name="categoryMetadata.isGame"
                        control={control}
                        render={({ field }) => (
                          <FormControlLabel
                            control={<Switch checked={Boolean(field.value)} onChange={field.onChange} size="small" />}
                            label="Game"
                          />
                        )}
                      />
                      <Controller
                        name="categoryMetadata.isPractice"
                        control={control}
                        render={({ field }) => (
                          <FormControlLabel
                            control={<Switch checked={Boolean(field.value)} onChange={field.onChange} size="small" />}
                            label="Practice"
                          />
                        )}
                      />
                    </Stack>
                    <Controller
                      name="categoryMetadata.opponent"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Opponent"
                          size="small"
                          value={field.value || ''}
                        />
                      )}
                    />
                  </Stack>
                </Box>
              )}

              {values.category === 'Chore' && (
                <Box sx={{ pl: 2, borderLeft: 2, borderColor: 'warning.light' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Chore Details
                  </Typography>
                  <Stack spacing={1.5}>
                    <Controller
                      name="categoryMetadata.frequency"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          select
                          fullWidth
                          label="Frequency"
                          size="small"
                          value={field.value || ''}
                        >
                          <MenuItem value=""><em>None</em></MenuItem>
                          <MenuItem value="daily">Daily</MenuItem>
                          <MenuItem value="weekly">Weekly</MenuItem>
                          <MenuItem value="monthly">Monthly</MenuItem>
                          <MenuItem value="as-needed">As needed</MenuItem>
                        </TextField>
                      )}
                    />
                    <Controller
                      name="categoryMetadata.points"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Points"
                          type="number"
                          size="small"
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                          slotProps={{ htmlInput: { min: 0 } }}
                        />
                      )}
                    />
                  </Stack>
                </Box>
              )}

              {values.category === 'Appointment' && (
                <Box sx={{ pl: 2, borderLeft: 2, borderColor: 'secondary.light' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Appointment Details
                  </Typography>
                  <Stack spacing={1.5}>
                    <Controller
                      name="categoryMetadata.appointmentType"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          select
                          fullWidth
                          label="Type"
                          size="small"
                          value={field.value || ''}
                        >
                          <MenuItem value=""><em>None</em></MenuItem>
                          <MenuItem value="medical">Medical</MenuItem>
                          <MenuItem value="dental">Dental</MenuItem>
                          <MenuItem value="vision">Vision</MenuItem>
                          <MenuItem value="therapy">Therapy</MenuItem>
                          <MenuItem value="consultation">Consultation</MenuItem>
                          <MenuItem value="other">Other</MenuItem>
                        </TextField>
                      )}
                    />
                    <Controller
                      name="categoryMetadata.provider"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Provider"
                          placeholder="Doctor, clinic name..."
                          size="small"
                          value={field.value || ''}
                        />
                      )}
                    />
                    <Controller
                      name="categoryMetadata.phone"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Phone"
                          size="small"
                          value={field.value || ''}
                        />
                      )}
                    />
                  </Stack>
                </Box>
              )}

              {values.category === 'Travel' && (
                <Box sx={{ pl: 2, borderLeft: 2, borderColor: 'info.light' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Travel Details
                  </Typography>
                  <Stack spacing={1.5}>
                    <Controller
                      name="categoryMetadata.destination"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Destination"
                          size="small"
                          value={field.value || ''}
                        />
                      )}
                    />
                    <Controller
                      name="categoryMetadata.transportMode"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          select
                          fullWidth
                          label="Transport"
                          size="small"
                          value={field.value || ''}
                        >
                          <MenuItem value=""><em>None</em></MenuItem>
                          <MenuItem value="car">Car</MenuItem>
                          <MenuItem value="plane">Plane</MenuItem>
                          <MenuItem value="train">Train</MenuItem>
                          <MenuItem value="bus">Bus</MenuItem>
                          <MenuItem value="boat">Boat</MenuItem>
                          <MenuItem value="other">Other</MenuItem>
                        </TextField>
                      )}
                    />
                    <Controller
                      name="categoryMetadata.confirmationNumber"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Confirmation #"
                          size="small"
                          value={field.value || ''}
                        />
                      )}
                    />
                  </Stack>
                </Box>
              )}

              {values.category === 'Home' && (
                <Box sx={{ pl: 2, borderLeft: 2, borderColor: 'warning.light' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Home Details
                  </Typography>
                  <Stack spacing={1.5}>
                    <Controller
                      name="categoryMetadata.area"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Area"
                          placeholder="e.g., Kitchen, Garage..."
                          size="small"
                          value={field.value || ''}
                        />
                      )}
                    />
                    <Controller
                      name="categoryMetadata.priority"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          select
                          fullWidth
                          label="Priority"
                          size="small"
                          value={field.value || ''}
                        >
                          <MenuItem value=""><em>None</em></MenuItem>
                          <MenuItem value="low">Low</MenuItem>
                          <MenuItem value="medium">Medium</MenuItem>
                          <MenuItem value="high">High</MenuItem>
                          <MenuItem value="urgent">Urgent</MenuItem>
                        </TextField>
                      )}
                    />
                    <Controller
                      name="categoryMetadata.contractor"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Contractor"
                          size="small"
                          value={field.value || ''}
                        />
                      )}
                    />
                  </Stack>
                </Box>
              )}

              {values.category === 'Admin' && (
                <Box sx={{ pl: 2, borderLeft: 2, borderColor: 'grey.400' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Admin Details
                  </Typography>
                  <Stack spacing={1.5}>
                    <Controller
                      name="categoryMetadata.documentType"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Document type"
                          placeholder="e.g., Tax return, Insurance..."
                          size="small"
                          value={field.value || ''}
                        />
                      )}
                    />
                    <Controller
                      name="categoryMetadata.organization"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Organization"
                          size="small"
                          value={field.value || ''}
                        />
                      )}
                    />
                    <Controller
                      name="categoryMetadata.deadline"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Deadline"
                          type="date"
                          size="small"
                          value={field.value || ''}
                          slotProps={{ inputLabel: { shrink: true } }}
                        />
                      )}
                    />
                  </Stack>
                </Box>
              )}
            </Stack>
          </Box>
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

      {/* Custom Recurrence Dialog */}
      <Dialog
        open={showCustomRecurrence}
        onClose={() => setShowCustomRecurrence(false)}
        maxWidth="xs"
        fullWidth
        disableEnforceFocus
        disableRestoreFocus
      >
        <DialogTitle>Custom recurrence</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            {/* Frequency and Interval */}
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body2" sx={{ flexShrink: 0 }}>
                Repeat every
              </Typography>
              <TextField
                type="number"
                size="small"
                value={customRecurrence.interval}
                onChange={(e) =>
                  setCustomRecurrence((prev) => ({
                    ...prev,
                    interval: Math.max(1, parseInt(e.target.value, 10) || 1),
                  }))
                }
                slotProps={{ htmlInput: { min: 1, max: 99 } }}
                sx={{ width: 70 }}
              />
              <TextField
                select
                size="small"
                value={customRecurrence.frequency}
                onChange={(e) =>
                  setCustomRecurrence((prev) => ({
                    ...prev,
                    frequency: e.target.value as RecurrenceFrequency,
                    byDay: e.target.value !== 'WEEKLY' ? [] : prev.byDay,
                  }))
                }
                sx={{ minWidth: 100 }}
              >
                <MenuItem value="DAILY">day(s)</MenuItem>
                <MenuItem value="WEEKLY">week(s)</MenuItem>
                <MenuItem value="MONTHLY">month(s)</MenuItem>
                <MenuItem value="YEARLY">year(s)</MenuItem>
              </TextField>
            </Stack>

            {/* Days of Week (only for weekly) */}
            {customRecurrence.frequency === 'WEEKLY' && (
              <Box>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Repeat on
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {DAYS_OF_WEEK.map((day) => (
                    <Chip
                      key={day.value}
                      label={day.label}
                      size="small"
                      onClick={() => handleToggleDay(day.value)}
                      color={customRecurrence.byDay.includes(day.value) ? 'primary' : 'default'}
                      variant={customRecurrence.byDay.includes(day.value) ? 'filled' : 'outlined'}
                      sx={{ minWidth: 48 }}
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {/* End condition */}
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Ends
              </Typography>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <TextField
                    select
                    size="small"
                    value={customRecurrence.endType}
                    onChange={(e) =>
                      setCustomRecurrence((prev) => ({
                        ...prev,
                        endType: e.target.value as 'never' | 'count' | 'until',
                      }))
                    }
                    sx={{ minWidth: 120 }}
                  >
                    <MenuItem value="never">Never</MenuItem>
                    <MenuItem value="count">After</MenuItem>
                    <MenuItem value="until">On date</MenuItem>
                  </TextField>

                  {customRecurrence.endType === 'count' && (
                    <>
                      <TextField
                        type="number"
                        size="small"
                        value={customRecurrence.count}
                        onChange={(e) =>
                          setCustomRecurrence((prev) => ({
                            ...prev,
                            count: Math.max(1, parseInt(e.target.value, 10) || 1),
                          }))
                        }
                        slotProps={{ htmlInput: { min: 1, max: 999 } }}
                        sx={{ width: 70 }}
                      />
                      <Typography variant="body2">occurrences</Typography>
                    </>
                  )}

                  {customRecurrence.endType === 'until' && (
                    <TextField
                      type="date"
                      size="small"
                      value={customRecurrence.until}
                      onChange={(e) =>
                        setCustomRecurrence((prev) => ({
                          ...prev,
                          until: e.target.value,
                        }))
                      }
                      sx={{ minWidth: 150 }}
                    />
                  )}
                </Stack>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCustomRecurrence(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleSaveCustomRecurrence} variant="contained">
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Form>
  );
}
