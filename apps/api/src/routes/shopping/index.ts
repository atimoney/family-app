import type { FastifyPluginAsync } from 'fastify';
import type { ShoppingItem } from '@family/shared';
import { createShoppingItemSchema, updateShoppingItemSchema } from './schema.js';

const shoppingRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/shopping
  fastify.get('/', async (): Promise<ShoppingItem[]> => {
    const items = await fastify.prisma.shoppingItem.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return items.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity ?? undefined,
      category: i.category ?? undefined,
      purchased: i.purchased,
    }));
  });

  // POST /v1/shopping
  fastify.post('/', async (request, reply): Promise<ShoppingItem> => {
    const parsed = createShoppingItemSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, quantity, category } = parsed.data;

    const item = await fastify.prisma.shoppingItem.create({
      data: {
        name,
        quantity,
        category,
      },
    });

    return {
      id: item.id,
      name: item.name,
      quantity: item.quantity ?? undefined,
      category: item.category ?? undefined,
      purchased: item.purchased,
    };
  });

  // PATCH /v1/shopping/:id
  fastify.patch<{ Params: { id: string } }>(
    '/:id',
    async (request, reply): Promise<ShoppingItem> => {
      const { id } = request.params;
      const parsed = updateShoppingItemSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { purchased, quantity } = parsed.data;

      const existing = await fastify.prisma.shoppingItem.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Shopping item not found' });
      }

      const item = await fastify.prisma.shoppingItem.update({
        where: { id },
        data: {
          ...(purchased !== undefined && { purchased }),
          ...(quantity !== undefined && { quantity }),
        },
      });

      return {
        id: item.id,
        name: item.name,
        quantity: item.quantity ?? undefined,
        category: item.category ?? undefined,
        purchased: item.purchased,
      };
    }
  );
};

export default shoppingRoutes;
