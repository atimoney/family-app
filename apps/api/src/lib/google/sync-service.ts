import type { PrismaClient } from '@prisma/client';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

import { getValidAccessToken } from './oauth-service.js';
import { parseEventTimes, withRetry } from './sync-utils.js';

export type SyncSummary = {
  synced: number;
  created: number;
  updated: number;
  deleted: number;
  failed: number;
  fullSync: boolean;
  nextSyncToken?: string;
};

const DEFAULT_SYNC_WINDOW_DAYS = 90;

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
  prisma: PrismaClient;
  userId: string;
  provider: string;
  oauthClient: OAuth2Client;
  encryptionKey: string;
  logger?: { info: (payload: unknown, message: string) => void; warn: (payload: unknown, message: string) => void };
}): Promise<SyncSummary> {
  const logger = options.logger;
  const account = await options.prisma.calendarAccount.findFirst({
    where: {
      userId: options.userId,
      provider: options.provider,
      deletedAt: null,
    },
  });

  if (!account) {
    throw new Error('Google calendar account not connected');
  }

  let tokens;
  try {
    tokens = await getValidAccessToken({
      prisma: options.prisma,
      userId: options.userId,
      provider: options.provider,
      oauthClient: options.oauthClient,
      encryptionKey: options.encryptionKey,
    });
  } catch (err) {
    // Failure mode: refresh token expired or access revoked by user.
    logger?.warn({ err, userId: options.userId }, 'Google token refresh failed');
    throw err;
  }

  options.oauthClient.setCredentials({ access_token: tokens.accessToken });

  const calendar = getCalendarClient(options.oauthClient);
  const calendarId = account.googleCalendarId || 'primary';

  const currentState = getSyncState(account.syncState);
  let syncToken = currentState.syncToken;
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
  defaultStart.setDate(defaultStart.getDate() - DEFAULT_SYNC_WINDOW_DAYS);

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
            await options.prisma.calendarEvent.updateMany({
              where: {
                userId: options.userId,
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
            { userId: options.userId, eventId: event.id, timeZone: parsedTimes.timeZone },
            'Calendar event contains timezone info'
          );
        }
        try {
          const result = await options.prisma.calendarEvent.upsert({
            where: {
              userId_googleEventId: {
                userId: options.userId,
                googleEventId: event.id,
              },
            },
            create: {
              userId: options.userId,
              accountId: account.id,
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
      logger?.warn({ err, userId: options.userId }, 'Calendar sync failed');
      throw err;
    }
  } while (pageToken);

  if (nextSyncToken) {
    await options.prisma.calendarAccount.update({
      where: { id: account.id },
      data: {
        syncState: {
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
