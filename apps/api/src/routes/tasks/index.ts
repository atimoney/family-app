import type { FastifyPluginAsync } from 'fastify';
import type { Task, TaskStatus, TaskPriority, TaskRecurrenceRule } from '@family/shared';
import { Prisma } from '@prisma/client';
import { createTaskSchema, updateTaskSchema, tasksQuerySchema } from './schema.js';
import authPlugin from '../../plugins/auth.js';
import { decryptSecret } from '../../lib/crypto.js';
import { getAuthorizedClient, getOAuthClient } from '../../lib/google/oauth.js';
import { createEvent } from '../../lib/google/calendar.js';

// ----------------------------------------------------------------------

type DbTask = {
  id: string;
  familyId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: Date | null;
  completedAt: Date | null;
  assignedToUserId: string | null;
  createdByUserId: string;
  isRecurring: boolean;
  recurrenceRule: unknown;
  parentTaskId: string | null;
  recurrenceIndex: number | null;
  // Calendar linking
  linkedCalendarEventId: string | null;
  linkedCalendarId: string | null;
  linkedGoogleAccountId: string | null;
  labels: string[];
  sortOrder: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapTaskToApi(t: DbTask): Task {
  return {
    id: t.id,
    familyId: t.familyId,
    title: t.title,
    description: t.description,
    status: t.status as TaskStatus,
    priority: t.priority as TaskPriority,
    dueAt: t.dueAt?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    assignedToUserId: t.assignedToUserId,
    createdByUserId: t.createdByUserId,
    isRecurring: t.isRecurring,
    recurrence: t.recurrenceRule as TaskRecurrenceRule | null,
    parentTaskId: t.parentTaskId,
    recurrenceIndex: t.recurrenceIndex,
    linkedCalendarEventId: t.linkedCalendarEventId,
    linkedCalendarId: t.linkedCalendarId,
    linkedGoogleAccountId: t.linkedGoogleAccountId,
    labels: t.labels,
    sortOrder: t.sortOrder,
    deletedAt: t.deletedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

// ----------------------------------------------------------------------

const tasksRoutes: FastifyPluginAsync = async (fastify) => {
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
  // GET /v1/tasks - List tasks for user's family
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

    const parsedQuery = tasksQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsedQuery.error.flatten().fieldErrors,
      });
    }

    const { status, assignedTo, dueBefore, dueAfter, includeCompleted, labels, search } =
      parsedQuery.data;

    // Build where clause
    type TaskWhereInput = NonNullable<Parameters<typeof fastify.prisma.task.findMany>[0]>['where'];
    const where: TaskWhereInput = {
      familyId: membership.familyId,
      deletedAt: null,
    };

    // Status filter
    const statusArray = status ? (Array.isArray(status) ? status : [status]) : null;
    if (statusArray) {
      where.status = { in: statusArray };
    }

    // Don't show done tasks by default (unless includeCompleted or filtering for done)
    const filteringForDone = statusArray?.includes('done');
    if (!includeCompleted && !filteringForDone) {
      where.OR = [{ status: { not: 'done' } }, { completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }];
    }

    // Assignee filter
    if (assignedTo === 'unassigned') {
      where.assignedToUserId = null;
    } else if (assignedTo) {
      where.assignedToUserId = assignedTo;
    }

    // Due date filters
    if (dueBefore) {
      where.dueAt = { ...((where.dueAt as object) || {}), lte: new Date(dueBefore) };
    }
    if (dueAfter) {
      where.dueAt = { ...((where.dueAt as object) || {}), gte: new Date(dueAfter) };
    }

    // Labels filter (any match)
    if (labels) {
      const labelArray = labels.split(',').map((l) => l.trim());
      where.labels = { hasSome: labelArray };
    }

    // Search filter
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const tasks = await fastify.prisma.task.findMany({
      where,
      orderBy: [{ dueAt: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return tasks.map(mapTaskToApi);
  });

  // ----------------------------------------------------------------------
  // GET /v1/tasks/:id - Get a single task
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

      const task = await fastify.prisma.task.findFirst({
        where: {
          id,
          familyId: membership.familyId,
          deletedAt: null,
        },
      });

      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      return mapTaskToApi(task);
    }
  );

  // ----------------------------------------------------------------------
  // POST /v1/tasks - Create a task
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

    const parsed = createTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { title, description, status, priority, dueAt, assignedToUserId, labels, recurrence } = parsed.data;

    const task = await fastify.prisma.task.create({
      data: {
        familyId: membership.familyId,
        title,
        description: description ?? null,
        status,
        priority,
        dueAt: dueAt ? new Date(dueAt) : null,
        assignedToUserId: assignedToUserId ?? null,
        createdByUserId: membership.id,
        labels: labels ?? [],
        // Recurrence fields
        isRecurring: !!recurrence,
        recurrenceRule: recurrence ?? undefined,
      },
    });

    return reply.status(201).send(mapTaskToApi(task));
  });

  // ----------------------------------------------------------------------
  // PATCH /v1/tasks/:id - Update a task
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
      const parsed = updateTaskSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const existing = await fastify.prisma.task.findFirst({
        where: { id, familyId: membership.familyId, deletedAt: null },
      });
      if (!existing) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      const { title, description, status, priority, dueAt, completedAt, assignedToUserId, labels, sortOrder, recurrence } =
        parsed.data;

      // Auto-set completedAt when marking as done
      let finalCompletedAt = completedAt !== undefined ? (completedAt ? new Date(completedAt) : null) : undefined;
      if (status === 'done' && !existing.completedAt && finalCompletedAt === undefined) {
        finalCompletedAt = new Date();
      } else if (status && status !== 'done' && existing.completedAt) {
        finalCompletedAt = null;
      }

      // Build update data object
      type TaskUpdateData = Parameters<typeof fastify.prisma.task.update>[0]['data'];
      const updateData: TaskUpdateData = {};
      
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (status !== undefined) updateData.status = status;
      if (priority !== undefined) updateData.priority = priority;
      if (dueAt !== undefined) updateData.dueAt = dueAt ? new Date(dueAt) : null;
      if (finalCompletedAt !== undefined) updateData.completedAt = finalCompletedAt;
      if (assignedToUserId !== undefined) updateData.assignedToUserId = assignedToUserId;
      if (labels !== undefined) updateData.labels = labels;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      
      // Handle recurrence update
      if (recurrence !== undefined) {
        if (recurrence === null) {
          // Remove recurrence
          updateData.isRecurring = false;
          updateData.recurrenceRule = Prisma.DbNull;
        } else {
          // Set/update recurrence
          updateData.isRecurring = true;
          updateData.recurrenceRule = recurrence;
        }
      }

      const task = await fastify.prisma.task.update({
        where: { id },
        data: updateData,
      });

      return mapTaskToApi(task);
    }
  );

  // ----------------------------------------------------------------------
  // DELETE /v1/tasks/:id - Soft delete a task
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

      const existing = await fastify.prisma.task.findFirst({
        where: { id, familyId: membership.familyId, deletedAt: null },
      });
      if (!existing) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      await fastify.prisma.task.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      return { ok: true };
    }
  );

  // ----------------------------------------------------------------------
  // POST /v1/tasks/bulk-update - Bulk update tasks (for drag-drop, etc.)
  // ----------------------------------------------------------------------
  fastify.post<{ Body: { updates: Array<{ id: string; status?: string; sortOrder?: number }> } }>(
    '/bulk-update',
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

      const { updates } = request.body;
      if (!Array.isArray(updates) || updates.length === 0) {
        return reply.status(400).send({ error: 'Updates array required' });
      }

      // Process updates in transaction
      const results = await fastify.prisma.$transaction(
        updates.map((update) =>
          fastify.prisma.task.updateMany({
            where: {
              id: update.id,
              familyId: membership.familyId,
              deletedAt: null,
            },
            data: {
              ...(update.status !== undefined && { status: update.status }),
              ...(update.sortOrder !== undefined && { sortOrder: update.sortOrder }),
              ...(update.status === 'done' && { completedAt: new Date() }),
            },
          })
        )
      );

      return { ok: true, updated: results.reduce((sum, r) => sum + r.count, 0) };
    }
  );

  // ----------------------------------------------------------------------
  // POST /v1/tasks/:id/complete-and-generate-next - Complete recurring task and create next occurrence
  // ----------------------------------------------------------------------
  fastify.post<{ Params: { id: string } }>(
    '/:id/complete-and-generate-next',
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

      const task = await fastify.prisma.task.findFirst({
        where: { id, familyId: membership.familyId, deletedAt: null },
      });

      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      if (!task.isRecurring || !task.recurrenceRule) {
        return reply.status(400).send({ error: 'Task is not recurring' });
      }

      // Complete the current task
      const completedTask = await fastify.prisma.task.update({
        where: { id },
        data: {
          status: 'done',
          completedAt: new Date(),
        },
      });

      // Calculate next due date based on recurrence rule
      const rule = task.recurrenceRule as {
        frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
        interval?: number;
        count?: number;
        until?: string;
        byDay?: string[];
        byMonthDay?: number[];
      };

      // Check if we should stop generating
      const currentIndex = task.recurrenceIndex ?? 0;
      if (rule.count && currentIndex >= rule.count - 1) {
        return mapTaskToApi(completedTask); // No more occurrences
      }

      if (rule.until && new Date(rule.until) < new Date()) {
        return mapTaskToApi(completedTask); // Past end date
      }

      // Calculate next due date
      const baseDueDate = task.dueAt ?? new Date();
      const nextDueDate = calculateNextOccurrence(baseDueDate, rule);

      if (!nextDueDate || (rule.until && nextDueDate > new Date(rule.until))) {
        return mapTaskToApi(completedTask); // No valid next date
      }

      // Create next occurrence
      const nextTask = await fastify.prisma.task.create({
        data: {
          familyId: task.familyId,
          title: task.title,
          description: task.description,
          status: 'todo',
          priority: task.priority,
          dueAt: nextDueDate,
          assignedToUserId: task.assignedToUserId,
          createdByUserId: task.createdByUserId,
          labels: task.labels,
          isRecurring: true,
          recurrenceRule: task.recurrenceRule as object,
          parentTaskId: task.parentTaskId ?? task.id, // Link to original recurring task
          recurrenceIndex: currentIndex + 1,
        },
      });

      return {
        completed: mapTaskToApi(completedTask),
        next: mapTaskToApi(nextTask),
      };
    }
  );

  // ----------------------------------------------------------------------
  // POST /v1/tasks/:id/create-calendar-event - Create a calendar event from a task
  // ----------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
    Body: { calendarId?: string; duration?: number };
  }>(
    '/:id/create-calendar-event',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const membership = await fastify.prisma.familyMember.findFirst({
        where: { profileId: userId, removedAt: null },
      });
      if (!membership) {
        return reply.status(403).send({ error: 'Not a family member' });
      }

      const { id } = request.params;
      const { calendarId, duration = 60 } = request.body ?? {};

      // Find the task
      const task = await fastify.prisma.task.findFirst({
        where: { id, familyId: membership.familyId, deletedAt: null },
      });
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Check if already linked
      if (task.linkedCalendarEventId) {
        return reply.status(400).send({ error: 'Task already has a linked calendar event' });
      }

      // Must have a due date to create calendar event
      if (!task.dueAt) {
        return reply.status(400).send({ error: 'Task must have a due date to create a calendar event' });
      }

      // Get Google account
      const googleAccount = await fastify.prisma.googleAccount.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });
      if (!googleAccount) {
        return reply.status(400).send({ error: 'Google account not connected' });
      }

      const refreshToken = decryptSecret(googleAccount.refreshToken, fastify.config.TOKEN_ENCRYPTION_KEY);

      // Resolve calendar ID
      let resolvedCalendarId = calendarId;
      if (!resolvedCalendarId) {
        const selectedCalendar = await fastify.prisma.selectedCalendar.findFirst({
          where: { userId, isVisible: true },
          orderBy: { createdAt: 'asc' },
        });
        resolvedCalendarId = selectedCalendar?.calendarId ?? 'primary';
      }

      // Create OAuth client
      const oauthClient = getAuthorizedClient({
        oauthClient: getOAuthClient({
          clientId: fastify.config.GOOGLE_CLIENT_ID,
          clientSecret: fastify.config.GOOGLE_CLIENT_SECRET,
          redirectUri: fastify.config.GOOGLE_REDIRECT_URL,
        }),
        refreshToken,
      });

      // Create calendar event
      const startTime = task.dueAt;
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

      const event = await createEvent({
        auth: oauthClient,
        calendarId: resolvedCalendarId,
        event: {
          summary: task.title,
          description: task.description ?? undefined,
          start: { dateTime: startTime.toISOString() },
          end: { dateTime: endTime.toISOString() },
        },
      });

      if (!event.id) {
        return reply.status(500).send({ error: 'Failed to create calendar event' });
      }

      // Update task with calendar link
      const updatedTask = await fastify.prisma.task.update({
        where: { id },
        data: {
          linkedCalendarEventId: event.id,
          linkedCalendarId: resolvedCalendarId,
          linkedGoogleAccountId: googleAccount.id,
        },
      });

      return {
        task: mapTaskToApi(updatedTask),
        calendarEvent: {
          id: event.id,
          calendarId: resolvedCalendarId,
          htmlLink: event.htmlLink,
        },
      };
    }
  );

  // ----------------------------------------------------------------------
  // DELETE /v1/tasks/:id/unlink-calendar-event - Unlink (optionally delete) calendar event
  // ----------------------------------------------------------------------
  fastify.delete<{
    Params: { id: string };
    Querystring: { deleteEvent?: string };
  }>(
    '/:id/unlink-calendar-event',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const membership = await fastify.prisma.familyMember.findFirst({
        where: { profileId: userId, removedAt: null },
      });
      if (!membership) {
        return reply.status(403).send({ error: 'Not a family member' });
      }

      const { id } = request.params;
      const deleteEvent = request.query.deleteEvent === 'true';

      // Find the task
      const task = await fastify.prisma.task.findFirst({
        where: { id, familyId: membership.familyId, deletedAt: null },
      });
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      if (!task.linkedCalendarEventId) {
        return reply.status(400).send({ error: 'Task has no linked calendar event' });
      }

      // Optionally delete the calendar event from Google
      if (deleteEvent && task.linkedGoogleAccountId && task.linkedCalendarId) {
        const googleAccount = await fastify.prisma.googleAccount.findFirst({
          where: { id: task.linkedGoogleAccountId },
        });

        if (googleAccount) {
          try {
            const refreshToken = decryptSecret(googleAccount.refreshToken, fastify.config.TOKEN_ENCRYPTION_KEY);
            const oauthClient = getAuthorizedClient({
              oauthClient: getOAuthClient({
                clientId: fastify.config.GOOGLE_CLIENT_ID,
                clientSecret: fastify.config.GOOGLE_CLIENT_SECRET,
                redirectUri: fastify.config.GOOGLE_REDIRECT_URL,
              }),
              refreshToken,
            });

            // Import deleteEvent dynamically to avoid issues
            const { deleteEvent: deleteGoogleEvent } = await import('../../lib/google/calendar.js');
            await deleteGoogleEvent({
              auth: oauthClient,
              calendarId: task.linkedCalendarId,
              eventId: task.linkedCalendarEventId,
            });
          } catch (error) {
            console.error('Failed to delete Google Calendar event:', error);
            // Continue with unlinking even if Google deletion fails
          }
        }
      }

      // Update task to remove calendar link
      const updatedTask = await fastify.prisma.task.update({
        where: { id },
        data: {
          linkedCalendarEventId: null,
          linkedCalendarId: null,
          linkedGoogleAccountId: null,
        },
      });

      return mapTaskToApi(updatedTask);
    }
  );
};

// Helper function to calculate next occurrence date
function calculateNextOccurrence(
  currentDate: Date,
  rule: {
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
    interval?: number;
    byDay?: string[];
    byMonthDay?: number[];
  }
): Date | null {
  const interval = rule.interval ?? 1;
  const next = new Date(currentDate);

  switch (rule.frequency) {
    case 'DAILY':
      next.setDate(next.getDate() + interval);
      break;

    case 'WEEKLY':
      if (rule.byDay && rule.byDay.length > 0) {
        // Find next matching day
        const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
        const targetDays = rule.byDay.map((d) => dayMap[d]).sort((a, b) => a - b);
        const currentDay = next.getDay();

        // Find next day in the list
        let foundNext = false;
        for (const targetDay of targetDays) {
          if (targetDay > currentDay) {
            next.setDate(next.getDate() + (targetDay - currentDay));
            foundNext = true;
            break;
          }
        }
        if (!foundNext) {
          // Wrap to next week
          const daysUntilNextWeek = 7 - currentDay + targetDays[0];
          next.setDate(next.getDate() + daysUntilNextWeek + (interval - 1) * 7);
        }
      } else {
        next.setDate(next.getDate() + interval * 7);
      }
      break;

    case 'MONTHLY':
      if (rule.byMonthDay && rule.byMonthDay.length > 0) {
        const currentMonthDay = next.getDate();
        const sortedDays = [...rule.byMonthDay].sort((a, b) => a - b);

        // Find next day in current month
        let foundInCurrentMonth = false;
        for (const targetDay of sortedDays) {
          if (targetDay > currentMonthDay) {
            next.setDate(targetDay);
            foundInCurrentMonth = true;
            break;
          }
        }
        if (!foundInCurrentMonth) {
          // Move to next month
          next.setMonth(next.getMonth() + interval);
          next.setDate(sortedDays[0]);
        }
      } else {
        next.setMonth(next.getMonth() + interval);
      }
      break;

    case 'YEARLY':
      next.setFullYear(next.getFullYear() + interval);
      break;

    default:
      return null;
  }

  return next;
}

export default tasksRoutes;
