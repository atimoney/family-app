import type { OAuth2Client } from 'google-auth-library';
import type { PrismaClient, SelectedCalendar, GoogleAccount } from '@prisma/client';
import { google, calendar_v3 } from 'googleapis';

import { decryptSecret } from '../crypto.js';
import { parseEventTimes, withRetry } from './sync-utils.js';
import { refreshAccessToken } from './token-refresh.js';

// ============================================================================
// TYPES
// ============================================================================

export type SyncSummary = {
  synced: number;
  created: number;
  updated: number;
  deleted: number;
  failed: number;
  fullSync: boolean;
  calendarsProcessed: number;
  nextSyncToken?: string;
};

export type SyncCalendarResult = {
  synced: number;
  created: number;
  updated: number;
  deleted: number;
  failed: number;
  fullSync: boolean;
  nextSyncToken?: string;
};

type Logger = {
  info: (payload: unknown, message: string) => void;
  warn: (payload: unknown, message: string) => void;
  error: (payload: unknown, message: string) => void;
};

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_SYNC_WINDOW_DAYS_PAST = 90;
const DEFAULT_SYNC_WINDOW_DAYS_FUTURE = 365;

// ============================================================================
// HELPERS
// ============================================================================

function getCalendarClient(auth: OAuth2Client) {
  return google.calendar({ version: 'v3', auth });
}

// ============================================================================
// MAIN SYNC FUNCTION
// ============================================================================

export async function syncGoogleCalendar(options: {
  prisma: PrismaClient;
  userId: string;
  oauthClient: OAuth2Client;
  encryptionKey: string;
  calendarId?: string; // Optional: sync only a specific calendar
  forceFullSync?: boolean;
  logger?: Logger;
}): Promise<SyncSummary> {
  const { prisma, userId, oauthClient, encryptionKey, forceFullSync, logger } = options;

  // 1. Get the user's Google account with refresh token
  const googleAccount = await prisma.googleAccount.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });

  if (!googleAccount) {
    throw new Error('Google account not connected');
  }

  // 2. Get valid access token using refresh token
  const refreshToken = decryptSecret(googleAccount.refreshToken, encryptionKey);
  let accessToken: string;

  try {
    const refreshed = await refreshAccessToken({
      oauthClient,
      refreshToken,
    });
    accessToken = refreshed.accessToken;
  } catch (err) {
    logger?.warn({ err, userId }, 'Google token refresh failed');
    throw err;
  }

  oauthClient.setCredentials({ access_token: accessToken });
  const calendar = getCalendarClient(oauthClient);

  // 3. Get selected calendars to sync
  let selectedCalendars: SelectedCalendar[];

  if (options.calendarId) {
    const single = await prisma.selectedCalendar.findUnique({
      where: { userId_calendarId: { userId, calendarId: options.calendarId } },
    });
    selectedCalendars = single ? [single] : [];
  } else {
    selectedCalendars = await prisma.selectedCalendar.findMany({
      where: { userId, isVisible: true },
    });
  }

  // If no calendars selected, sync primary calendar
  if (selectedCalendars.length === 0) {
    logger?.info({ userId }, 'No calendars selected, syncing primary calendar');

    // Create a default SelectedCalendar for primary
    const primaryCalendar = await prisma.selectedCalendar.upsert({
      where: { userId_calendarId: { userId, calendarId: 'primary' } },
      create: {
        userId,
        googleAccountId: googleAccount.id,
        calendarId: 'primary',
        summary: 'Primary Calendar',
        isVisible: true,
      },
      update: {},
    });
    selectedCalendars = [primaryCalendar];
  }

  // 4. Sync each selected calendar
  const summary: SyncSummary = {
    synced: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    failed: 0,
    fullSync: forceFullSync ?? false,
    calendarsProcessed: 0,
  };

  for (const selectedCalendar of selectedCalendars) {
    try {
      const result = await syncSingleCalendar({
        prisma,
        userId,
        googleAccount,
        selectedCalendar,
        calendar,
        forceFullSync,
        logger,
      });

      summary.synced += result.synced;
      summary.created += result.created;
      summary.updated += result.updated;
      summary.deleted += result.deleted;
      summary.failed += result.failed;
      summary.fullSync = summary.fullSync || result.fullSync;
      summary.calendarsProcessed += 1;

      if (result.nextSyncToken) {
        summary.nextSyncToken = result.nextSyncToken;
      }
    } catch (err) {
      logger?.error({ err, calendarId: selectedCalendar.calendarId }, 'Failed to sync calendar');
      summary.failed += 1;
    }
  }

  return summary;
}

// ============================================================================
// SINGLE CALENDAR SYNC
// ============================================================================

async function syncSingleCalendar(options: {
  prisma: PrismaClient;
  userId: string;
  googleAccount: GoogleAccount;
  selectedCalendar: SelectedCalendar;
  calendar: calendar_v3.Calendar;
  forceFullSync?: boolean;
  logger?: Logger;
}): Promise<SyncCalendarResult> {
  const { prisma, userId, googleAccount, selectedCalendar, calendar, forceFullSync, logger } =
    options;
  const { calendarId } = selectedCalendar;

  // Use stored sync token for incremental sync (unless forced full sync)
  let syncToken = forceFullSync ? undefined : (selectedCalendar.syncToken ?? undefined);
  let nextSyncToken: string | undefined;
  let pageToken: string | undefined;
  let fullSync = !syncToken;

  const result: SyncCalendarResult = {
    synced: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    failed: 0,
    fullSync,
  };

  // Calculate time window for full sync
  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setDate(timeMin.getDate() - DEFAULT_SYNC_WINDOW_DAYS_PAST);
  const timeMax = new Date(now);
  timeMax.setDate(timeMax.getDate() + DEFAULT_SYNC_WINDOW_DAYS_FUTURE);

  logger?.info({ userId, calendarId, fullSync, hasSyncToken: !!syncToken }, 'Starting calendar sync');

  // Process paginated results
  do {
    try {
      const response = await withRetry(() =>
        calendar.events.list({
          calendarId,
          singleEvents: true,
          showDeleted: true,
          maxResults: 2500,
          pageToken,
          ...(syncToken
            ? { syncToken }
            : {
                timeMin: timeMin.toISOString(),
                timeMax: timeMax.toISOString(),
              }),
        })
      );

      const items = response.data.items ?? [];
      result.synced += items.length;

      // Track seen event IDs to handle duplicates in batch
      const seen = new Set<string>();

      for (const event of items) {
        if (!event.id) continue;
        if (seen.has(event.id)) continue;
        seen.add(event.id);

        try {
          const eventResult = await processEvent({
            prisma,
            userId,
            googleAccountId: googleAccount.id,
            calendarId,
            event,
            logger,
          });

          if (eventResult === 'created') result.created += 1;
          else if (eventResult === 'updated') result.updated += 1;
          else if (eventResult === 'deleted') result.deleted += 1;
        } catch (err) {
          result.failed += 1;
          logger?.warn({ err, eventId: event.id }, 'Failed to process event');
        }
      }

      pageToken = response.data.nextPageToken ?? undefined;
      nextSyncToken = response.data.nextSyncToken ?? nextSyncToken;
    } catch (err: unknown) {
      const error = err as { code?: number; response?: { status?: number } };

      // Handle 410 Gone - sync token expired, need full sync
      if (error.code === 410 || error.response?.status === 410) {
        logger?.info({ userId, calendarId }, 'Sync token expired, performing full sync');
        syncToken = undefined;
        pageToken = undefined;
        fullSync = true;
        result.fullSync = true;
        continue;
      }

      logger?.error({ err, userId, calendarId }, 'Calendar sync failed');
      throw err;
    }
  } while (pageToken);

  // Update sync token in SelectedCalendar
  if (nextSyncToken) {
    await prisma.selectedCalendar.update({
      where: { id: selectedCalendar.id },
      data: {
        syncToken: nextSyncToken,
        lastSyncedAt: new Date(),
      },
    });
    result.nextSyncToken = nextSyncToken;
  }

  logger?.info({ userId, calendarId, ...result }, 'Calendar sync completed');

  return result;
}

// ============================================================================
// PROCESS SINGLE EVENT
// ============================================================================

type ProcessEventResult = 'created' | 'updated' | 'deleted' | 'skipped';

async function processEvent(options: {
  prisma: PrismaClient;
  userId: string;
  googleAccountId: string;
  calendarId: string;
  event: calendar_v3.Schema$Event;
  logger?: Logger;
}): Promise<ProcessEventResult> {
  const { prisma, userId, googleAccountId, calendarId, event, logger } = options;

  if (!event.id) return 'skipped';

  // Check if event is cancelled/deleted
  const isCancelled =
    event.status === 'cancelled' || (event as { deleted?: boolean }).deleted === true;

  // Parse event times
  const parsedTimes = parseEventTimes({
    start: event.start ?? null,
    end: event.end ?? null,
  });

  // Handle cancelled events
  if (isCancelled) {
    const deleted = await prisma.calendarEvent.updateMany({
      where: {
        userId,
        googleEventId: event.id,
      },
      data: {
        status: 'cancelled',
        deletedAt: new Date(),
      },
    });
    return deleted.count > 0 ? 'deleted' : 'skipped';
  }

  // Skip events without valid times
  if (!parsedTimes.startsAt || !parsedTimes.endsAt) {
    logger?.warn({ eventId: event.id }, 'Event has invalid times, skipping');
    return 'skipped';
  }

  // Upsert the event
  const existingEvent = await prisma.calendarEvent.findUnique({
    where: { userId_googleEventId: { userId, googleEventId: event.id } },
  });

  const eventData = {
    userId,
    googleAccountId,
    calendarId,
    googleEventId: event.id,
    startsAt: parsedTimes.startsAt,
    endsAt: parsedTimes.endsAt,
    title: event.summary ?? '(No title)',
    description: event.description ?? null,
    location: event.location ?? null,
    allDay: parsedTimes.allDay,
    status: event.status ?? null,
    recurringEventId: event.recurringEventId ?? null,
    rawJson: event as object,
    deletedAt: null,
  };

  if (existingEvent) {
    await prisma.calendarEvent.update({
      where: { id: existingEvent.id },
      data: eventData,
    });
    return 'updated';
  } else {
    await prisma.calendarEvent.create({
      data: eventData,
    });
    return 'created';
  }
}

// ============================================================================
// UTILITY: Clear sync state (for debugging/reset)
// ============================================================================

export async function clearSyncState(options: {
  prisma: PrismaClient;
  userId: string;
  calendarId?: string;
}): Promise<void> {
  const { prisma, userId, calendarId } = options;

  if (calendarId) {
    await prisma.selectedCalendar.updateMany({
      where: { userId, calendarId },
      data: { syncToken: null, lastSyncedAt: null },
    });
    await prisma.calendarEvent.deleteMany({
      where: { userId, calendarId },
    });
  } else {
    await prisma.selectedCalendar.updateMany({
      where: { userId },
      data: { syncToken: null, lastSyncedAt: null },
    });
    await prisma.calendarEvent.deleteMany({
      where: { userId },
    });
  }
}
