import type { FastifyPluginAsync } from 'fastify';
import type { Profile } from '@family/shared';
import { z } from 'zod';
import authPlugin from '../../plugins/auth.js';
import profilePlugin from '../../plugins/profile.js';

// Validation schemas
const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
  timezone: z.string().max(50).optional().nullable(),
});

const profileRoutes: FastifyPluginAsync = async (fastify) => {
  // Register plugins
  await fastify.register(authPlugin);
  await fastify.register(profilePlugin);

  // GET /api/profile - Get current user's profile
  fastify.get<{ Reply: Profile }>(
    '/profile',
    {
      preHandler: [fastify.authenticate, fastify.ensureProfile],
    },
    async (request) => {
      // Profile is guaranteed to exist after ensureProfile
      return request.profile!;
    }
  );

  // PATCH /api/profile - Update current user's profile
  fastify.patch<{
    Body: z.infer<typeof updateProfileSchema>;
    Reply: Profile;
  }>(
    '/profile',
    {
      preHandler: [fastify.authenticate, fastify.ensureProfile],
    },
    async (request, reply) => {
      const body = updateProfileSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'Invalid request body', details: body.error.issues } as unknown as Profile);
      }

      const userId = request.user!.id;
      const { displayName, avatarUrl, timezone } = body.data;

      const updated = await fastify.prisma.profile.update({
        where: { id: userId },
        data: {
          ...(displayName !== undefined && { displayName }),
          ...(avatarUrl !== undefined && { avatarUrl }),
          ...(timezone !== undefined && { timezone }),
        },
      });

      return {
        id: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        avatarUrl: updated.avatarUrl,
        timezone: updated.timezone,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    }
  );
};

export default profileRoutes;
