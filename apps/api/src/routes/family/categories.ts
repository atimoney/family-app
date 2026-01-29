import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import authPlugin from '../../plugins/auth.js';
import profilePlugin from '../../plugins/profile.js';

// ----------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------

export type EventCategoryConfig = {
  id: string;
  familyId: string;
  name: string;
  label: string;
  icon: string;
  color: string | null;
  sortOrder: number;
  isSystem: boolean;
  metadataSchema: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

// Default system categories - these are seeded for each family
// Colors are from MUI color palette for visual distinction
export const DEFAULT_CATEGORIES: Omit<EventCategoryConfig, 'id' | 'familyId' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'activity', label: 'Activity', icon: 'solar:cup-star-bold', color: '#FFB300', sortOrder: 0, isSystem: true, metadataSchema: {} }, // Amber 600
  { name: 'school', label: 'School', icon: 'mdi:school', color: '#1E88E5', sortOrder: 1, isSystem: true, metadataSchema: {} }, // Blue 600
  { name: 'sport', label: 'Sport', icon: 'solar:dumbbell-large-minimalistic-bold', color: '#43A047', sortOrder: 2, isSystem: true, metadataSchema: {} }, // Green 600
  { name: 'social', label: 'Social', icon: 'mdi:party-popper', color: '#E91E63', sortOrder: 3, isSystem: true, metadataSchema: {} }, // Pink 500
  { name: 'appointment', label: 'Appointment', icon: 'solar:calendar-date-bold', color: '#00ACC1', sortOrder: 4, isSystem: true, metadataSchema: {} }, // Cyan 600
  { name: 'work', label: 'Work', icon: 'mdi:briefcase', color: '#5E35B1', sortOrder: 5, isSystem: true, metadataSchema: {} }, // Deep Purple 600
  { name: 'travel', label: 'Travel', icon: 'mdi:airplane', color: '#FB8C00', sortOrder: 6, isSystem: true, metadataSchema: {} }, // Orange 600
  { name: 'home', label: 'Home', icon: 'mdi:home', color: '#8D6E63', sortOrder: 7, isSystem: true, metadataSchema: {} }, // Brown 400
  { name: 'admin', label: 'Admin', icon: 'solar:file-text-bold', color: '#757575', sortOrder: 8, isSystem: true, metadataSchema: {} }, // Grey 600
];

// ----------------------------------------------------------------------
// VALIDATION SCHEMAS
// ----------------------------------------------------------------------

const createCategorySchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-z][a-z0-9_]*$/, 'Name must be lowercase alphanumeric with underscores'),
  label: z.string().min(1).max(100),
  icon: z.string().min(1).max(200),
  color: z.string().max(20).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  metadataSchema: z.record(z.unknown()).optional(),
});

const updateCategorySchema = z.object({
  label: z.string().min(1).max(100).optional(),
  icon: z.string().min(1).max(200).optional(),
  color: z.string().max(20).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  metadataSchema: z.record(z.unknown()).optional(),
});

const reorderCategoriesSchema = z.object({
  categoryIds: z.array(z.string()),
});

// ----------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------

function toEventCategory(category: {
  id: string;
  familyId: string;
  name: string;
  label: string;
  icon: string;
  color: string | null;
  sortOrder: number;
  isSystem: boolean;
  metadataSchema: unknown;
  createdAt: Date;
  updatedAt: Date;
}): EventCategoryConfig {
  return {
    id: category.id,
    familyId: category.familyId,
    name: category.name,
    label: category.label,
    icon: category.icon,
    color: category.color,
    sortOrder: category.sortOrder,
    isSystem: category.isSystem,
    metadataSchema: (category.metadataSchema as Record<string, unknown>) ?? {},
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

// Seed default categories for a family (and update existing system categories with default colors)
export async function seedDefaultCategories(prisma: any, familyId: string): Promise<void> {
  const existing = await prisma.eventCategory.count({ where: { familyId } });
  
  if (existing === 0) {
    // No categories exist, create all defaults
    await prisma.eventCategory.createMany({
      data: DEFAULT_CATEGORIES.map((cat) => ({
        ...cat,
        familyId,
        metadataSchema: cat.metadataSchema ?? {},
      })),
    });
  } else {
    // Update system categories that have null colors with default colors
    for (const defaultCat of DEFAULT_CATEGORIES) {
      if (defaultCat.color) {
        await prisma.eventCategory.updateMany({
          where: {
            familyId,
            name: defaultCat.name,
            isSystem: true,
            color: null,
          },
          data: {
            color: defaultCat.color,
          },
        });
      }
    }
  }
}

// ----------------------------------------------------------------------
// ROUTES
// ----------------------------------------------------------------------

const categoriesRoutes: FastifyPluginAsync = async (fastify) => {
  // Register plugins
  await fastify.register(authPlugin);
  await fastify.register(profilePlugin);

  // GET /api/families/:familyId/categories - List all categories for a family
  fastify.get<{
    Params: { familyId: string };
    Reply: EventCategoryConfig[];
  }>(
    '/families/:familyId/categories',
    {
      preHandler: [fastify.authenticate, fastify.ensureProfile, fastify.loadMembership],
    },
    async (request, reply) => {
      const { familyId } = request.params;

      // Verify membership
      if (!request.membership || request.membership.familyId !== familyId) {
        return reply.code(403).send({ error: 'Not a member of this family' } as any);
      }

      // Seed default categories if none exist
      await seedDefaultCategories(fastify.prisma, familyId);

      const categories = await fastify.prisma.eventCategory.findMany({
        where: { familyId },
        orderBy: { sortOrder: 'asc' },
      });

      return categories.map(toEventCategory);
    }
  );

  // POST /api/families/:familyId/categories - Create a new category
  fastify.post<{
    Params: { familyId: string };
    Body: z.infer<typeof createCategorySchema>;
    Reply: EventCategoryConfig;
  }>(
    '/families/:familyId/categories',
    {
      preHandler: [fastify.authenticate, fastify.ensureProfile, fastify.loadMembership],
    },
    async (request, reply) => {
      const { familyId } = request.params;

      // Verify admin/owner role
      if (!request.membership || request.membership.familyId !== familyId) {
        return reply.code(403).send({ error: 'Not a member of this family' } as any);
      }
      
      const role = request.membership.role;
      if (role !== 'owner' && role !== 'admin') {
        return reply.code(403).send({ error: 'Only admins and owners can create categories' } as any);
      }

      const parsed = createCategorySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid request', details: parsed.error.issues } as any);
      }

      const { name, label, icon, color, sortOrder, metadataSchema } = parsed.data;

      // Check for duplicate name
      const existing = await fastify.prisma.eventCategory.findUnique({
        where: { familyId_name: { familyId, name } },
      });

      if (existing) {
        return reply.code(409).send({ error: 'Category with this name already exists' } as any);
      }

      // Get max sortOrder if not provided
      let finalSortOrder = sortOrder;
      if (finalSortOrder === undefined) {
        const maxOrder = await fastify.prisma.eventCategory.aggregate({
          where: { familyId },
          _max: { sortOrder: true },
        });
        finalSortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
      }

      const category = await fastify.prisma.eventCategory.create({
        data: {
          familyId,
          name,
          label,
          icon,
          color: color ?? null,
          sortOrder: finalSortOrder,
          isSystem: false,
          metadataSchema: (metadataSchema ?? {}) as Prisma.InputJsonValue,
        },
      });

      return toEventCategory(category);
    }
  );

  // PATCH /api/families/:familyId/categories/:categoryId - Update a category
  fastify.patch<{
    Params: { familyId: string; categoryId: string };
    Body: z.infer<typeof updateCategorySchema>;
    Reply: EventCategoryConfig;
  }>(
    '/families/:familyId/categories/:categoryId',
    {
      preHandler: [fastify.authenticate, fastify.ensureProfile, fastify.loadMembership],
    },
    async (request, reply) => {
      const { familyId, categoryId } = request.params;

      // Verify admin/owner role
      if (!request.membership || request.membership.familyId !== familyId) {
        return reply.code(403).send({ error: 'Not a member of this family' } as any);
      }
      
      const role = request.membership.role;
      if (role !== 'owner' && role !== 'admin') {
        return reply.code(403).send({ error: 'Only admins and owners can update categories' } as any);
      }

      const parsed = updateCategorySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid request', details: parsed.error.issues } as any);
      }

      // Find the category
      const category = await fastify.prisma.eventCategory.findUnique({
        where: { id: categoryId },
      });

      if (!category || category.familyId !== familyId) {
        return reply.code(404).send({ error: 'Category not found' } as any);
      }

      const { label, icon, color, sortOrder, metadataSchema } = parsed.data;

      const updated = await fastify.prisma.eventCategory.update({
        where: { id: categoryId },
        data: {
          ...(label !== undefined && { label }),
          ...(icon !== undefined && { icon }),
          ...(color !== undefined && { color }),
          ...(sortOrder !== undefined && { sortOrder }),
          ...(metadataSchema !== undefined && { metadataSchema: metadataSchema as Prisma.InputJsonValue }),
        },
      });

      return toEventCategory(updated);
    }
  );

  // DELETE /api/families/:familyId/categories/:categoryId - Delete a category
  fastify.delete<{
    Params: { familyId: string; categoryId: string };
    Reply: { success: boolean };
  }>(
    '/families/:familyId/categories/:categoryId',
    {
      preHandler: [fastify.authenticate, fastify.ensureProfile, fastify.loadMembership],
    },
    async (request, reply) => {
      const { familyId, categoryId } = request.params;

      // Verify admin/owner role
      if (!request.membership || request.membership.familyId !== familyId) {
        return reply.code(403).send({ error: 'Not a member of this family' } as any);
      }
      
      const role = request.membership.role;
      if (role !== 'owner' && role !== 'admin') {
        return reply.code(403).send({ error: 'Only admins and owners can delete categories' } as any);
      }

      // Find the category
      const category = await fastify.prisma.eventCategory.findUnique({
        where: { id: categoryId },
      });

      if (!category || category.familyId !== familyId) {
        return reply.code(404).send({ error: 'Category not found' } as any);
      }

      // Prevent deletion of system categories
      if (category.isSystem) {
        return reply.code(400).send({ error: 'System categories cannot be deleted' } as any);
      }

      // Check if category is in use (optional - could also allow deletion)
      const inUseCount = await fastify.prisma.calendarEventMetadata.count({
        where: { category: category.name },
      });

      if (inUseCount > 0) {
        return reply.code(400).send({ 
          error: `Category is in use by ${inUseCount} event(s). Remove category from events first.` 
        } as any);
      }

      await fastify.prisma.eventCategory.delete({
        where: { id: categoryId },
      });

      return { success: true };
    }
  );

  // POST /api/families/:familyId/categories/reorder - Reorder categories
  fastify.post<{
    Params: { familyId: string };
    Body: z.infer<typeof reorderCategoriesSchema>;
    Reply: EventCategoryConfig[];
  }>(
    '/families/:familyId/categories/reorder',
    {
      preHandler: [fastify.authenticate, fastify.ensureProfile, fastify.loadMembership],
    },
    async (request, reply) => {
      const { familyId } = request.params;

      // Verify admin/owner role
      if (!request.membership || request.membership.familyId !== familyId) {
        return reply.code(403).send({ error: 'Not a member of this family' } as any);
      }
      
      const role = request.membership.role;
      if (role !== 'owner' && role !== 'admin') {
        return reply.code(403).send({ error: 'Only admins and owners can reorder categories' } as any);
      }

      const parsed = reorderCategoriesSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid request', details: parsed.error.issues } as any);
      }

      const { categoryIds } = parsed.data;

      // Update sort orders
      await Promise.all(
        categoryIds.map((id, index) =>
          fastify.prisma.eventCategory.updateMany({
            where: { id, familyId },
            data: { sortOrder: index },
          })
        )
      );

      // Return updated list
      const categories = await fastify.prisma.eventCategory.findMany({
        where: { familyId },
        orderBy: { sortOrder: 'asc' },
      });

      return categories.map(toEventCategory);
    }
  );
};

export default categoriesRoutes;
