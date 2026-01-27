import type { FastifyPluginAsync } from 'fastify';
import authPlugin from '../../plugins/auth.js';
import {
  eventMetadataBodySchema,
  eventMetadataParamsSchema,
  eventMetadataResponseSchema,
  getEventsQuerySchema,
  getEventsResponseSchema,
} from './schema.js';

const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(authPlugin);

  // GET /events
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

    const events = await fastify.prisma.calendarEvent.findMany({
      where: {
        userId,
        deletedAt: null,
        startsAt: { gte: from },
        endsAt: { lte: to },
        ...(tags.length
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
      },
      orderBy: {
        startsAt: 'asc',
      },
    });

    const response = events.map((event) => ({
      id: event.id,
      googleEventId: event.googleEventId,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      title: event.title,
      status: event.status ?? null,
      metadata: event.metadata
        ? {
            tags: event.metadata.tags ?? [],
            notes: event.metadata.notes ?? null,
            color: event.metadata.color ?? null,
            customJson: (event.metadata.customJson ?? {}) as Record<string, unknown>,
          }
        : null,
    }));

    getEventsResponseSchema.parse(response);
    return response;
  });

  // PATCH /events/:id/metadata
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

    const metadata = await fastify.prisma.calendarEventMetadata.upsert({
      where: {
        eventId: event.id,
      },
      create: {
        eventId: event.id,
        tags: parsedBody.data.tags ?? [],
        notes: parsedBody.data.notes ?? null,
        color: parsedBody.data.color ?? null,
        customJson: parsedBody.data.customJson ?? {},
      },
      update: {
        tags: parsedBody.data.tags ?? [],
        notes: parsedBody.data.notes ?? null,
        color: parsedBody.data.color ?? null,
        customJson: parsedBody.data.customJson ?? {},
      },
    });

    const response = {
      id: metadata.id,
      eventId: metadata.eventId,
      tags: metadata.tags ?? [],
      notes: metadata.notes ?? null,
      color: metadata.color ?? null,
      customJson: (metadata.customJson ?? {}) as Record<string, unknown>,
    };

    eventMetadataResponseSchema.parse(response);
    return response;
  });
};

export default eventsRoutes;
