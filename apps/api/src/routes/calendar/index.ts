import type { FastifyPluginAsync } from 'fastify';
import type { CalendarEvent } from '@family/shared';
import { createEventSchema } from './schema.js';

const calendarRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/calendar/events
  fastify.get('/events', async (): Promise<CalendarEvent[]> => {
    const events = await fastify.prisma.calendarEvent.findMany({
      orderBy: { start: 'asc' },
    });

    return events.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start.toISOString(),
      end: e.end.toISOString(),
      allDay: e.allDay,
    }));
  });

  // POST /v1/calendar/events
  fastify.post('/events', async (request, reply): Promise<CalendarEvent> => {
    const parsed = createEventSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { title, start, end, allDay } = parsed.data;

    const event = await fastify.prisma.calendarEvent.create({
      data: {
        title,
        start: new Date(start),
        end: new Date(end),
        allDay,
      },
    });

    return {
      id: event.id,
      title: event.title,
      start: event.start.toISOString(),
      end: event.end.toISOString(),
      allDay: event.allDay,
    };
  });
};

export default calendarRoutes;
