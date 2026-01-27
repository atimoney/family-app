import { google, calendar_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

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
  const response = await calendar.events.list({
    calendarId: options.calendarId,
    timeMin: options.timeMin,
    timeMax: options.timeMax,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return response.data.items ?? [];
}

export async function createEvent(options: {
  auth: OAuth2Client;
  calendarId: string;
  event: calendar_v3.Schema$Event;
}) {
  const calendar = getCalendarClient(options.auth);
  const response = await calendar.events.insert({
    calendarId: options.calendarId,
    requestBody: options.event,
  });
  return response.data;
}

export async function updateEvent(options: {
  auth: OAuth2Client;
  calendarId: string;
  eventId: string;
  event: calendar_v3.Schema$Event;
}) {
  const calendar = getCalendarClient(options.auth);
  const response = await calendar.events.patch({
    calendarId: options.calendarId,
    eventId: options.eventId,
    requestBody: options.event,
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
