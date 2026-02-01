import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { Profile, FamilyMember, Family, FamilyRole } from '@family/shared';
import fp from 'fastify-plugin';

// Extend FastifyRequest to include profile and membership
declare module 'fastify' {
  interface FastifyRequest {
    profile?: Profile;
    membership?: {
      id: string;
      familyId: string;
      role: FamilyRole;
      family: Family;
    };
  }

  interface FastifyInstance {
    ensureProfile: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    loadMembership: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireFamily: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (minRole: FamilyRole) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

// Role hierarchy for permission checks
const ROLE_LEVELS: Record<FamilyRole, number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

const profilePlugin: FastifyPluginAsync = async (fastify) => {
  /**
   * Ensures a profile exists for the authenticated user.
   * Creates one lazily if it doesn't exist, using data from the JWT.
   */
  const ensureProfile = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const userId = request.user.id;
    const jwt = request.user.jwt;

    // Extract user metadata from JWT
    const userMetadata = (jwt.user_metadata as Record<string, unknown>) || {};
    const jwtAvatarUrl =
      (userMetadata.avatar_url as string) ||
      (userMetadata.picture as string) ||
      null;
    const jwtDisplayName =
      (userMetadata.full_name as string) ||
      (userMetadata.name as string) ||
      (userMetadata.display_name as string) ||
      null;

    // Try to find existing profile
    let profile = await fastify.prisma.profile.findUnique({
      where: { id: userId },
    });

    // Create profile lazily if it doesn't exist
    if (!profile) {
      const email = (jwt.email as string) || '';

      try {
        profile = await fastify.prisma.profile.create({
          data: {
            id: userId,
            email,
            displayName: jwtDisplayName,
            avatarUrl: jwtAvatarUrl,
          },
        });
        fastify.log.info({ userId, email }, 'Created profile lazily');
      } catch (err) {
        // Handle race condition - profile might have been created by another request
        profile = await fastify.prisma.profile.findUnique({
          where: { id: userId },
        });
        if (!profile) {
          fastify.log.error({ err, userId }, 'Failed to create profile');
          return reply.status(500).send({ error: 'Failed to create profile' });
        }
      }
    } else {
      // Profile exists - sync avatar/displayName from JWT if different
      // Always update avatar if JWT has one (user may have changed their Google photo)
      const needsUpdate =
        (jwtAvatarUrl && profile.avatarUrl !== jwtAvatarUrl) ||
        (!profile.displayName && jwtDisplayName);

      if (needsUpdate) {
        profile = await fastify.prisma.profile.update({
          where: { id: userId },
          data: {
            ...(jwtAvatarUrl && profile.avatarUrl !== jwtAvatarUrl && { avatarUrl: jwtAvatarUrl }),
            ...(!profile.displayName && jwtDisplayName && { displayName: jwtDisplayName }),
          },
        });
        fastify.log.info({ userId }, 'Synced profile from JWT metadata');
      }
    }

    request.profile = {
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      timezone: profile.timezone,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  };

  /**
   * Loads the user's family membership if they have one.
   * Does NOT fail if user has no family - just sets membership to undefined.
   */
  const loadMembership = async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.user) {
      return;
    }

    const userId = request.user.id;

    const membership = await fastify.prisma.familyMember.findFirst({
      where: {
        profileId: userId,
        removedAt: null,
      },
      include: {
        family: true,
      },
    });

    if (membership) {
      request.membership = {
        id: membership.id,
        familyId: membership.familyId,
        role: membership.role as FamilyRole,
        family: {
          id: membership.family.id,
          name: membership.family.name,
          createdBy: membership.family.createdBy,
          sharedCalendarId: membership.family.sharedCalendarId,
          createdAt: membership.family.createdAt.toISOString(),
          updatedAt: membership.family.updatedAt.toISOString(),
        },
      };
    }
  };

  /**
   * Requires the user to be a member of a family.
   * Returns 403 if user has no family.
   */
  const requireFamily = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.membership) {
      return reply.status(403).send({
        error: 'No family membership',
        message: 'You must be a member of a family to access this resource. Create or join a family first.',
      });
    }
  };

  /**
   * Creates a middleware that requires a minimum role level.
   */
  const requireRole = (minRole: FamilyRole) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.membership) {
        return reply.status(403).send({
          error: 'No family membership',
          message: 'You must be a member of a family to access this resource.',
        });
      }

      const userLevel = ROLE_LEVELS[request.membership.role];
      const requiredLevel = ROLE_LEVELS[minRole];

      if (userLevel < requiredLevel) {
        return reply.status(403).send({
          error: 'Insufficient permissions',
          message: `This action requires ${minRole} role or higher.`,
        });
      }
    };
  };

  fastify.decorate('ensureProfile', ensureProfile);
  fastify.decorate('loadMembership', loadMembership);
  fastify.decorate('requireFamily', requireFamily);
  fastify.decorate('requireRole', requireRole);
};

export default fp(profilePlugin, {
  name: 'profile',
  dependencies: ['prisma', 'auth'],
});
