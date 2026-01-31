import type { FastifyPluginAsync } from 'fastify';
import authPlugin from '../../plugins/auth.js';
import {
  eventMetadataBodySchema,
  eventMetadataParamsSchema,
  eventMetadataResponseSchema,
  getEventsQuerySchema,
  getEventsResponseSchema,
} from './schema.js';

// Google Calendar colorId to hex mapping (reverse of calendar/index.ts)
// https://developers.google.com/calendar/api/v3/reference/colors/get
const GOOGLE_COLOR_ID_TO_HEX: Record<string, string> = {
  '1': '#7986cb',  // Lavender
  '2': '#33b679',  // Sage
  '3': '#8e24aa',  // Grape
  '4': '#e67c73',  // Flamingo
  '5': '#f6bf26',  // Banana
  '6': '#f4511e',  // Tangerine
  '7': '#039be5',  // Peacock
  '8': '#616161',  // Graphite
  '9': '#3f51b5',  // Blueberry
  '10': '#0b8043', // Basil
  '11': '#d50000', // Tomato
};

/**
 * Extract Google event color from rawJson colorId
 */
function getGoogleEventColor(rawJson: unknown): string | null {
  if (!rawJson || typeof rawJson !== 'object') return null;
  const colorId = (rawJson as { colorId?: string }).colorId;
  if (!colorId) return null;
  return GOOGLE_COLOR_ID_TO_HEX[colorId] ?? null;
}

const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(authPlugin);

  // GET /events - Get events from local cache
  fastify.get('/events', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsedQuery = getEventsQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsedQuery.error.flatten().fieldErrors,
      });
    }

    const userId = request.user?.id as string;
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 90);
    const defaultTo = new Date(now);
    defaultTo.setDate(defaultTo.getDate() + 365);

    const from = parsedQuery.data.from ? new Date(parsedQuery.data.from) : defaultFrom;
    const to = parsedQuery.data.to ? new Date(parsedQuery.data.to) : defaultTo;
    const tags = parsedQuery.data.tags ?? [];
    const calendarIds = parsedQuery.data.calendarIds ?? [];

    const events = await fastify.prisma.calendarEvent.findMany({
      where: {
        userId,
        deletedAt: null,
        startsAt: { gte: from },
        endsAt: { lte: to },
        ...(calendarIds.length > 0 ? { calendarId: { in: calendarIds } } : {}),
        ...(tags.length > 0
          ? {
              metadata: {
                tags: {
                  hasSome: tags,
                },
              },
            }
          : {}),
      },
      include: {
        metadata: true,
        selectedCalendar: {
          select: {
            color: true,
            summary: true,
          },
        },
      },
      orderBy: {
        startsAt: 'asc',
      },
    });

    // Fetch EventLink data for audit info
    const googleEventIds = events.map(e => e.googleEventId);
    const eventLinks = await fastify.prisma.eventLink.findMany({
      where: {
        userId,
        eventId: { in: googleEventIds },
      },
    });
    const eventLinkMap = new Map(eventLinks.map(link => [link.eventId, link.extraData as Record<string, unknown>]));

    const response = events.map((event) => {
      // E2: Extract familyAssignments from customJson if present
      const customJson = (event.metadata?.customJson ?? {}) as Record<string, unknown>;
      const familyAssignments = customJson.familyAssignments as Record<string, unknown> | undefined;
      // E1: Extract category metadata
      const categoryMetadata = (event.metadata?.categoryMetadata ?? {}) as Record<string, unknown>;
      // Extract Google event color from rawJson
      const googleEventColor = getGoogleEventColor(event.rawJson);
      // Get EventLink data for audit info
      const eventLinkData = eventLinkMap.get(event.googleEventId) ?? {};

      return {
        id: event.id,
        googleEventId: event.googleEventId,
        calendarId: event.calendarId,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        title: event.title,
        description: event.description ?? null,
        location: event.location ?? null,
        allDay: event.allDay,
        status: event.status ?? null,
        calendarColor: event.selectedCalendar?.color ?? null,
        calendarSummary: event.selectedCalendar?.summary ?? null,
        googleEventColor, // Google event's own color (from colorId)
        metadata: event.metadata
          ? {
              tags: event.metadata.tags ?? [],
              notes: event.metadata.notes ?? null,
              color: event.metadata.color ?? null,
              // E1: Include category, audience, and categoryMetadata
              category: event.metadata.category ?? null,
              audience: event.metadata.audience ?? 'family',
              categoryMetadata,
              customJson,
              familyAssignments: familyAssignments ?? null,
              // Audit tracking from EventLink
              createdAudit: eventLinkData.createdAudit ?? null,
              lastModifiedAudit: eventLinkData.lastModifiedAudit ?? null,
            }
          : null,
      };
    });

    getEventsResponseSchema.parse(response);
    return response;
  });

  // GET /events/:id - Get a single event
  fastify.get('/events/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user?.id as string;
    const { id } = request.params as { id: string };

    const event = await fastify.prisma.calendarEvent.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
      include: {
        metadata: true,
        selectedCalendar: {
          select: {
            color: true,
            summary: true,
          },
        },
      },
    });

    if (!event) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    // E2: Extract familyAssignments from customJson if present
    const customJson = (event.metadata?.customJson ?? {}) as Record<string, unknown>;
    const familyAssignments = customJson.familyAssignments as Record<string, unknown> | undefined;
    // E1: Extract category metadata
    const categoryMetadata = (event.metadata?.categoryMetadata ?? {}) as Record<string, unknown>;
    // Extract Google event color from rawJson
    const googleEventColor = getGoogleEventColor(event.rawJson);
    // Get EventLink data for audit info
    const eventLink = await fastify.prisma.eventLink.findFirst({
      where: {
        userId,
        eventId: event.googleEventId,
      },
    });
    const eventLinkData = (eventLink?.extraData ?? {}) as Record<string, unknown>;

    return {
      id: event.id,
      googleEventId: event.googleEventId,
      calendarId: event.calendarId,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      title: event.title,
      description: event.description ?? null,
      location: event.location ?? null,
      allDay: event.allDay,
      status: event.status ?? null,
      calendarColor: event.selectedCalendar?.color ?? null,
      calendarSummary: event.selectedCalendar?.summary ?? null,
      googleEventColor, // Google event's own color (from colorId)
      metadata: event.metadata
        ? {
            tags: event.metadata.tags ?? [],
            notes: event.metadata.notes ?? null,
            color: event.metadata.color ?? null,
            // E1: Include category, audience, and categoryMetadata
            category: event.metadata.category ?? null,
            audience: event.metadata.audience ?? 'family',
            categoryMetadata,
            customJson,
            familyAssignments: familyAssignments ?? null,
            // Audit tracking from EventLink
            createdAudit: eventLinkData.createdAudit ?? null,
            lastModifiedAudit: eventLinkData.lastModifiedAudit ?? null,
          }
        : null,
    };
  });

  // PATCH /events/:id/metadata - Update event metadata
  fastify.patch('/events/:id/metadata', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsedParams = eventMetadataParamsSchema.safeParse(request.params);
    const parsedBody = eventMetadataBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      const details = {
        ...(!parsedParams.success ? parsedParams.error.flatten().fieldErrors : {}),
        ...(!parsedBody.success ? parsedBody.error.flatten().fieldErrors : {}),
      };
      return reply.status(400).send({
        error: 'Validation failed',
        details,
      });
    }

    const userId = request.user?.id as string;
    const eventId = parsedParams.data.id;

    const event = await fastify.prisma.calendarEvent.findFirst({
      where: {
        id: eventId,
        userId,
        deletedAt: null,
      },
    });

    if (!event) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    // E2: Store familyAssignments in customJson if provided
    const customJson = {
      ...(parsedBody.data.customJson ?? {}),
      ...(parsedBody.data.familyAssignments ? { familyAssignments: parsedBody.data.familyAssignments } : {}),
    };

    const metadata = await fastify.prisma.calendarEventMetadata.upsert({
      where: {
        eventId: event.id,
      },
      create: {
        eventId: event.id,
        tags: parsedBody.data.tags ?? [],
        notes: parsedBody.data.notes ?? null,
        color: parsedBody.data.color ?? null,
        // E1: Add category, audience, and categoryMetadata
        category: parsedBody.data.category ?? null,
        audience: parsedBody.data.audience ?? 'family',
        categoryMetadata: parsedBody.data.categoryMetadata ?? {},
        customJson,
      },
      update: {
        tags: parsedBody.data.tags ?? [],
        notes: parsedBody.data.notes ?? null,
        color: parsedBody.data.color ?? null,
        // E1: Update category, audience, and categoryMetadata
        category: parsedBody.data.category ?? null,
        audience: parsedBody.data.audience ?? 'family',
        categoryMetadata: parsedBody.data.categoryMetadata ?? {},
        customJson,
      },
    });

    // E2: Extract familyAssignments from customJson for response
    const responseCustomJson = (metadata.customJson ?? {}) as Record<string, unknown>;
    const familyAssignments = responseCustomJson.familyAssignments as Record<string, unknown> | undefined;
    // E1: Extract category metadata for response
    const responseCategoryMetadata = (metadata.categoryMetadata ?? {}) as Record<string, unknown>;

    const response = {
      id: metadata.id,
      eventId: metadata.eventId,
      tags: metadata.tags ?? [],
      notes: metadata.notes ?? null,
      color: metadata.color ?? null,
      // E1: Include category, audience, and categoryMetadata in response
      category: metadata.category ?? null,
      audience: metadata.audience ?? 'family',
      categoryMetadata: responseCategoryMetadata,
      customJson: responseCustomJson,
      familyAssignments: familyAssignments ?? null,
    };

    eventMetadataResponseSchema.parse(response);
    return response;
  });
};

export default eventsRoutes;
