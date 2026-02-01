import type { FastifyPluginAsync } from 'fastify';
import type { Family, FamilyWithMembers, FamilyMember, FamilyRole } from '@family/shared';
import { z } from 'zod';
import authPlugin from '../../plugins/auth.js';
import profilePlugin from '../../plugins/profile.js';

// Validation schemas
const createFamilySchema = z.object({
  name: z.string().min(2).max(100),
});

const updateFamilySchema = z.object({
  name: z.string().min(2).max(100),
});

const updateMemberSchema = z.object({
  role: z.enum(['admin', 'member']).optional(),
  displayName: z.string().min(1).max(100).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  isChild: z.boolean().optional(),
});

const transferOwnershipSchema = z.object({
  newOwnerId: z.string().min(1), // family_members.id
});

const setSharedCalendarSchema = z.object({
  calendarId: z.string().min(1).nullable(), // Google Calendar ID or null to unset
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

// Helper to convert DB member to API type
function toFamilyMember(member: {
  id: string;
  familyId: string;
  profileId: string;
  role: string;
  displayName: string | null;
  color: string | null;
  isChild: boolean;
  joinedAt: Date;
  removedAt: Date | null;
  removedBy: string | null;
  profile?: {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    timezone: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}): FamilyMember {
  return {
    id: member.id,
    familyId: member.familyId,
    profileId: member.profileId,
    role: member.role as FamilyRole,
    displayName: member.displayName,
    color: member.color,
    isChild: member.isChild,
    joinedAt: member.joinedAt.toISOString(),
    removedAt: member.removedAt?.toISOString() ?? null,
    removedBy: member.removedBy,
    ...(member.profile && {
      profile: {
        id: member.profile.id,
        email: member.profile.email,
        displayName: member.profile.displayName,
        avatarUrl: member.profile.avatarUrl,
        timezone: member.profile.timezone,
        createdAt: member.profile.createdAt.toISOString(),
        updatedAt: member.profile.updatedAt.toISOString(),
      },
    }),
  };
}

const familyRoutes: FastifyPluginAsync = async (fastify) => {
  // Register plugins
  await fastify.register(authPlugin);
  await fastify.register(profilePlugin);

  // GET /api/family - Get current user's family (or null)
  fastify.get<{ Reply: { family: FamilyWithMembers | null } }>(
    '/family',
    {
      preHandler: [fastify.authenticate, fastify.ensureProfile, fastify.loadMembership],
    },
    async (request) => {
      if (!request.membership) {
        return { family: null };
      }

      const familyId = request.membership.familyId;

      // Load family with all active members
      const family = await fastify.prisma.family.findUnique({
        where: { id: familyId },
        include: {
          members: {
            where: { removedAt: null },
            include: { profile: true },
            orderBy: [
              { role: 'asc' }, // owner first, then admin, then member
              { joinedAt: 'asc' },
            ],
          },
        },
      });

      if (!family) {
        return { family: null };
      }

      const members = family.members.map(toFamilyMember);
      const myMembership = members.find((m: FamilyMember) => m.profileId === request.user!.id)!;

      return {
        family: {
          id: family.id,
          name: family.name,
          createdBy: family.createdBy,
          sharedCalendarId: family.sharedCalendarId,
          createdAt: family.createdAt.toISOString(),
          updatedAt: family.updatedAt.toISOString(),
          members,
          myMembership,
        },
      };
    }
  );

  // POST /api/families - Create a new family
  fastify.post<{
    Body: z.infer<typeof createFamilySchema>;
    Reply: FamilyWithMembers;
  }>(
    '/families',
    {
      preHandler: [fastify.authenticate, fastify.ensureProfile, fastify.loadMembership],
    },
    async (request, reply) => {
      // Check if user already has a family
      if (request.membership) {
        return reply.status(400).send({
          error: 'Already in a family',
          message: 'You must leave your current family before creating a new one.',
        } as unknown as FamilyWithMembers);
      }

      const body = createFamilySchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'Invalid request body', details: body.error.issues } as unknown as FamilyWithMembers);
      }

      const userId = request.user!.id;
      const { name } = body.data;

      // Create family and owner membership in a transaction
      const result = await fastify.prisma.$transaction(async (tx) => {
        const family = await tx.family.create({
          data: {
            name,
            createdBy: userId,
          },
        });

        const membership = await tx.familyMember.create({
          data: {
            familyId: family.id,
            profileId: userId,
            role: 'owner',
            color: DEFAULT_MEMBER_COLORS[0], // First member gets first color
          },
          include: { profile: true },
        });

        return { family, membership };
      });

      const member = toFamilyMember(result.membership);

      return {
        id: result.family.id,
        name: result.family.name,
        createdBy: result.family.createdBy,
        sharedCalendarId: result.family.sharedCalendarId,
        createdAt: result.family.createdAt.toISOString(),
        updatedAt: result.family.updatedAt.toISOString(),
        members: [member],
        myMembership: member,
      };
    }
  );

  // PATCH /api/families/:familyId - Update family name
  fastify.patch<{
    Params: { familyId: string };
    Body: z.infer<typeof updateFamilySchema>;
    Reply: Family;
  }>(
    '/families/:familyId',
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

      // Verify user is in this family
      if (request.membership!.familyId !== familyId) {
        return reply.status(403).send({ error: 'Access denied' } as unknown as Family);
      }

      const body = updateFamilySchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'Invalid request body', details: body.error.issues } as unknown as Family);
      }

      const updated = await fastify.prisma.family.update({
        where: { id: familyId },
        data: { name: body.data.name },
      });

      return {
        id: updated.id,
        name: updated.name,
        createdBy: updated.createdBy,
        sharedCalendarId: updated.sharedCalendarId,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    }
  );

  // DELETE /api/families/:familyId - Delete family (owner only)
  fastify.delete<{
    Params: { familyId: string };
    Reply: { success: boolean };
  }>(
    '/families/:familyId',
    {
      preHandler: [
        fastify.authenticate,
        fastify.ensureProfile,
        fastify.loadMembership,
        fastify.requireFamily,
        fastify.requireRole('owner'),
      ],
    },
    async (request, reply) => {
      const { familyId } = request.params;

      if (request.membership!.familyId !== familyId) {
        return reply.status(403).send({ error: 'Access denied' } as unknown as { success: boolean });
      }

      // Delete family (cascades to members and invites)
      await fastify.prisma.family.delete({
        where: { id: familyId },
      });

      return { success: true };
    }
  );

  // POST /api/families/:familyId/leave - Leave family
  fastify.post<{
    Params: { familyId: string };
    Reply: { success: boolean };
  }>(
    '/families/:familyId/leave',
    {
      preHandler: [
        fastify.authenticate,
        fastify.ensureProfile,
        fastify.loadMembership,
        fastify.requireFamily,
      ],
    },
    async (request, reply) => {
      const { familyId } = request.params;
      const userId = request.user!.id;

      if (request.membership!.familyId !== familyId) {
        return reply.status(403).send({ error: 'Access denied' } as unknown as { success: boolean });
      }

      // Owner cannot leave without transferring ownership
      if (request.membership!.role === 'owner') {
        return reply.status(400).send({
          error: 'Owner cannot leave',
          message: 'Transfer ownership to another member before leaving the family.',
        } as unknown as { success: boolean });
      }

      // Soft delete membership
      await fastify.prisma.familyMember.update({
        where: {
          familyId_profileId: {
            familyId,
            profileId: userId,
          },
        },
        data: {
          removedAt: new Date(),
          removedBy: userId,
        },
      });

      return { success: true };
    }
  );

  // POST /api/families/:familyId/transfer - Transfer ownership
  fastify.post<{
    Params: { familyId: string };
    Body: z.infer<typeof transferOwnershipSchema>;
    Reply: { success: boolean };
  }>(
    '/families/:familyId/transfer',
    {
      preHandler: [
        fastify.authenticate,
        fastify.ensureProfile,
        fastify.loadMembership,
        fastify.requireFamily,
        fastify.requireRole('owner'),
      ],
    },
    async (request, reply) => {
      const { familyId } = request.params;
      const userId = request.user!.id;

      if (request.membership!.familyId !== familyId) {
        return reply.status(403).send({ error: 'Access denied' } as unknown as { success: boolean });
      }

      const body = transferOwnershipSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'Invalid request body', details: body.error.issues } as unknown as { success: boolean });
      }

      const { newOwnerId } = body.data;

      // Verify new owner is an active member
      const newOwner = await fastify.prisma.familyMember.findFirst({
        where: {
          id: newOwnerId,
          familyId,
          removedAt: null,
        },
      });

      if (!newOwner) {
        return reply.status(404).send({
          error: 'Member not found',
          message: 'The specified member does not exist or is not active.',
        } as unknown as { success: boolean });
      }

      if (newOwner.profileId === userId) {
        return reply.status(400).send({
          error: 'Invalid transfer',
          message: 'You are already the owner.',
        } as unknown as { success: boolean });
      }

      // Transfer ownership in a transaction
      await fastify.prisma.$transaction([
        // Demote current owner to admin
        fastify.prisma.familyMember.update({
          where: {
            familyId_profileId: {
              familyId,
              profileId: userId,
            },
          },
          data: { role: 'admin' },
        }),
        // Promote new owner
        fastify.prisma.familyMember.update({
          where: { id: newOwnerId },
          data: { role: 'owner' },
        }),
      ]);

      return { success: true };
    }
  );

  // GET /api/families/:familyId/members - List family members
  fastify.get<{
    Params: { familyId: string };
    Reply: FamilyMember[];
  }>(
    '/families/:familyId/members',
    {
      preHandler: [
        fastify.authenticate,
        fastify.ensureProfile,
        fastify.loadMembership,
        fastify.requireFamily,
      ],
    },
    async (request, reply) => {
      const { familyId } = request.params;

      if (request.membership!.familyId !== familyId) {
        return reply.status(403).send({ error: 'Access denied' } as unknown as FamilyMember[]);
      }

      const members = await fastify.prisma.familyMember.findMany({
        where: {
          familyId,
          removedAt: null,
        },
        include: { profile: true },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      });

      return members.map(toFamilyMember);
    }
  );

  // PATCH /api/families/:familyId/members/:memberId - Update member
  fastify.patch<{
    Params: { familyId: string; memberId: string };
    Body: z.infer<typeof updateMemberSchema>;
    Reply: FamilyMember;
  }>(
    '/families/:familyId/members/:memberId',
    {
      preHandler: [
        fastify.authenticate,
        fastify.ensureProfile,
        fastify.loadMembership,
        fastify.requireFamily,
      ],
    },
    async (request, reply) => {
      const { familyId, memberId } = request.params;
      const userId = request.user!.id;
      const myRole = request.membership!.role;

      if (request.membership!.familyId !== familyId) {
        return reply.status(403).send({ error: 'Access denied' } as unknown as FamilyMember);
      }

      const body = updateMemberSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'Invalid request body', details: body.error.issues } as unknown as FamilyMember);
      }

      // Find the target member
      const targetMember = await fastify.prisma.familyMember.findFirst({
        where: {
          id: memberId,
          familyId,
          removedAt: null,
        },
      });

      if (!targetMember) {
        return reply.status(404).send({ error: 'Member not found' } as unknown as FamilyMember);
      }

      const { role, displayName, color, isChild } = body.data;

      // Permission checks for role changes
      if (role !== undefined) {
        // Only owner can change roles
        if (myRole !== 'owner') {
          return reply.status(403).send({
            error: 'Permission denied',
            message: 'Only the owner can change member roles.',
          } as unknown as FamilyMember);
        }

        // Cannot change owner's role
        if (targetMember.role === 'owner') {
          return reply.status(400).send({
            error: 'Cannot change owner role',
            message: 'Use transfer ownership instead.',
          } as unknown as FamilyMember);
        }
      }

      // Members can only edit their own display name and color
      if (myRole === 'member' && targetMember.profileId !== userId) {
        return reply.status(403).send({
          error: 'Permission denied',
          message: 'You can only edit your own profile.',
        } as unknown as FamilyMember);
      }

      const updated = await fastify.prisma.familyMember.update({
        where: { id: memberId },
        data: {
          ...(role !== undefined && { role }),
          ...(displayName !== undefined && { displayName }),
          ...(color !== undefined && { color }),
          ...(isChild !== undefined && { isChild }),
        },
        include: { profile: true },
      });

      return toFamilyMember(updated);
    }
  );

  // DELETE /api/families/:familyId/members/:memberId - Remove member
  fastify.delete<{
    Params: { familyId: string; memberId: string };
    Reply: { success: boolean };
  }>(
    '/families/:familyId/members/:memberId',
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
      const { familyId, memberId } = request.params;
      const userId = request.user!.id;
      const myRole = request.membership!.role;

      if (request.membership!.familyId !== familyId) {
        return reply.status(403).send({ error: 'Access denied' } as unknown as { success: boolean });
      }

      const targetMember = await fastify.prisma.familyMember.findFirst({
        where: {
          id: memberId,
          familyId,
          removedAt: null,
        },
      });

      if (!targetMember) {
        return reply.status(404).send({ error: 'Member not found' } as unknown as { success: boolean });
      }

      // Cannot remove self
      if (targetMember.profileId === userId) {
        return reply.status(400).send({
          error: 'Cannot remove self',
          message: 'Use leave family instead.',
        } as unknown as { success: boolean });
      }

      // Cannot remove owner
      if (targetMember.role === 'owner') {
        return reply.status(400).send({
          error: 'Cannot remove owner',
          message: 'The owner cannot be removed.',
        } as unknown as { success: boolean });
      }

      // Admin can only remove members, not other admins
      if (myRole === 'admin' && targetMember.role === 'admin') {
        return reply.status(403).send({
          error: 'Permission denied',
          message: 'Admins cannot remove other admins.',
        } as unknown as { success: boolean });
      }

      // Soft delete
      await fastify.prisma.familyMember.update({
        where: { id: memberId },
        data: {
          removedAt: new Date(),
          removedBy: userId,
        },
      });

      return { success: true };
    }
  );

  // PUT /api/families/:familyId/shared-calendar - Set family shared calendar (owner only)
  fastify.put<{
    Params: { familyId: string };
    Body: z.infer<typeof setSharedCalendarSchema>;
    Reply: { success: boolean; sharedCalendarId: string | null };
  }>(
    '/families/:familyId/shared-calendar',
    {
      preHandler: [
        fastify.authenticate,
        fastify.ensureProfile,
        fastify.loadMembership,
        fastify.requireFamily,
        fastify.requireRole('owner'),
      ],
    },
    async (request, reply) => {
      const { familyId } = request.params;

      if (request.membership!.familyId !== familyId) {
        return reply.status(403).send({ error: 'Access denied' } as unknown as { success: boolean; sharedCalendarId: string | null });
      }

      const body = setSharedCalendarSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'Invalid request body', details: body.error.issues } as unknown as { success: boolean; sharedCalendarId: string | null });
      }

      const { calendarId } = body.data;

      // Update family with the shared calendar ID
      const updated = await fastify.prisma.family.update({
        where: { id: familyId },
        data: { sharedCalendarId: calendarId },
      });

      return { success: true, sharedCalendarId: updated.sharedCalendarId };
    }
  );

  // GET /api/families/:familyId/shared-calendar/access - Check if user has access to family shared calendar
  fastify.get<{
    Params: { familyId: string };
    Reply: { hasAccess: boolean; sharedCalendarId: string | null; calendarName: string | null };
  }>(
    '/families/:familyId/shared-calendar/access',
    {
      preHandler: [
        fastify.authenticate,
        fastify.ensureProfile,
        fastify.loadMembership,
        fastify.requireFamily,
      ],
    },
    async (request, reply) => {
      const { familyId } = request.params;
      const userId = request.user!.id;

      if (request.membership!.familyId !== familyId) {
        return reply.status(403).send({ error: 'Access denied' } as unknown as { hasAccess: boolean; sharedCalendarId: string | null; calendarName: string | null });
      }

      // Get the family's shared calendar ID
      const family = await fastify.prisma.family.findUnique({
        where: { id: familyId },
        select: { sharedCalendarId: true },
      });

      if (!family?.sharedCalendarId) {
        return { hasAccess: false, sharedCalendarId: null, calendarName: null };
      }

      // Check if the user has this calendar selected (which means they have access to it)
      const selectedCalendar = await fastify.prisma.selectedCalendar.findUnique({
        where: {
          userId_calendarId: {
            userId,
            calendarId: family.sharedCalendarId,
          },
        },
        select: { isVisible: true, summary: true },
      });

      return {
        hasAccess: selectedCalendar?.isVisible ?? false,
        sharedCalendarId: family.sharedCalendarId,
        calendarName: selectedCalendar?.summary ?? null,
      };
    }
  );
};

export default familyRoutes;
