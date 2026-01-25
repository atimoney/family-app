import type { FastifyPluginAsync } from 'fastify';
import type { Task, TaskStatus } from '@family/shared';
import { createTaskSchema, updateTaskSchema } from './schema.js';

const tasksRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/tasks
  fastify.get('/', async (): Promise<Task[]> => {
    const tasks = await fastify.prisma.task.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      assigneeId: t.assigneeId ?? undefined,
      dueDate: t.dueDate?.toISOString(),
      status: t.status as TaskStatus,
      completed: t.completed,
      createdAt: t.createdAt.toISOString(),
    }));
  });

  // POST /v1/tasks
  fastify.post('/', async (request, reply): Promise<Task> => {
    const parsed = createTaskSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { title, assigneeId, dueDate, status } = parsed.data;

    const task = await fastify.prisma.task.create({
      data: {
        title,
        assigneeId,
        dueDate: dueDate ? new Date(dueDate) : null,
        status,
      },
    });

    return {
      id: task.id,
      title: task.title,
      assigneeId: task.assigneeId ?? undefined,
      dueDate: task.dueDate?.toISOString(),
      status: task.status as TaskStatus,
      completed: task.completed,
      createdAt: task.createdAt.toISOString(),
    };
  });

  // PATCH /v1/tasks/:id
  fastify.patch<{ Params: { id: string } }>(
    '/:id',
    async (request, reply): Promise<Task> => {
      const { id } = request.params;
      const parsed = updateTaskSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { status, completed } = parsed.data;

      const existing = await fastify.prisma.task.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      const task = await fastify.prisma.task.update({
        where: { id },
        data: {
          ...(status !== undefined && { status }),
          ...(completed !== undefined && { completed }),
        },
      });

      return {
        id: task.id,
        title: task.title,
        assigneeId: task.assigneeId ?? undefined,
        dueDate: task.dueDate?.toISOString(),
        status: task.status as TaskStatus,
        completed: task.completed,
        createdAt: task.createdAt.toISOString(),
      };
    }
  );
};

export default tasksRoutes;
