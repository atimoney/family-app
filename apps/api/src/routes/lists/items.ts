import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import type { ListItemDTO, ListItemStatus } from '@family/shared';
import { updateListItemSchema } from './schema.js';
import authPlugin from '../../plugins/auth.js';

// ----------------------------------------------------------------------
// DB -> DTO MAPPER
// ----------------------------------------------------------------------

type DbListItem = {
  id: string;
  listId: string;
  title: string;
  status: string;
  sortOrder: number;
  dueAt: Date | null;
  assignedToUserId: string | null;
  fields: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function mapListItemToApi(item: DbListItem): ListItemDTO {
  return {
    id: item.id,
    listId: item.listId,
    title: item.title,
    status: item.status as ListItemStatus,
    sortOrder: item.sortOrder,
    dueAt: item.dueAt?.toISOString() ?? null,
    assignedToUserId: item.assignedToUserId,
    fields: item.fields as Record<string, unknown>,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

// ----------------------------------------------------------------------
// ROUTES
// ----------------------------------------------------------------------

const listItemsRoutes: FastifyPluginAsync = async (fastify) => {
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

  // Helper to get item and verify it belongs to user's family
  async function getItemIfAllowed(itemId: string, familyId: string) {
    const item = await fastify.prisma.listItem.findFirst({
      where: { id: itemId },
      include: {
        list: {
          select: { familyId: true },
        },
      },
    });

    if (!item || item.list.familyId !== familyId) {
      return null;
    }

    return item;
  }

  // ----------------------------------------------------------------------
  // PATCH /api/items/:itemId - Update a list item
  // ----------------------------------------------------------------------
  fastify.patch<{ Params: { itemId: string } }>(
    '/:itemId',
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

      const { itemId } = request.params;

      const item = await getItemIfAllowed(itemId, membership.familyId);
      if (!item) {
        return reply.status(404).send({ error: 'Item not found' });
      }

      const parsed = updateListItemSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { title, status, sortOrder, dueAt, assignedToUserId, fields } = parsed.data;

      // Merge fields if provided (partial update)
      let updatedFields = item.fields as Record<string, unknown>;
      if (fields !== undefined) {
        updatedFields = { ...updatedFields, ...fields };
      }

      const updatedItem = await fastify.prisma.listItem.update({
        where: { id: itemId },
        data: {
          ...(title !== undefined && { title }),
          ...(status !== undefined && { status }),
          ...(sortOrder !== undefined && { sortOrder }),
          ...(dueAt !== undefined && { dueAt: dueAt ? new Date(dueAt) : null }),
          ...(assignedToUserId !== undefined && { assignedToUserId }),
          ...(fields !== undefined && { fields: updatedFields as Prisma.InputJsonValue }),
        },
      });

      return mapListItemToApi(updatedItem);
    }
  );

  // ----------------------------------------------------------------------
  // DELETE /api/items/:itemId - Delete a list item
  // ----------------------------------------------------------------------
  fastify.delete<{ Params: { itemId: string } }>(
    '/:itemId',
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

      const { itemId } = request.params;

      const item = await getItemIfAllowed(itemId, membership.familyId);
      if (!item) {
        return reply.status(404).send({ error: 'Item not found' });
      }

      await fastify.prisma.listItem.delete({
        where: { id: itemId },
      });

      return reply.status(204).send();
    }
  );
};

export default listItemsRoutes;
