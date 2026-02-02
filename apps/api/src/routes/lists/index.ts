import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import type {
  ListDTO,
  ListItemDTO,
  UserListPreferencesDTO,
  ListConfig,
  ListTemplateKey,
  ListNavVisibility,
  ListViewKey,
  ListItemStatus,
} from '@family/shared';
import { getDefaultListConfig } from '@family/shared';
import {
  createListSchema,
  updateListSchema,
  listsQuerySchema,
  createListItemSchema,
  updateListItemSchema,
  listItemsQuerySchema,
  userListPreferencesSchema,
  generateShoppingSchema,
} from './schema.js';
import authPlugin from '../../plugins/auth.js';

// ----------------------------------------------------------------------
// DB -> DTO MAPPERS
// ----------------------------------------------------------------------

type DbList = {
  id: string;
  familyId: string;
  name: string;
  templateKey: string;
  navVisibility: string;
  config: unknown;
  icon: string | null;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
};

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

type DbUserListPreferences = {
  userId: string;
  listId: string;
  lastViewKey: string | null;
  prefs: unknown;
  updatedAt: Date;
};

function mapListToApi(list: DbList): ListDTO {
  return {
    id: list.id,
    familyId: list.familyId,
    name: list.name,
    templateKey: list.templateKey as ListTemplateKey,
    navVisibility: list.navVisibility as ListNavVisibility,
    config: list.config as ListConfig,
    icon: list.icon,
    color: list.color,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
  };
}

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

function mapPreferencesToApi(prefs: DbUserListPreferences): UserListPreferencesDTO {
  const parsed = prefs.prefs as {
    sort?: { field: string; direction: 'asc' | 'desc' } | null;
    filters?: Record<string, unknown> | null;
    collapsedGroups?: string[] | null;
  };

  return {
    userId: prefs.userId,
    listId: prefs.listId,
    lastViewKey: prefs.lastViewKey as ListViewKey | null,
    sort: parsed?.sort ?? null,
    filters: parsed?.filters ?? null,
    collapsedGroups: parsed?.collapsedGroups ?? null,
  };
}

// ----------------------------------------------------------------------
// ROUTES
// ----------------------------------------------------------------------

const listsRoutes: FastifyPluginAsync = async (fastify) => {
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

  // Helper to verify list belongs to user's family
  async function getListIfAllowed(listId: string, familyId: string) {
    const list = await fastify.prisma.list.findFirst({
      where: {
        id: listId,
        familyId,
      },
    });
    return list;
  }

  // ============================================================================
  // LIST ROUTES
  // ============================================================================

  // ----------------------------------------------------------------------
  // GET /api/lists - List all lists for current family
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

    const parsedQuery = listsQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsedQuery.error.flatten().fieldErrors,
      });
    }

    const { navVisibility, templateKey } = parsedQuery.data;

    // Build where clause
    type ListWhereInput = NonNullable<Parameters<typeof fastify.prisma.list.findMany>[0]>['where'];
    const where: ListWhereInput = {
      familyId: membership.familyId,
    };

    if (navVisibility) {
      where.navVisibility = navVisibility;
    }

    if (templateKey) {
      where.templateKey = templateKey;
    }

    const lists = await fastify.prisma.list.findMany({
      where,
      orderBy: [{ navVisibility: 'asc' }, { name: 'asc' }],
    });

    return lists.map(mapListToApi);
  });

  // ----------------------------------------------------------------------
  // POST /api/lists - Create a new list
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

    const parsed = createListSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, templateKey, navVisibility, config, icon, color } = parsed.data;

    // Use provided config or get default based on template
    const finalConfig = config ?? getDefaultListConfig(templateKey);

    const list = await fastify.prisma.list.create({
      data: {
        familyId: membership.familyId,
        name,
        templateKey,
        navVisibility,
        config: finalConfig as unknown as Prisma.InputJsonValue,
        icon: icon ?? null,
        color: color ?? null,
      },
    });

    return reply.status(201).send(mapListToApi(list));
  });

  // ----------------------------------------------------------------------
  // GET /api/lists/:listId - Get a single list with optional items summary
  // ----------------------------------------------------------------------
  fastify.get<{ Params: { listId: string }; Querystring: { includeItems?: string } }>(
    '/:listId',
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

      const { listId } = request.params;
      const includeItems = request.query.includeItems === 'true';

      const list = await getListIfAllowed(listId, membership.familyId);
      if (!list) {
        return reply.status(404).send({ error: 'List not found' });
      }

      const response: ListDTO & { items?: ListItemDTO[]; itemCount?: number } = mapListToApi(list);

      if (includeItems) {
        const items = await fastify.prisma.listItem.findMany({
          where: { listId },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        });
        response.items = items.map(mapListItemToApi);
      } else {
        // Just return counts
        const itemCount = await fastify.prisma.listItem.count({
          where: { listId, status: { not: 'archived' } },
        });
        response.itemCount = itemCount;
      }

      return response;
    }
  );

  // ----------------------------------------------------------------------
  // PATCH /api/lists/:listId - Update a list
  // ----------------------------------------------------------------------
  fastify.patch<{ Params: { listId: string } }>(
    '/:listId',
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

      const { listId } = request.params;

      const list = await getListIfAllowed(listId, membership.familyId);
      if (!list) {
        return reply.status(404).send({ error: 'List not found' });
      }

      const parsed = updateListSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { name, navVisibility, config, icon, color } = parsed.data;

      const updatedList = await fastify.prisma.list.update({
        where: { id: listId },
        data: {
          ...(name !== undefined && { name }),
          ...(navVisibility !== undefined && { navVisibility }),
          ...(config !== undefined && { config: config as unknown as Prisma.InputJsonValue }),
          ...(icon !== undefined && { icon }),
          ...(color !== undefined && { color }),
        },
      });

      return mapListToApi(updatedList);
    }
  );

  // ----------------------------------------------------------------------
  // DELETE /api/lists/:listId - Delete a list (cascades to items & prefs)
  // ----------------------------------------------------------------------
  fastify.delete<{ Params: { listId: string } }>(
    '/:listId',
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

      const { listId } = request.params;

      const list = await getListIfAllowed(listId, membership.familyId);
      if (!list) {
        return reply.status(404).send({ error: 'List not found' });
      }

      await fastify.prisma.list.delete({
        where: { id: listId },
      });

      return reply.status(204).send();
    }
  );

  // ============================================================================
  // LIST ITEM ROUTES
  // ============================================================================

  // ----------------------------------------------------------------------
  // GET /api/lists/:listId/items - Get items for a list
  // ----------------------------------------------------------------------
  fastify.get<{ Params: { listId: string } }>(
    '/:listId/items',
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

      const { listId } = request.params;

      const list = await getListIfAllowed(listId, membership.familyId);
      if (!list) {
        return reply.status(404).send({ error: 'List not found' });
      }

      const parsedQuery = listItemsQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsedQuery.error.flatten().fieldErrors,
        });
      }

      const { status, includeArchived } = parsedQuery.data;

      // Build where clause
      type ListItemWhereInput = NonNullable<
        Parameters<typeof fastify.prisma.listItem.findMany>[0]
      >['where'];
      const where: ListItemWhereInput = { listId };

      // Status filter
      const statusArray = status ? (Array.isArray(status) ? status : [status]) : null;
      if (statusArray) {
        where.status = { in: statusArray };
      } else if (!includeArchived) {
        // By default, exclude archived items
        where.status = { not: 'archived' };
      }

      const items = await fastify.prisma.listItem.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      });

      return items.map(mapListItemToApi);
    }
  );

  // ----------------------------------------------------------------------
  // POST /api/lists/:listId/items - Create a new list item
  // ----------------------------------------------------------------------
  fastify.post<{ Params: { listId: string } }>(
    '/:listId/items',
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

      const { listId } = request.params;

      const list = await getListIfAllowed(listId, membership.familyId);
      if (!list) {
        return reply.status(404).send({ error: 'List not found' });
      }

      const parsed = createListItemSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { title, status, sortOrder, dueAt, assignedToUserId, fields } = parsed.data;

      // If no sortOrder provided, put at end
      let finalSortOrder = sortOrder;
      if (finalSortOrder === undefined) {
        const maxSort = await fastify.prisma.listItem.aggregate({
          where: { listId },
          _max: { sortOrder: true },
        });
        finalSortOrder = (maxSort._max.sortOrder ?? 0) + 1;
      }

      const item = await fastify.prisma.listItem.create({
        data: {
          listId,
          title,
          status,
          sortOrder: finalSortOrder,
          dueAt: dueAt ? new Date(dueAt) : null,
          assignedToUserId: assignedToUserId ?? null,
          fields: (fields ?? {}) as Prisma.InputJsonValue,
        },
      });

      return reply.status(201).send(mapListItemToApi(item));
    }
  );

  // ============================================================================
  // USER LIST PREFERENCES ROUTES
  // ============================================================================

  // ----------------------------------------------------------------------
  // GET /api/lists/:listId/preferences - Get user preferences for a list
  // ----------------------------------------------------------------------
  fastify.get<{ Params: { listId: string } }>(
    '/:listId/preferences',
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

      const { listId } = request.params;

      const list = await getListIfAllowed(listId, membership.familyId);
      if (!list) {
        return reply.status(404).send({ error: 'List not found' });
      }

      const prefs = await fastify.prisma.userListPreferences.findUnique({
        where: {
          userId_listId: {
            userId,
            listId,
          },
        },
      });

      if (!prefs) {
        // Return default empty preferences
        return {
          userId,
          listId,
          lastViewKey: null,
          sort: null,
          filters: null,
          collapsedGroups: null,
        };
      }

      return mapPreferencesToApi(prefs);
    }
  );

  // ----------------------------------------------------------------------
  // PUT /api/lists/:listId/preferences - Upsert user preferences for a list
  // ----------------------------------------------------------------------
  fastify.put<{ Params: { listId: string } }>(
    '/:listId/preferences',
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

      const { listId } = request.params;

      const list = await getListIfAllowed(listId, membership.familyId);
      if (!list) {
        return reply.status(404).send({ error: 'List not found' });
      }

      const parsed = userListPreferencesSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { lastViewKey, sort, filters, collapsedGroups } = parsed.data;

      const prefs = await fastify.prisma.userListPreferences.upsert({
        where: {
          userId_listId: {
            userId,
            listId,
          },
        },
        create: {
          userId,
          listId,
          lastViewKey: lastViewKey ?? null,
          prefs: {
            sort: sort ?? null,
            filters: filters ?? null,
            collapsedGroups: collapsedGroups ?? null,
          } as Prisma.InputJsonValue,
        },
        update: {
          lastViewKey: lastViewKey ?? null,
          prefs: {
            sort: sort ?? null,
            filters: filters ?? null,
            collapsedGroups: collapsedGroups ?? null,
          } as Prisma.InputJsonValue,
        },
      });

      return mapPreferencesToApi(prefs);
    }
  );

  // ----------------------------------------------------------------------
  // POST /lists/:listId/generate-shopping - Generate shopping list from meal plan
  // ----------------------------------------------------------------------
  fastify.post<{ Params: { listId: string }; Body: { weekStart: string; targetListId: string } }>(
    '/:listId/generate-shopping',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user?.id;
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

      const membership = await getUserFamilyMembership(userId);
      if (!membership) {
        return reply.status(403).send({ error: 'No family membership found' });
      }

      const { listId } = request.params;

      // Validate input
      const parsed = generateShoppingSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { weekStart, targetListId } = parsed.data;

      // Get source meal plan list
      const mealPlanList = await getListIfAllowed(listId, membership.familyId);
      if (!mealPlanList) {
        return reply.status(404).send({ error: 'Meal plan list not found' });
      }

      if (mealPlanList.templateKey !== 'meal_plan') {
        return reply.status(400).send({ error: 'Source list must be a meal plan' });
      }

      // Get target shopping list
      const shoppingList = await getListIfAllowed(targetListId, membership.familyId);
      if (!shoppingList) {
        return reply.status(404).send({ error: 'Target shopping list not found' });
      }

      if (shoppingList.templateKey !== 'shopping') {
        return reply.status(400).send({ error: 'Target list must be a shopping list' });
      }

      // Calculate week end (7 days from start)
      const weekStartDate = new Date(weekStart);
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekEndDate.getDate() + 6);
      const weekEnd = weekEndDate.toISOString().split('T')[0];

      // Get meal plan items for the week
      const mealPlanItems = await fastify.prisma.listItem.findMany({
        where: {
          listId,
        },
      });

      // Filter items by date range (fields.date)
      const itemsInWeek = mealPlanItems.filter((item) => {
        const fields = item.fields as Record<string, unknown> | null;
        const itemDate = fields?.date as string | undefined;
        if (!itemDate) return false;
        return itemDate >= weekStart && itemDate <= weekEnd;
      });

      if (itemsInWeek.length === 0) {
        return { itemsCreated: 0, message: 'No meal plan items found for this week' };
      }

      // Create shopping list items from meal plan items
      const now = new Date();
      const itemsToCreate = itemsInWeek.map((mealItem) => {
        const mealFields = mealItem.fields as Record<string, unknown> | null;
        return {
          id: crypto.randomUUID(),
          listId: targetListId,
          title: mealItem.title,
          status: 'pending' as const,
          sortOrder: 0,
          fields: {
            source: `meal_plan:${listId}:${mealItem.id}`,
            notes: mealFields?.notes || null,
          } as Prisma.InputJsonValue,
          createdAt: now,
          updatedAt: now,
        };
      });

      // Bulk create items
      await fastify.prisma.listItem.createMany({
        data: itemsToCreate,
      });

      return {
        itemsCreated: itemsToCreate.length,
        message: `Added ${itemsToCreate.length} items to shopping list`,
      };
    }
  );
};

export default listsRoutes;
