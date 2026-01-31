import type { FastifyPluginAsync } from 'fastify';
import type { FamilyInvite, InviteValidation, FamilyRole } from '@family/shared';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import authPlugin from '../../plugins/auth.js';
import profilePlugin from '../../plugins/profile.js';

// Validation schemas
const createInviteSchema = z.object({
  email: z.string().email().optional().nullable(),
  role: z.enum(['admin', 'member']).default('member'),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

// Default colors for family members (same as frontend MEMBER_COLORS)
const DEFAULT_MEMBER_COLORS = [
  '#FF5630', // Red
  '#FF8C00', // Orange
  '#FFAB00', // Amber
  '#22C55E', // Green
  '#00B8D9', // Cyan
  '#0076D3', // Blue
  '#7C3AED', // Purple
  '#FF1493', // Pink
  '#637381', // Gray
  '#212B36', // Dark
];

// Helper to get next available color for a new family member
function getNextAvailableColor(existingColors: (string | null)[]): string {
  const usedColors = new Set(existingColors.filter(Boolean).map(c => c!.toUpperCase()));
  
  // Find first color not already used
  for (const color of DEFAULT_MEMBER_COLORS) {
    if (!usedColors.has(color.toUpperCase())) {
      return color;
    }
  }
  
  // All colors used, return first color (will have duplicates)
  return DEFAULT_MEMBER_COLORS[0];
}

// Helper to generate secure token
function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

// Type for DB invite with optional relations
type DbInvite = {
  id: string;
  familyId: string;
  email: string | null;
  role: string;
  token: string;
  invitedBy: string;
  status: string;
  createdAt: Date;
  expiresAt: Date;
  respondedAt: Date | null;
  inviter?: {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    timezone: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  family?: {
    id: string;
    name: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
};

// Helper to convert DB invite to API type
function toFamilyInvite(invite: DbInvite): FamilyInvite {
  return {
    id: invite.id,
    familyId: invite.familyId,
    email: invite.email,
    role: invite.role as Exclude<FamilyRole, 'owner'>,
    token: invite.token,
    invitedBy: invite.invitedBy,
    status: invite.status as FamilyInvite['status'],
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
    respondedAt: invite.respondedAt?.toISOString() ?? null,
    ...(invite.inviter && {
      inviterProfile: {
        id: invite.inviter.id,
        email: invite.inviter.email,
        displayName: invite.inviter.displayName,
        avatarUrl: invite.inviter.avatarUrl,
        timezone: invite.inviter.timezone,
        createdAt: invite.inviter.createdAt.toISOString(),
        updatedAt: invite.inviter.updatedAt.toISOString(),
      },
    }),
    ...(invite.family && {
      family: {
        id: invite.family.id,
        name: invite.family.name,
        createdBy: invite.family.createdBy,
        createdAt: invite.family.createdAt.toISOString(),
        updatedAt: invite.family.updatedAt.toISOString(),
      },
    }),
  };
}

const inviteRoutes: FastifyPluginAsync = async (fastify) => {
  // Register plugins
  await fastify.register(authPlugin);
  await fastify.register(profilePlugin);

  // =========================================================================
  // Family-scoped invite management (requires authentication)
  // =========================================================================

  // GET /api/families/:familyId/invites - List pending invites
  fastify.get<{
    Params: { familyId: string };
    Reply: FamilyInvite[];
  }>(
    '/families/:familyId/invites',
    {
      preHandler: [
        fastify.authenticate,
        fastify.ensureProfile,
        fastify.loadMembership,
        fastify.requireFamily,
        fastify.requireRole('admin'),
      ],
    },
    async (request, reply) => {
      const { familyId } = request.params;

      if (request.membership!.familyId !== familyId) {
        return reply.status(403).send({ error: 'Access denied' } as unknown as FamilyInvite[]);
      }

      const invites = await fastify.prisma.familyInvite.findMany({
        where: {
          familyId,
          status: { in: ['pending', 'expired'] },
        },
        include: { inviter: true },
        orderBy: { createdAt: 'desc' },
      });

      // Mark expired invites
      const now = new Date();
      return invites.map((invite: DbInvite) => {
        const isExpired = invite.expiresAt < now && invite.status === 'pending';
        return toFamilyInvite({
          ...invite,
          status: isExpired ? 'expired' : invite.status,
        });
      });
    }
  );

  // POST /api/families/:familyId/invites - Create invite
  fastify.post<{
    Params: { familyId: string };
    Body: z.infer<typeof createInviteSchema>;
    Reply: FamilyInvite;
  }>(
    '/families/:familyId/invites',
    {
      preHandler: [
        fastify.authenticate,
        fastify.ensureProfile,
        fastify.loadMembership,
        fastify.requireFamily,
        fastify.requireRole('admin'),
      ],
    },
    async (request, reply) => {
      const { familyId } = request.params;
      const userId = request.user!.id;

      if (request.membership!.familyId !== familyId) {
        return reply.status(403).send({ error: 'Access denied' } as unknown as FamilyInvite);
      }

      const body = createInviteSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'Invalid request body', details: body.error.issues } as unknown as FamilyInvite);
      }

      const { email, role, expiresInDays } = body.data;

      // Check if email already has pending invite
      if (email) {
        const existingInvite = await fastify.prisma.familyInvite.findFirst({
          where: {
            familyId,
            email,
            status: 'pending',
            expiresAt: { gt: new Date() },
          },
        });

        if (existingInvite) {
          return reply.status(400).send({
            error: 'Invite already exists',
            message: 'A pending invite already exists for this email.',
          } as unknown as FamilyInvite);
        }

        // Check if email is already a member
        const existingMember = await fastify.prisma.familyMember.findFirst({
          where: {
            familyId,
            removedAt: null,
            profile: { email },
          },
          include: { profile: true },
        });

        if (existingMember) {
          return reply.status(400).send({
            error: 'Already a member',
            message: 'This email is already a family member.',
          } as unknown as FamilyInvite);
        }
      }

      const token = generateToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const invite = await fastify.prisma.familyInvite.create({
        data: {
          familyId,
          email: email ?? null,
          role,
          token,
          invitedBy: userId,
          expiresAt,
        },
        include: { inviter: true, family: true },
      });

      return toFamilyInvite(invite);
    }
  );

  // DELETE /api/families/:familyId/invites/:inviteId - Revoke invite
  fastify.delete<{
    Params: { familyId: string; inviteId: string };
    Reply: { success: boolean };
  }>(
    '/families/:familyId/invites/:inviteId',
    {
      preHandler: [
        fastify.authenticate,
        fastify.ensureProfile,
        fastify.loadMembership,
        fastify.requireFamily,
        fastify.requireRole('admin'),
      ],
    },
    async (request, reply) => {
      const { familyId, inviteId } = request.params;

      if (request.membership!.familyId !== familyId) {
        return reply.status(403).send({ error: 'Access denied' } as unknown as { success: boolean });
      }

      const invite = await fastify.prisma.familyInvite.findFirst({
        where: {
          id: inviteId,
          familyId,
          status: 'pending',
        },
      });

      if (!invite) {
        return reply.status(404).send({ error: 'Invite not found' } as unknown as { success: boolean });
      }

      await fastify.prisma.familyInvite.update({
        where: { id: inviteId },
        data: { status: 'revoked' },
      });

      return { success: true };
    }
  );

  // =========================================================================
  // Public invite token endpoints
  // =========================================================================

  // GET /api/invites/:token/validate - Validate invite token (public/authenticated)
  fastify.get<{
    Params: { token: string };
    Reply: InviteValidation;
  }>(
    '/invites/:token/validate',
    {
      // Optional authentication - try to authenticate but don't fail if not
      preHandler: [
        async (request, reply) => {
          try {
            await fastify.authenticate(request, reply);
            await fastify.ensureProfile(request, reply);
            await fastify.loadMembership(request, reply);
          } catch {
            // Authentication is optional for validation
          }
        },
      ],
    },
    async (request) => {
      const { token } = request.params;

      const invite = await fastify.prisma.familyInvite.findUnique({
        where: { token },
        include: {
          family: true,
          inviter: true,
        },
      });

      if (!invite) {
        return { valid: false, reason: 'not_found' };
      }

      if (invite.status === 'accepted') {
        return { valid: false, reason: 'already_used' };
      }

      if (invite.status === 'revoked') {
        return { valid: false, reason: 'revoked' };
      }

      if (invite.status === 'declined') {
        return { valid: false, reason: 'already_used' };
      }

      if (invite.expiresAt < new Date()) {
        return { valid: false, reason: 'expired' };
      }

      // If user is authenticated, check additional conditions
      if (request.user && request.profile) {
        // Check email match if invite has email restriction
        if (invite.email && invite.email.toLowerCase() !== request.profile.email.toLowerCase()) {
          return {
            valid: false,
            reason: 'email_mismatch',
            email: invite.email,
          };
        }

        // Check if already a member of this family
        if (request.membership && request.membership.familyId === invite.familyId) {
          return { valid: false, reason: 'already_member' };
        }

        // Check if already in another family
        if (request.membership) {
          return { valid: false, reason: 'already_in_family' };
        }
      }

      return {
        valid: true,
        familyName: invite.family.name,
        inviterName: invite.inviter.displayName || invite.inviter.email,
        role: invite.role as Exclude<FamilyRole, 'owner'>,
        email: invite.email,
      };
    }
  );

  // POST /api/invites/:token/accept - Accept invite
  fastify.post<{
    Params: { token: string };
    Reply: { success: boolean; familyId?: string };
  }>(
    '/invites/:token/accept',
    {
      preHandler: [fastify.authenticate, fastify.ensureProfile, fastify.loadMembership],
    },
    async (request, reply) => {
      const { token } = request.params;
      const userId = request.user!.id;
      const userEmail = request.profile!.email;

      // Check if already in a family
      if (request.membership) {
        return reply.status(400).send({
          error: 'Already in a family',
          message: 'You must leave your current family before joining another.',
        } as unknown as { success: boolean; familyId?: string });
      }

      const invite = await fastify.prisma.familyInvite.findUnique({
        where: { token },
        include: { family: true },
      });

      if (!invite) {
        return reply.status(404).send({ error: 'Invite not found' } as unknown as { success: boolean; familyId?: string });
      }

      if (invite.status !== 'pending') {
        return reply.status(400).send({
          error: 'Invite not valid',
          message: 'This invite has already been used or revoked.',
        } as unknown as { success: boolean; familyId?: string });
      }

      if (invite.expiresAt < new Date()) {
        return reply.status(400).send({
          error: 'Invite expired',
          message: 'This invite has expired. Ask for a new invite.',
        } as unknown as { success: boolean; familyId?: string });
      }

      // Check email match
      if (invite.email && invite.email.toLowerCase() !== userEmail.toLowerCase()) {
        return reply.status(403).send({
          error: 'Email mismatch',
          message: `This invite is for ${invite.email}. Please sign in with that account.`,
        } as unknown as { success: boolean; familyId?: string });
      }

      // Accept invite and create membership in transaction
      await fastify.prisma.$transaction(async (tx) => {
        // Get existing member colors to avoid duplicates
        const existingMembers = await tx.familyMember.findMany({
          where: { familyId: invite.familyId, removedAt: null },
          select: { color: true },
        });
        const existingColors = existingMembers.map(m => m.color);
        const assignedColor = getNextAvailableColor(existingColors);

        await tx.familyInvite.update({
          where: { id: invite.id },
          data: {
            status: 'accepted',
            respondedAt: new Date(),
          },
        });

        await tx.familyMember.create({
          data: {
            familyId: invite.familyId,
            profileId: userId,
            role: invite.role,
            color: assignedColor,
          },
        });
      });

      return { success: true, familyId: invite.familyId };
    }
  );

  // POST /api/invites/:token/decline - Decline invite
  fastify.post<{
    Params: { token: string };
    Reply: { success: boolean };
  }>(
    '/invites/:token/decline',
    {
      preHandler: [fastify.authenticate, fastify.ensureProfile],
    },
    async (request, reply) => {
      const { token } = request.params;

      const invite = await fastify.prisma.familyInvite.findUnique({
        where: { token },
      });

      if (!invite) {
        return reply.status(404).send({ error: 'Invite not found' } as unknown as { success: boolean });
      }

      if (invite.status !== 'pending') {
        return reply.status(400).send({
          error: 'Invite not valid',
          message: 'This invite has already been used or revoked.',
        } as unknown as { success: boolean });
      }

      await fastify.prisma.familyInvite.update({
        where: { id: invite.id },
        data: {
          status: 'declined',
          respondedAt: new Date(),
        },
      });

      return { success: true };
    }
  );
};

export default inviteRoutes;
