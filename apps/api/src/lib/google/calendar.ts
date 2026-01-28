import { google, calendar_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { RecurrenceRule, EventReminder } from '../../routes/calendar/schema.js';

export function getCalendarClient(auth: OAuth2Client) {
  return google.calendar({ version: 'v3', auth });
}

export async function listCalendars(auth: OAuth2Client) {
  const calendar = getCalendarClient(auth);
  const response = await calendar.calendarList.list();
  return response.data.items ?? [];
}

export async function listEvents(options: {
  auth: OAuth2Client;
  calendarId: string;
  timeMin: string;
  timeMax: string;
}) {
  const calendar = getCalendarClient(options.auth);
  const allEvents: calendar_v3.Schema$Event[] = [];
  let pageToken: string | undefined;

  do {
    const response = await calendar.events.list({
      calendarId: options.calendarId,
      timeMin: options.timeMin,
      timeMax: options.timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500,
      pageToken,
    });

    allEvents.push(...(response.data.items ?? []));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return allEvents;
}

/**
 * Convert a RecurrenceRule object to a Google Calendar RRULE string
 * https://developers.google.com/calendar/api/concepts/events-calendars#recurring_events
 */
export function buildRRule(rule: RecurrenceRule): string {
  if (!rule) return '';
  
  const parts: string[] = [`FREQ=${rule.frequency}`];
  
  if (rule.interval && rule.interval > 1) {
    parts.push(`INTERVAL=${rule.interval}`);
  }
  
  if (rule.count) {
    parts.push(`COUNT=${rule.count}`);
  } else if (rule.until) {
    // Google Calendar expects UNTIL in UTC format without separators
    const untilDate = new Date(rule.until).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    parts.push(`UNTIL=${untilDate}`);
  }
  
  if (rule.byDay && rule.byDay.length > 0) {
    parts.push(`BYDAY=${rule.byDay.join(',')}`);
  }
  
  if (rule.byMonthDay && rule.byMonthDay.length > 0) {
    parts.push(`BYMONTHDAY=${rule.byMonthDay.join(',')}`);
  }
  
  if (rule.byMonth && rule.byMonth.length > 0) {
    parts.push(`BYMONTH=${rule.byMonth.join(',')}`);
  }
  
  return `RRULE:${parts.join(';')}`;
}

/**
 * Parse a Google Calendar RRULE string into a RecurrenceRule object
 */
export function parseRRule(rruleString: string): RecurrenceRule | null {
  if (!rruleString || !rruleString.startsWith('RRULE:')) return null;
  
  const rule = rruleString.replace('RRULE:', '');
  const parts = rule.split(';');
  const result: RecurrenceRule = {} as RecurrenceRule;
  
  for (const part of parts) {
    const [key, value] = part.split('=');
    switch (key) {
      case 'FREQ':
        result.frequency = value as RecurrenceRule['frequency'];
        break;
      case 'INTERVAL':
        result.interval = parseInt(value, 10);
        break;
      case 'COUNT':
        result.count = parseInt(value, 10);
        break;
      case 'UNTIL':
        // Convert YYYYMMDDTHHMMSSZ to ISO string
        const year = value.slice(0, 4);
        const month = value.slice(4, 6);
        const day = value.slice(6, 8);
        const hour = value.slice(9, 11) || '00';
        const minute = value.slice(11, 13) || '00';
        const second = value.slice(13, 15) || '00';
        result.until = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
        break;
      case 'BYDAY':
        result.byDay = value.split(',');
        break;
      case 'BYMONTHDAY':
        result.byMonthDay = value.split(',').map((v) => parseInt(v, 10));
        break;
      case 'BYMONTH':
        result.byMonth = value.split(',').map((v) => parseInt(v, 10));
        break;
    }
  }
  
  return result.frequency ? result : null;
}

/**
 * Convert EventReminder array to Google Calendar reminder format
 */
export function buildGoogleReminders(reminders: EventReminder[] | null | undefined): calendar_v3.Schema$EventReminders | undefined {
  if (!reminders || reminders.length === 0) {
    return undefined;
  }
  
  return {
    useDefault: false,
    overrides: reminders.map((r) => ({
      method: r.method,
      minutes: r.minutes,
    })),
  };
}

/**
 * Parse Google Calendar reminders into EventReminder array
 */
export function parseGoogleReminders(reminders: calendar_v3.Schema$EventReminders | undefined): EventReminder[] | null {
  if (!reminders || reminders.useDefault || !reminders.overrides) {
    return null;
  }
  
  return reminders.overrides.map((r) => ({
    method: (r.method as 'email' | 'popup') || 'popup',
    minutes: r.minutes || 0,
  }));
}

export async function createEvent(options: {
  auth: OAuth2Client;
  calendarId: string;
  event: calendar_v3.Schema$Event;
  recurrence?: RecurrenceRule | null;
  reminders?: EventReminder[] | null;
}) {
  const calendar = getCalendarClient(options.auth);
  
  const requestBody: calendar_v3.Schema$Event = {
    ...options.event,
  };
  
  // Add recurrence if provided
  if (options.recurrence) {
    requestBody.recurrence = [buildRRule(options.recurrence)];
  }
  
  // Add reminders if provided
  const googleReminders = buildGoogleReminders(options.reminders);
  if (googleReminders) {
    requestBody.reminders = googleReminders;
  }
  
  const response = await calendar.events.insert({
    calendarId: options.calendarId,
    requestBody,
  });
  return response.data;
}

export async function updateEvent(options: {
  auth: OAuth2Client;
  calendarId: string;
  eventId: string;
  event: calendar_v3.Schema$Event;
  recurrence?: RecurrenceRule | null;
  reminders?: EventReminder[] | null;
}) {
  const calendar = getCalendarClient(options.auth);
  
  const requestBody: calendar_v3.Schema$Event = {
    ...options.event,
  };
  
  // Add recurrence if provided (or clear it)
  if (options.recurrence !== undefined) {
    requestBody.recurrence = options.recurrence ? [buildRRule(options.recurrence)] : [];
  }
  
  // Add reminders if provided
  const googleReminders = buildGoogleReminders(options.reminders);
  if (googleReminders) {
    requestBody.reminders = googleReminders;
  }
  
  const response = await calendar.events.patch({
    calendarId: options.calendarId,
    eventId: options.eventId,
    requestBody,
  });
  return response.data;
}

export async function deleteEvent(options: {
  auth: OAuth2Client;
  calendarId: string;
  eventId: string;
}) {
  const calendar = getCalendarClient(options.auth);
  await calendar.events.delete({
    calendarId: options.calendarId,
    eventId: options.eventId,
  });
}
