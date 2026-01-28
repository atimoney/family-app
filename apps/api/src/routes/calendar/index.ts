import type { FastifyPluginAsync } from 'fastify';
import { google } from 'googleapis';
import type { CalendarEvent, CalendarEventExtraDataV1 } from '@family/shared';
import authPlugin from '../../plugins/auth.js';
import { encryptSecret, decryptSecret } from '../../lib/crypto.js';
import { createOAuthState, verifyOAuthState } from '../../lib/oauth-state.js';
import { buildAuthUrl, exchangeCodeForTokens, getAuthorizedClient, getOAuthClient } from '../../lib/google/oauth.js';
import { createEvent, deleteEvent, listCalendars, listEvents, updateEvent } from '../../lib/google/calendar.js';
import {
  createEventSchema,
  updateEventSchema,
  updateMetadataSchema,
} from './schema.js';

const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const calendarRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(authPlugin);

  const getOauthClient = () =>
    getOAuthClient({
      clientId: fastify.config.GOOGLE_CLIENT_ID,
      clientSecret: fastify.config.GOOGLE_CLIENT_SECRET,
      redirectUri: fastify.config.GOOGLE_REDIRECT_URL,
    });

  const getScopes = () =>
    (fastify.config.GOOGLE_SCOPES
      ? fastify.config.GOOGLE_SCOPES.split(',').map((scope) => scope.trim())
      : DEFAULT_SCOPES);

  const getActiveCalendarId = (calendarId?: string) => calendarId ?? 'primary';

  const loadGoogleAccount = async (userId: string) => {
    return fastify.prisma.googleAccount.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  };

  const ensureRefreshToken = async (userId: string) => {
    const account = await loadGoogleAccount(userId);
    if (!account) {
      return null;
    }
    return decryptSecret(account.refreshToken, fastify.config.TOKEN_ENCRYPTION_KEY);
  };

  // GET /v1/calendar/oauth/status - Check if Google account is connected
  fastify.get('/oauth/status', { preHandler: [fastify.authenticate] }, async (request) => {
    const userId = request.user?.id as string;
    const account = await loadGoogleAccount(userId);
    
    if (!account) {
      return { connected: false };
    }

    return {
      connected: true,
      email: account.email,
      connectedAt: account.createdAt,
    };
  });

  // GET /v1/calendar/oauth/url
  fastify.get('/oauth/url', { preHandler: [fastify.authenticate] }, async (request) => {
    const userId = request.user?.id as string;
    const oauthClient = getOauthClient();
    const state = createOAuthState(userId, fastify.config.OAUTH_STATE_SECRET);
    const url = buildAuthUrl({ oauthClient, scopes: getScopes(), state });
    return { url };
  });

  // GET /v1/calendar/oauth/callback
  fastify.get('/oauth/callback', async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string };

    if (!code || !state) {
      return reply.status(400).send({ error: 'Missing code or state' });
    }

    const payload = verifyOAuthState(state, fastify.config.OAUTH_STATE_SECRET);
    if (!payload) {
      return reply.status(400).send({ error: 'Invalid state' });
    }

    const oauthClient = getOauthClient();
    const tokens = await exchangeCodeForTokens({ oauthClient, code });
    oauthClient.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauthClient });
    const profile = await oauth2.userinfo.get();
    const googleUserId = profile.data.id;

    if (!googleUserId) {
      return reply.status(400).send({ error: 'Unable to read Google user profile' });
    }

    const existing = await fastify.prisma.googleAccount.findFirst({
      where: { userId: payload.userId, googleUserId },
    });

    const refreshToken = tokens.refresh_token ?? (existing ? decryptSecret(existing.refreshToken, fastify.config.TOKEN_ENCRYPTION_KEY) : undefined);

    if (!refreshToken) {
      return reply.status(400).send({ error: 'No refresh token returned by Google' });
    }

    const encryptedRefreshToken = encryptSecret(refreshToken, fastify.config.TOKEN_ENCRYPTION_KEY);
    const scopes = tokens.scope?.split(' ').filter(Boolean) ?? getScopes();

    await fastify.prisma.googleAccount.upsert({
      where: {
        userId_googleUserId: {
          userId: payload.userId,
          googleUserId,
        },
      },
      create: {
        userId: payload.userId,
        googleUserId,
        email: profile.data.email ?? null,
        refreshToken: encryptedRefreshToken,
        scopes,
      },
      update: {
        email: profile.data.email ?? null,
        refreshToken: encryptedRefreshToken,
        scopes,
      },
    });

    // Redirect to frontend settings page after successful OAuth
    const frontendUrl = fastify.config.FRONTEND_URL ?? 'http://localhost:8081';
    return reply.redirect(`${frontendUrl}/settings?google=connected`);
  });

  // GET /v1/calendar/calendars
  fastify.get('/calendars', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user?.id as string;
    const refreshToken = await ensureRefreshToken(userId);
    if (!refreshToken) {
      return reply.status(401).send({ error: 'Google account not connected' });
    }

    const oauthClient = getAuthorizedClient({
      oauthClient: getOauthClient(),
      refreshToken,
    });

    const calendars = await listCalendars(oauthClient);
    
    // Get user's selected calendars
    const selectedCalendars = await fastify.prisma.selectedCalendar.findMany({
      where: { userId },
    });
    const selectedMap = new Map(selectedCalendars.map((sc) => [sc.calendarId, sc]));

    return calendars.map((calendar) => {
      const selected = selectedMap.get(calendar.id ?? '');
      return {
        id: calendar.id ?? '',
        summary: calendar.summary ?? '',
        timeZone: calendar.timeZone ?? null,
        primary: calendar.primary ?? false,
        backgroundColor: calendar.backgroundColor ?? null,
        isSelected: selected?.isVisible ?? false,
      };
    });
  });

  // PUT /v1/calendar/calendars/selection
  fastify.put('/calendars/selection', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user?.id as string;
    const { calendarIds } = request.body as { calendarIds: string[] };

    if (!Array.isArray(calendarIds)) {
      return reply.status(400).send({ error: 'calendarIds must be an array' });
    }

    const account = await loadGoogleAccount(userId);
    if (!account) {
      return reply.status(401).send({ error: 'Google account not connected' });
    }

    const refreshToken = await ensureRefreshToken(userId);
    if (!refreshToken) {
      return reply.status(401).send({ error: 'Google account not connected' });
    }

    const oauthClient = getAuthorizedClient({
      oauthClient: getOauthClient(),
      refreshToken,
    });

    // Get all calendars from Google to validate and get summaries
    const calendars = await listCalendars(oauthClient);
    const calendarMap = new Map(calendars.map((c) => [c.id, c]));

    // Mark all existing as not visible
    await fastify.prisma.selectedCalendar.updateMany({
      where: { userId },
      data: { isVisible: false },
    });

    // Upsert selected calendars
    for (const calendarId of calendarIds) {
      const calendar = calendarMap.get(calendarId);
      if (calendar) {
        await fastify.prisma.selectedCalendar.upsert({
          where: { userId_calendarId: { userId, calendarId } },
          create: {
            userId,
            googleAccountId: account.id,
            calendarId,
            summary: calendar.summary ?? '',
            color: calendar.backgroundColor ?? null,
            isVisible: true,
          },
          update: {
            summary: calendar.summary ?? '',
            color: calendar.backgroundColor ?? null,
            isVisible: true,
          },
        });
      }
    }

    return { ok: true, selectedCount: calendarIds.length };
  });

  // GET /v1/calendar/events
  fastify.get('/events', { preHandler: [fastify.authenticate] }, async (request, reply): Promise<CalendarEvent[]> => {
    const userId = request.user?.id as string;
    const { timeMin, timeMax, calendarId } = request.query as {
      timeMin?: string;
      timeMax?: string;
      calendarId?: string;
    };

    const refreshToken = await ensureRefreshToken(userId);
    if (!refreshToken) {
      return reply.status(401).send({ error: 'Google account not connected' });
    }

    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setDate(defaultStart.getDate() - 90);
    const defaultEnd = new Date(now);
    defaultEnd.setDate(defaultEnd.getDate() + 365);

    const effectiveTimeMin = timeMin ?? defaultStart.toISOString();
    const effectiveTimeMax = timeMax ?? defaultEnd.toISOString();

    const oauthClient = getAuthorizedClient({
      oauthClient: getOauthClient(),
      refreshToken,
    });

    // Get selected calendars or use provided calendarId or default to primary
    let calendarIds: string[] = [];
    if (calendarId) {
      calendarIds = [calendarId];
    } else {
      const selectedCalendars = await fastify.prisma.selectedCalendar.findMany({
        where: { userId, isVisible: true },
      });
      calendarIds = selectedCalendars.length > 0 
        ? selectedCalendars.map((sc) => sc.calendarId)
        : ['primary'];
    }

    // Fetch events from all selected calendars
    const allEvents: CalendarEvent[] = [];
    
    for (const cId of calendarIds) {
      try {
        const events = await listEvents({
          auth: oauthClient,
          calendarId: cId,
          timeMin: effectiveTimeMin,
          timeMax: effectiveTimeMax,
        });

        const eventIds = events.map((event) => event.id).filter(Boolean) as string[];
        const metadata = await fastify.prisma.eventLink.findMany({
          where: {
            userId,
            calendarId: cId,
            eventId: { in: eventIds },
          },
        });

        const metadataMap = new Map(metadata.map((link: { eventId: string; extraData: unknown }) => [link.eventId, link.extraData as CalendarEventExtraDataV1]));

        // Get calendar color for this calendar
        const selectedCal = await fastify.prisma.selectedCalendar.findUnique({
          where: { userId_calendarId: { userId, calendarId: cId } },
        });

        for (const event of events) {
          const start = event.start?.dateTime ?? event.start?.date ?? '';
          const end = event.end?.dateTime ?? event.end?.date ?? '';
          const allDay = Boolean(event.start?.date);
          const eventExtraData = metadataMap.get(event.id ?? '');

          allEvents.push({
            id: event.id ?? '',
            title: event.summary ?? '(No title)',
            start: new Date(start).toISOString(),
            end: new Date(end).toISOString(),
            allDay,
            calendarId: cId,
            extraData: eventExtraData ?? (selectedCal?.color ? { tags: [], category: null, notes: null, color: selectedCal.color } : undefined),
          });
        }
      } catch (err) {
        // Log error but continue with other calendars
        fastify.log.warn({ err, calendarId: cId }, 'Failed to fetch events from calendar');
      }
    }

    // Sort by start time
    allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return allEvents;
  });

  // POST /v1/calendar/events
  fastify.post('/events', { preHandler: [fastify.authenticate] }, async (request, reply): Promise<CalendarEvent> => {
    const parsed = createEventSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const userId = request.user?.id as string;
    const refreshToken = await ensureRefreshToken(userId);
    if (!refreshToken) {
      return reply.status(401).send({ error: 'Google account not connected' });
    }

    const { title, start, end, allDay, calendarId, extraData } = parsed.data;
    
    // If no calendarId provided, use the first selected calendar or primary as fallback
    let resolvedCalendarId = calendarId;
    if (!resolvedCalendarId) {
      const selectedCalendar = await fastify.prisma.selectedCalendar.findFirst({
        where: { userId, isVisible: true },
        orderBy: { createdAt: 'asc' },
      });
      resolvedCalendarId = selectedCalendar?.calendarId ?? 'primary';
    }

    const oauthClient = getAuthorizedClient({
      oauthClient: getOauthClient(),
      refreshToken,
    });

    const event = await createEvent({
      auth: oauthClient,
      calendarId: resolvedCalendarId,
      event: {
        summary: title,
        start: allDay ? { date: start.slice(0, 10) } : { dateTime: start },
        end: allDay ? { date: end.slice(0, 10) } : { dateTime: end },
      },
    });

    if (extraData && event.id) {
      await fastify.prisma.eventLink.upsert({
        where: {
          userId_calendarId_eventId: {
            userId,
            calendarId: resolvedCalendarId,
            eventId: event.id,
          },
        },
        create: {
          userId,
          calendarId: resolvedCalendarId,
          eventId: event.id,
          extraData,
        },
        update: {
          extraData,
        },
      });
    }

    return {
      id: event.id ?? '',
      title: event.summary ?? title,
      start,
      end,
      allDay,
      calendarId: resolvedCalendarId,
      extraData,
    };
  });

  // PATCH /v1/calendar/events/:eventId
  fastify.patch('/events/:eventId', { preHandler: [fastify.authenticate] }, async (request, reply): Promise<CalendarEvent> => {
    const parsed = updateEventSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const userId = request.user?.id as string;
    const refreshToken = await ensureRefreshToken(userId);
    if (!refreshToken) {
      return reply.status(401).send({ error: 'Google account not connected' });
    }

    const { eventId } = request.params as { eventId: string };
    const { title, start, end, allDay, calendarId, extraData } = parsed.data;
    const resolvedCalendarId = getActiveCalendarId(calendarId);

    const oauthClient = getAuthorizedClient({
      oauthClient: getOauthClient(),
      refreshToken,
    });

    const event = await updateEvent({
      auth: oauthClient,
      calendarId: resolvedCalendarId,
      eventId,
      event: {
        summary: title,
        start: start
          ? allDay
            ? { date: start.slice(0, 10) }
            : { dateTime: start }
          : undefined,
        end: end
          ? allDay
            ? { date: end.slice(0, 10) }
            : { dateTime: end }
          : undefined,
      },
    });

    if (extraData && event.id) {
      await fastify.prisma.eventLink.upsert({
        where: {
          userId_calendarId_eventId: {
            userId,
            calendarId: resolvedCalendarId,
            eventId: event.id,
          },
        },
        create: {
          userId,
          calendarId: resolvedCalendarId,
          eventId: event.id,
          extraData,
        },
        update: {
          extraData,
        },
      });
    }

    const startValue = event.start?.dateTime ?? event.start?.date ?? start ?? '';
    const endValue = event.end?.dateTime ?? event.end?.date ?? end ?? '';

    return {
      id: event.id ?? eventId,
      title: event.summary ?? title ?? '(No title)',
      start: new Date(startValue).toISOString(),
      end: new Date(endValue).toISOString(),
      allDay: Boolean(event.start?.date ?? allDay),
      calendarId: resolvedCalendarId,
      extraData,
    };
  });

  // PATCH /v1/calendar/events/:eventId/metadata
  fastify.patch('/events/:eventId/metadata', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = updateMetadataSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const userId = request.user?.id as string;
    const { eventId } = request.params as { eventId: string };
    const { calendarId } = request.query as { calendarId?: string };
    const resolvedCalendarId = getActiveCalendarId(calendarId);

    const record = await fastify.prisma.eventLink.upsert({
      where: {
        userId_calendarId_eventId: {
          userId,
          calendarId: resolvedCalendarId,
          eventId,
        },
      },
      create: {
        userId,
        calendarId: resolvedCalendarId,
        eventId,
        extraData: parsed.data.extraData,
      },
      update: {
        extraData: parsed.data.extraData,
      },
    });

    return {
      id: record.eventId,
      calendarId: record.calendarId,
      extraData: record.extraData,
    };
  });

  // DELETE /v1/calendar/events/:eventId
  fastify.delete('/events/:eventId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user?.id as string;
    const refreshToken = await ensureRefreshToken(userId);
    if (!refreshToken) {
      return reply.status(401).send({ error: 'Google account not connected' });
    }

    const { eventId } = request.params as { eventId: string };
    const { calendarId } = request.query as { calendarId?: string };
    const resolvedCalendarId = getActiveCalendarId(calendarId);

    const oauthClient = getAuthorizedClient({
      oauthClient: getOauthClient(),
      refreshToken,
    });

    await deleteEvent({
      auth: oauthClient,
      calendarId: resolvedCalendarId,
      eventId,
    });

    await fastify.prisma.eventLink.deleteMany({
      where: {
        userId,
        calendarId: resolvedCalendarId,
        eventId,
      },
    });

    return { ok: true };
  });
};

export default calendarRoutes;
