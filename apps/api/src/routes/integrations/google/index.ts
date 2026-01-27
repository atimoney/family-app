import type { FastifyPluginAsync } from 'fastify';
import authPlugin from '../../../plugins/auth.js';
import {
  buildOAuthClient,
  exchangeAuthCodeForTokens,
  upsertCalendarAccountTokens,
} from '../../../lib/google/oauth-service.js';
import { syncGoogleCalendar } from '../../../lib/google/sync-service.js';
import { connectBodySchema, connectResponseSchema, syncResponseSchema } from './schema.js';

const googleIntegrationRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(authPlugin);

  const createClient = () =>
    buildOAuthClient({
      clientId: fastify.config.GOOGLE_CLIENT_ID,
      clientSecret: fastify.config.GOOGLE_CLIENT_SECRET,
      redirectUri: fastify.config.GOOGLE_REDIRECT_URL,
    });

  // POST /integrations/google/connect
  fastify.post('/connect', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = connectBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const userId = request.user?.id as string;
    const oauthClient = createClient();

    try {
      const tokens = await exchangeAuthCodeForTokens({
        code: parsed.data.code,
        oauthClient,
      });

      await upsertCalendarAccountTokens({
        prisma: fastify.prisma,
        userId,
        provider: 'google',
        googleCalendarId: parsed.data.calendarId ?? 'primary',
        tokens,
        encryptionKey: fastify.config.TOKEN_ENCRYPTION_KEY,
      });

      const response = {
        status: 'connected',
        expiresAt: tokens.expiresAt,
      } as const;

      connectResponseSchema.parse(response);
      return response;
    } catch (err) {
      fastify.log.error({ err }, 'Google OAuth connect failed');
      return reply.status(502).send({ error: 'Google OAuth exchange failed' });
    }
  });

  // POST /integrations/google/sync
  fastify.post('/sync', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user?.id as string;
    const { force } = request.query as { force?: string };
    const forceFullSync = force === 'true' || force === '1';
    const oauthClient = createClient();

    fastify.log.info({ userId, forceFullSync }, 'Starting Google Calendar sync');

    try {
      const syncSummary = await syncGoogleCalendar({
        prisma: fastify.prisma,
        userId,
        oauthClient,
        encryptionKey: fastify.config.TOKEN_ENCRYPTION_KEY,
        forceFullSync,
        logger: fastify.log,
      });

      const response = {
        status: 'ready',
        synced: syncSummary.synced,
        created: syncSummary.created,
        updated: syncSummary.updated,
        deleted: syncSummary.deleted,
        failed: syncSummary.failed,
        fullSync: syncSummary.fullSync,
        nextSyncToken: syncSummary.nextSyncToken,
      } as const;

      syncResponseSchema.parse(response);
      return response;
    } catch (err) {
      const error = err as Error;
      fastify.log.error({ err, message: error.message }, 'Google sync failed');
      
      if (error.message === 'Google account not connected') {
        return reply.status(401).send({ error: 'Google account not connected. Please reconnect your Google Calendar.' });
      }
      if (error.message?.includes('invalid_grant') || error.message?.includes('Token has been expired or revoked')) {
        return reply.status(401).send({ error: 'Google authorization expired. Please reconnect your Google Calendar.' });
      }
      
      return reply.status(409).send({ error: 'Sync failed. Please try reconnecting your Google Calendar.' });
    }
  });
};

export default googleIntegrationRoutes;
