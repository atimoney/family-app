export type FamilyMember = {
  id: string;
  name: string;
  avatarUrl?: string;
  role?: string;
};

export type TaskStatus = 'todo' | 'doing' | 'done';

export type Task = {
  id: string;
  title: string;
  assigneeId?: string;
  dueDate?: string;
  status?: TaskStatus;
  completed?: boolean;
  createdAt: string;
};

// Recurrence rule type
export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  interval?: number; // e.g., every 2 weeks
  count?: number; // number of occurrences
  until?: string; // end date ISO string
  byDay?: string[]; // e.g., ['MO', 'WE', 'FR'] for weekly
  byMonthDay?: number[]; // e.g., [1, 15] for monthly on 1st and 15th
  byMonth?: number[]; // e.g., [1, 6] for yearly in Jan and June
};

// Reminder type
export type ReminderMethod = 'email' | 'popup';

export type EventReminder = {
  method: ReminderMethod;
  minutes: number; // minutes before event
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  calendarId?: string;
  description?: string | null;
  location?: string | null;
  recurrence?: RecurrenceRule | null;
  reminders?: EventReminder[] | null;
  extraData?: CalendarEventExtraDataV1;
};

export type CalendarEventExtraDataV1 = {
  tags: string[];
  category: string | null;
  notes: string | null;
  color?: string | null;
};

export type ShoppingItem = {
  id: string;
  name: string;
  quantity?: string;
  category?: string;
  purchased: boolean;
};
