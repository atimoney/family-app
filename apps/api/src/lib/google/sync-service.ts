import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

import { decryptSecret } from '../crypto.js';
import { parseEventTimes, withRetry } from './sync-utils.js';
import { refreshAccessToken } from './token-refresh.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClientAny = any;

export type SyncSummary = {
  synced: number;
  created: number;
  updated: number;
  deleted: number;
  failed: number;
  fullSync: boolean;
  nextSyncToken?: string;
};

const DEFAULT_SYNC_WINDOW_DAYS_PAST = 90;
const DEFAULT_SYNC_WINDOW_DAYS_FUTURE = 365;

type SyncState = {
  syncToken?: string;
  lastSyncedAt?: string;
};

function getCalendarClient(auth: OAuth2Client) {
  return google.calendar({ version: 'v3', auth });
}

function getSyncState(raw: unknown): SyncState {
  if (raw && typeof raw === 'object') {
    return raw as SyncState;
  }
  return {};
}

export async function syncGoogleCalendar(options: {
  prisma: PrismaClientAny;
  userId: string;
  oauthClient: OAuth2Client;
  encryptionKey: string;
  calendarId?: string;
  forceFullSync?: boolean;
  logger?: { info: (payload: unknown, message: string) => void; warn: (payload: unknown, message: string) => void };
}): Promise<SyncSummary> {
  const logger = options.logger;
  
  // Get the Google account with refresh token
  const googleAccount = await options.prisma.googleAccount.findFirst({
    where: { userId: options.userId },
    orderBy: { updatedAt: 'desc' },
  });

  if (!googleAccount) {
    throw new Error('Google account not connected');
  }

  // Get valid access token using refresh token
  const refreshToken = decryptSecret(googleAccount.refreshToken, options.encryptionKey);
  let accessToken: string;
  
  try {
    const refreshed = await refreshAccessToken({
      oauthClient: options.oauthClient,
      refreshToken,
    });
    accessToken = refreshed.accessToken;
  } catch (err) {
    // Failure mode: refresh token expired or access revoked by user.
    logger?.warn({ err, userId: options.userId }, 'Google token refresh failed');
    throw err;
  }

  options.oauthClient.setCredentials({ access_token: accessToken });

  const calendar = getCalendarClient(options.oauthClient);
  
  // Get selected calendars or use provided calendarId or default to primary
  let calendarIds: string[] = [];
  if (options.calendarId) {
    calendarIds = [options.calendarId];
  } else {
    const selectedCalendars = await options.prisma.selectedCalendar.findMany({
      where: { userId: options.userId, isVisible: true },
    });
    calendarIds = selectedCalendars.length > 0 
      ? selectedCalendars.map((sc: { calendarId: string }) => sc.calendarId)
      : ['primary'];
  }

  // Aggregate summary across all calendars
  const summary: SyncSummary = {
    synced: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    failed: 0,
    fullSync: options.forceFullSync ?? false,
  };

  // Sync each selected calendar
  for (const calendarId of calendarIds) {
    const calendarSummary = await syncSingleCalendar({
      prisma: options.prisma,
      userId: options.userId,
      googleAccountId: googleAccount.id,
      calendar,
      calendarId,
      forceFullSync: options.forceFullSync,
      logger,
    });

    summary.synced += calendarSummary.synced;
    summary.created += calendarSummary.created;
    summary.updated += calendarSummary.updated;
    summary.deleted += calendarSummary.deleted;
    summary.failed += calendarSummary.failed;
    summary.fullSync = summary.fullSync || calendarSummary.fullSync;
    summary.nextSyncToken = calendarSummary.nextSyncToken;
  }

  return summary;
}

type SyncSingleCalendarOptions = {
  prisma: PrismaClientAny;
  userId: string;
  googleAccountId: string;
  calendar: ReturnType<typeof getCalendarClient>;
  calendarId: string;
  forceFullSync?: boolean;
  logger?: { info: (payload: unknown, message: string) => void; warn: (payload: unknown, message: string) => void };
};

async function syncSingleCalendar(options: SyncSingleCalendarOptions): Promise<SyncSummary> {
  const { prisma, userId, googleAccountId, calendar, calendarId, forceFullSync, logger } = options;

  // Get or create EventLink to store sync state for this calendar
  let eventLink = await prisma.eventLink.findFirst({
    where: { userId, calendarId, eventId: '__sync_state__' },
  });

  const currentState = getSyncState(eventLink?.extraData);
  let syncToken = forceFullSync ? undefined : currentState.syncToken;
  let nextSyncToken: string | undefined;
  let pageToken: string | undefined;
  let fullSync = !syncToken;

  const summary: SyncSummary = {
    synced: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    failed: 0,
    fullSync,
  };

  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - DEFAULT_SYNC_WINDOW_DAYS_PAST);
  const defaultEnd = new Date(now);
  defaultEnd.setDate(defaultEnd.getDate() + DEFAULT_SYNC_WINDOW_DAYS_FUTURE);

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
                timeMin: defaultStart.toISOString(),
                timeMax: defaultEnd.toISOString(),
              }),
        })
      );

      const items = response.data.items ?? [];
      summary.synced += items.length;

      const seen = new Set<string>();

      for (const event of items) {
        if (!event.id) {
          continue;
        }

        // Idempotency: ignore duplicate events in a single sync batch.
        if (seen.has(event.id)) {
          continue;
        }
        seen.add(event.id);

        // Note: 'deleted' is returned by Google API but not in official types
        const isCancelled = event.status === 'cancelled' || (event as { deleted?: boolean }).deleted === true;

        const parsedTimes = parseEventTimes({
          start: event.start ?? null,
          end: event.end ?? null,
        });

        // Failure mode: missing times for non-cancelled events; skip safely.
        if (!parsedTimes.startsAt || !parsedTimes.endsAt) {
          if (isCancelled) {
            await prisma.calendarEvent.updateMany({
              where: {
                userId,
                googleEventId: event.id,
              },
              data: {
                status: event.status ?? 'cancelled',
                deletedAt: new Date(),
              },
            });
            summary.deleted += 1;
          }
          continue;
        }

        if (parsedTimes.timeZone) {
          // Failure mode: timezone changes require reinterpreting local time.
          // For now, rely on Google-provided ISO strings and store in UTC.
          logger?.info(
            { userId, eventId: event.id, timeZone: parsedTimes.timeZone },
            'Calendar event contains timezone info'
          );
        }
        try {
          const result = await prisma.calendarEvent.upsert({
            where: {
              userId_googleEventId: {
                userId,
                googleEventId: event.id,
              },
            },
            create: {
              userId,
              accountId: googleAccountId,
              googleEventId: event.id,
              startsAt: parsedTimes.startsAt,
              endsAt: parsedTimes.endsAt,
              title: event.summary ?? '(No title)',
              status: event.status ?? null,
              deletedAt: isCancelled ? new Date() : null,
            },
            update: {
              startsAt: parsedTimes.startsAt,
              endsAt: parsedTimes.endsAt,
              title: event.summary ?? undefined,
              status: event.status ?? undefined,
              deletedAt: isCancelled ? new Date() : null,
            },
          });

          if (result.createdAt.getTime() === result.updatedAt.getTime()) {
            summary.created += 1;
          } else if (isCancelled) {
            summary.deleted += 1;
          } else {
            summary.updated += 1;
          }
        } catch (err) {
          // Failure mode: partial event persistence errors; continue syncing.
          summary.failed += 1;
          logger?.warn({ err, eventId: event.id }, 'Failed to upsert calendar event');
        }
      }

      pageToken = response.data.nextPageToken ?? undefined;
      nextSyncToken = response.data.nextSyncToken ?? nextSyncToken;
    } catch (err: unknown) {
      const error = err as { code?: number; response?: { status?: number } };
      if (error.code === 410 || error.response?.status === 410) {
        syncToken = undefined;
        pageToken = undefined;
        fullSync = true;
        summary.fullSync = true;
        continue;
      }
      logger?.warn({ err, userId }, 'Calendar sync failed');
      throw err;
    }
  } while (pageToken);

  // Store sync token in EventLink for this calendar
  if (nextSyncToken) {
    await prisma.eventLink.upsert({
      where: {
        userId_calendarId_eventId: {
          userId,
          calendarId,
          eventId: '__sync_state__',
        },
      },
      create: {
        userId,
        calendarId,
        eventId: '__sync_state__',
        extraData: {
          syncToken: nextSyncToken,
          lastSyncedAt: new Date().toISOString(),
        },
      },
      update: {
        extraData: {
          syncToken: nextSyncToken,
          lastSyncedAt: new Date().toISOString(),
        },
      },
    });
  }

  summary.nextSyncToken = nextSyncToken;
  return summary;
}

// Phase 2 (design notes):
// - Add Google push notifications (watch channel) per calendar.
// - Store channel ID, resource ID, and expiration in syncState.
// - On webhook receipt, enqueue syncGoogleCalendar for that user/account.
// - If webhook payload is missing or channel is expired, trigger full sync.
