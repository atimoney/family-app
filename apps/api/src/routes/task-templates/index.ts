import type { FastifyPluginAsync } from 'fastify';
import type { TaskTemplate, TaskPriority } from '@family/shared';

import authPlugin from '../../plugins/auth.js';
import {
  createTaskTemplateSchema,
  updateTaskTemplateSchema,
  taskTemplatesQuerySchema,
  createTaskFromTemplateSchema,
} from './schema.js';

// ----------------------------------------------------------------------

function mapTemplateToApi(t: {
  id: string;
  familyId: string;
  name: string;
  title: string;
  description: string | null;
  priority: string;
  labels: string[];
  defaultAssigneeId: string | null;
  dueDaysFromNow: number | null;
  dueTimeOfDay: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  usageCount: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): TaskTemplate {
  return {
    id: t.id,
    familyId: t.familyId,
    name: t.name,
    title: t.title,
    description: t.description,
    priority: t.priority as TaskPriority,
    labels: t.labels,
    defaultAssigneeId: t.defaultAssigneeId,
    dueDaysFromNow: t.dueDaysFromNow,
    dueTimeOfDay: t.dueTimeOfDay,
    icon: t.icon,
    color: t.color,
    sortOrder: t.sortOrder,
    usageCount: t.usageCount,
    deletedAt: t.deletedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

// ----------------------------------------------------------------------

const taskTemplatesRoutes: FastifyPluginAsync = async (fastify) => {
  // Register auth plugin
  await fastify.register(authPlugin);

  // Helper to get user's family membership
  async function getUserFamilyMembership(userId: string) {
    const membership = await fastify.prisma.familyMember.findFirst({
      where: {
        profileId: userId,
        removedAt: null,
      },
      include: {
        family: true,
      },
    });
    return membership;
  }

  // ----------------------------------------------------------------------
  // GET /v1/task-templates - List templates for user's family
  // ----------------------------------------------------------------------
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user?.id;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const membership = await getUserFamilyMembership(userId);
    if (!membership) {
      return reply.status(404).send({ error: 'No family found' });
    }

    const parsedQuery = taskTemplatesQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsedQuery.error.flatten().fieldErrors,
      });
    }

    const { search, includeDeleted } = parsedQuery.data;

    type TemplateWhereInput = NonNullable<
      Parameters<typeof fastify.prisma.taskTemplate.findMany>[0]
    >['where'];
    const where: TemplateWhereInput = {
      familyId: membership.familyId,
    };

    if (!includeDeleted) {
      where.deletedAt = null;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    const templates = await fastify.prisma.taskTemplate.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { usageCount: 'desc' }, { name: 'asc' }],
    });

    return templates.map(mapTemplateToApi);
  });

  // ----------------------------------------------------------------------
  // GET /v1/task-templates/:id - Get a single template
  // ----------------------------------------------------------------------
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const membership = await getUserFamilyMembership(userId);
      if (!membership) {
        return reply.status(404).send({ error: 'No family found' });
      }

      const { id } = request.params;

      const template = await fastify.prisma.taskTemplate.findFirst({
        where: {
          id,
          familyId: membership.familyId,
        },
      });

      if (!template) {
        return reply.status(404).send({ error: 'Template not found' });
      }

      return mapTemplateToApi(template);
    }
  );

  // ----------------------------------------------------------------------
  // POST /v1/task-templates - Create a template
  // ----------------------------------------------------------------------
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user?.id;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const membership = await getUserFamilyMembership(userId);
    if (!membership) {
      return reply.status(404).send({ error: 'No family found' });
    }

    const parsed = createTaskTemplateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const data = parsed.data;

    // Check for duplicate name
    const existing = await fastify.prisma.taskTemplate.findFirst({
      where: {
        familyId: membership.familyId,
        name: data.name,
        deletedAt: null,
      },
    });

    if (existing) {
      return reply.status(409).send({ error: 'Template with this name already exists' });
    }

    // Validate defaultAssigneeId if provided
    if (data.defaultAssigneeId) {
      const assignee = await fastify.prisma.familyMember.findFirst({
        where: {
          id: data.defaultAssigneeId,
          familyId: membership.familyId,
          removedAt: null,
        },
      });

      if (!assignee) {
        return reply.status(400).send({ error: 'Invalid default assignee' });
      }
    }

    const template = await fastify.prisma.taskTemplate.create({
      data: {
        familyId: membership.familyId,
        name: data.name,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority,
        labels: data.labels,
        defaultAssigneeId: data.defaultAssigneeId ?? null,
        dueDaysFromNow: data.dueDaysFromNow ?? null,
        dueTimeOfDay: data.dueTimeOfDay ?? null,
        icon: data.icon ?? null,
        color: data.color ?? null,
        sortOrder: data.sortOrder,
      },
    });

    return reply.status(201).send(mapTemplateToApi(template));
  });

  // ----------------------------------------------------------------------
  // PATCH /v1/task-templates/:id - Update a template
  // ----------------------------------------------------------------------
  fastify.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const membership = await getUserFamilyMembership(userId);
      if (!membership) {
        return reply.status(404).send({ error: 'No family found' });
      }

      const { id } = request.params;

      const template = await fastify.prisma.taskTemplate.findFirst({
        where: {
          id,
          familyId: membership.familyId,
          deletedAt: null,
        },
      });

      if (!template) {
        return reply.status(404).send({ error: 'Template not found' });
      }

      const parsed = updateTaskTemplateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const data = parsed.data;

      // Check for duplicate name if changing name
      if (data.name && data.name !== template.name) {
        const existing = await fastify.prisma.taskTemplate.findFirst({
          where: {
            familyId: membership.familyId,
            name: data.name,
            deletedAt: null,
            id: { not: id },
          },
        });

        if (existing) {
          return reply.status(409).send({ error: 'Template with this name already exists' });
        }
      }

      // Validate defaultAssigneeId if provided
      if (data.defaultAssigneeId !== undefined && data.defaultAssigneeId !== null) {
        const assignee = await fastify.prisma.familyMember.findFirst({
          where: {
            id: data.defaultAssigneeId,
            familyId: membership.familyId,
            removedAt: null,
          },
        });

        if (!assignee) {
          return reply.status(400).send({ error: 'Invalid default assignee' });
        }
      }

      const updated = await fastify.prisma.taskTemplate.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.priority !== undefined && { priority: data.priority }),
          ...(data.labels !== undefined && { labels: data.labels }),
          ...(data.defaultAssigneeId !== undefined && { defaultAssigneeId: data.defaultAssigneeId }),
          ...(data.dueDaysFromNow !== undefined && { dueDaysFromNow: data.dueDaysFromNow }),
          ...(data.dueTimeOfDay !== undefined && { dueTimeOfDay: data.dueTimeOfDay }),
          ...(data.icon !== undefined && { icon: data.icon }),
          ...(data.color !== undefined && { color: data.color }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        },
      });

      return mapTemplateToApi(updated);
    }
  );

  // ----------------------------------------------------------------------
  // DELETE /v1/task-templates/:id - Soft delete a template
  // ----------------------------------------------------------------------
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const membership = await getUserFamilyMembership(userId);
      if (!membership) {
        return reply.status(404).send({ error: 'No family found' });
      }

      const { id } = request.params;

      const template = await fastify.prisma.taskTemplate.findFirst({
        where: {
          id,
          familyId: membership.familyId,
          deletedAt: null,
        },
      });

      if (!template) {
        return reply.status(404).send({ error: 'Template not found' });
      }

      await fastify.prisma.taskTemplate.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      return { success: true };
    }
  );

  // ----------------------------------------------------------------------
  // POST /v1/task-templates/:id/create-task - Create a task from template
  // ----------------------------------------------------------------------
  fastify.post<{ Params: { id: string } }>(
    '/:id/create-task',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const membership = await getUserFamilyMembership(userId);
      if (!membership) {
        return reply.status(404).send({ error: 'No family found' });
      }

      const { id } = request.params;

      const template = await fastify.prisma.taskTemplate.findFirst({
        where: {
          id,
          familyId: membership.familyId,
          deletedAt: null,
        },
      });

      if (!template) {
        return reply.status(404).send({ error: 'Template not found' });
      }

      const parsed = createTaskFromTemplateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const overrides = parsed.data;

      // Calculate due date if template has dueDaysFromNow
      let dueAt: Date | null = null;
      if (overrides.dueAt) {
        dueAt = new Date(overrides.dueAt);
      } else if (template.dueDaysFromNow !== null) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + template.dueDaysFromNow);

        // Apply time of day if specified
        if (template.dueTimeOfDay) {
          const [hours, minutes] = template.dueTimeOfDay.split(':').map(Number);
          dueDate.setHours(hours, minutes, 0, 0);
        } else {
          // Default to end of day
          dueDate.setHours(23, 59, 59, 0);
        }

        dueAt = dueDate;
      }

      // Create the task
      const task = await fastify.prisma.task.create({
        data: {
          familyId: membership.familyId,
          title: overrides.title ?? template.title,
          description: overrides.description ?? template.description,
          status: 'todo',
          priority: template.priority,
          labels: template.labels,
          assignedToUserId: overrides.assignedToUserId ?? template.defaultAssigneeId,
          createdByUserId: membership.id,
          dueAt,
        },
      });

      // Increment usage count
      await fastify.prisma.taskTemplate.update({
        where: { id },
        data: { usageCount: { increment: 1 } },
      });

      // Return task in API format
      return reply.status(201).send({
        id: task.id,
        familyId: task.familyId,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueAt: task.dueAt?.toISOString() ?? null,
        completedAt: task.completedAt?.toISOString() ?? null,
        assignedToUserId: task.assignedToUserId,
        createdByUserId: task.createdByUserId,
        labels: task.labels,
        sortOrder: task.sortOrder,
        deletedAt: task.deletedAt?.toISOString() ?? null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      });
    }
  );
};

export default taskTemplatesRoutes;
