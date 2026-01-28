import type { FastifyPluginAsync } from 'fastify';
import authPlugin from '../../../plugins/auth.js';
import { getOAuthClient, getAuthorizedClient } from '../../../lib/google/oauth.js';
import { decryptSecret } from '../../../lib/crypto.js';
import { syncGoogleCalendar, clearSyncState } from '../../../lib/google/sync-service.js';
import { syncResponseSchema, clearSyncResponseSchema } from './schema.js';

const googleIntegrationRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(authPlugin);

  const createClient = () =>
    getOAuthClient({
      clientId: fastify.config.GOOGLE_CLIENT_ID,
      clientSecret: fastify.config.GOOGLE_CLIENT_SECRET,
      redirectUri: fastify.config.GOOGLE_REDIRECT_URL,
    });

  // Helper to get refresh token for user
  const getRefreshToken = async (userId: string): Promise<string | null> => {
    const account = await fastify.prisma.googleAccount.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    if (!account) return null;
    return decryptSecret(account.refreshToken, fastify.config.TOKEN_ENCRYPTION_KEY);
  };

  // POST /integrations/google/sync - Trigger calendar sync
  fastify.post('/sync', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user?.id as string;
    const { force, calendarId } = request.query as { force?: string; calendarId?: string };
    const forceFullSync = force === 'true' || force === '1';
    const oauthClient = createClient();

    fastify.log.info({ userId, forceFullSync, calendarId }, 'Starting Google Calendar sync');

    try {
      const syncSummary = await syncGoogleCalendar({
        prisma: fastify.prisma,
        userId,
        oauthClient,
        encryptionKey: fastify.config.TOKEN_ENCRYPTION_KEY,
        calendarId,
        forceFullSync,
        logger: fastify.log,
      });

      const response = {
        status: 'ready' as const,
        synced: syncSummary.synced,
        created: syncSummary.created,
        updated: syncSummary.updated,
        deleted: syncSummary.deleted,
        failed: syncSummary.failed,
        fullSync: syncSummary.fullSync,
        calendarsProcessed: syncSummary.calendarsProcessed,
        nextSyncToken: syncSummary.nextSyncToken,
      };

      syncResponseSchema.parse(response);
      return response;
    } catch (err) {
      const error = err as Error;
      fastify.log.error({ err, message: error.message }, 'Google sync failed');

      if (error.message === 'Google account not connected') {
        return reply
          .status(401)
          .send({ error: 'Google account not connected. Please reconnect your Google Calendar.' });
      }
      if (
        error.message?.includes('invalid_grant') ||
        error.message?.includes('Token has been expired or revoked')
      ) {
        return reply
          .status(401)
          .send({ error: 'Google authorization expired. Please reconnect your Google Calendar.' });
      }

      return reply
        .status(409)
        .send({ error: 'Sync failed. Please try reconnecting your Google Calendar.' });
    }
  });

  // DELETE /integrations/google/sync - Clear sync state and re-sync
  fastify.delete('/sync', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user?.id as string;
    const { calendarId } = request.query as { calendarId?: string };

    fastify.log.info({ userId, calendarId }, 'Clearing sync state');

    try {
      await clearSyncState({
        prisma: fastify.prisma,
        userId,
        calendarId,
      });

      const response = { status: 'cleared' as const, message: 'Sync state cleared successfully' };
      clearSyncResponseSchema.parse(response);
      return response;
    } catch (err) {
      fastify.log.error({ err }, 'Failed to clear sync state');
      return reply.status(500).send({ error: 'Failed to clear sync state' });
    }
  });

  // GET /integrations/google/sync/status - Get sync status for calendars
  fastify.get('/sync/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user?.id as string;

    const selectedCalendars = await fastify.prisma.selectedCalendar.findMany({
      where: { userId, isVisible: true },
      select: {
        calendarId: true,
        summary: true,
        syncToken: true,
        lastSyncedAt: true,
      },
    });

    const eventCounts = await fastify.prisma.calendarEvent.groupBy({
      by: ['calendarId'],
      where: { userId, deletedAt: null },
      _count: { id: true },
    });

    const countMap = new Map(eventCounts.map((c) => [c.calendarId, c._count.id]));

    return {
      calendars: selectedCalendars.map((cal) => ({
        calendarId: cal.calendarId,
        summary: cal.summary,
        hasSyncToken: !!cal.syncToken,
        lastSyncedAt: cal.lastSyncedAt?.toISOString() ?? null,
        eventCount: countMap.get(cal.calendarId) ?? 0,
      })),
    };
  });
};

export default googleIntegrationRoutes;
