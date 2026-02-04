import { type PrismaClient, Prisma } from '@prisma/client';
import type { ToolContext, ToolResult } from '@family/mcp-server';
import type {
  CalendarSearchInput,
  CalendarSearchOutput,
  CalendarCreateInput,
  CalendarCreateOutput,
  CalendarUpdateInput,
  CalendarUpdateOutput,
  CalendarEventOutput,
} from '@family/mcp-server';

// ----------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------

type DbEvent = {
  id: string;
  familyId: string;
  title: string;
  startAt: Date;
  endAt: Date;
  location: string | null;
  notes: string | null;
  allDay: boolean;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  attendees?: Array<{
    id: string;
    userId: string;
    status: string;
  }>;
};

type FamilyMemberWithProfile = {
  id: string;
  displayName: string | null;
  profile: {
    displayName: string | null;
    email: string;
  };
};

// ----------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------

function mapEventToOutput(
  event: DbEvent,
  memberMap?: Map<string, FamilyMemberWithProfile>
): CalendarEventOutput {
  const attendees = event.attendees?.map((a) => {
    const member = memberMap?.get(a.userId);
    return {
      userId: a.userId,
      displayName: member
        ? member.displayName || member.profile.displayName || member.profile.email
        : null,
      status: a.status as 'pending' | 'accepted' | 'declined',
    };
  });

  return {
    id: event.id,
    familyId: event.familyId,
    title: event.title,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    location: event.location,
    notes: event.notes,
    allDay: event.allDay,
    createdByUserId: event.createdByUserId,
    attendees,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

function redactInput(input: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...input };
  return redacted;
}

// ----------------------------------------------------------------------
// AUDIT LOGGING
// ----------------------------------------------------------------------

async function writeAuditLog(
  prisma: PrismaClient,
  context: ToolContext,
  toolName: string,
  input: Record<string, unknown>,
  result: ToolResult,
  executionMs: number
): Promise<void> {
  try {
    await prisma.agentAuditLog.create({
      data: {
        requestId: context.requestId,
        userId: context.userId,
        familyId: context.familyId,
        toolName,
        input: redactInput(input) as Prisma.InputJsonValue,
        output: result.success && result.data ? (result.data as Prisma.InputJsonValue) : Prisma.JsonNull,
        success: result.success,
        errorMessage: result.error ?? null,
        executionMs,
      },
    });
  } catch (err) {
    context.logger.error(
      { err, toolName, requestId: context.requestId },
      'Failed to write audit log'
    );
  }
}

// ----------------------------------------------------------------------
// HANDLER FACTORY
// ----------------------------------------------------------------------

export type CalendarHandlerDependencies = {
  prisma: PrismaClient;
};

/**
 * Create calendar tool handlers with injected dependencies.
 */
export function createCalendarToolHandlers(deps: CalendarHandlerDependencies) {
  const { prisma } = deps;

  // Helper to get family members map
  async function getFamilyMembersMap(
    familyId: string
  ): Promise<Map<string, FamilyMemberWithProfile>> {
    const members = await prisma.familyMember.findMany({
      where: { familyId, removedAt: null },
      include: {
        profile: { select: { displayName: true, email: true } },
      },
    });
    return new Map(members.map((m) => [m.id, m]));
  }

  // --------------------------------------------------------------------------
  // calendar.search
  // --------------------------------------------------------------------------
  async function search(
    input: CalendarSearchInput,
    context: ToolContext
  ): Promise<ToolResult<CalendarSearchOutput>> {
    const startTime = Date.now();

    try {
      // Build where clause
      const where: Prisma.FamilyEventWhereInput = {
        familyId: context.familyId,
        deletedAt: null,
      };

      // Date range filter
      if (input.from || input.to) {
        where.startAt = {};
        if (input.from) {
          where.startAt.gte = new Date(input.from);
        }
        if (input.to) {
          where.startAt.lte = new Date(input.to);
        }
      }

      // Text search (title or notes)
      if (input.query) {
        const queryLower = input.query.toLowerCase();
        where.OR = [
          { title: { contains: queryLower, mode: 'insensitive' } },
          { notes: { contains: queryLower, mode: 'insensitive' } },
        ];
      }

      // Attendee filter
      if (input.attendeeUserId) {
        where.attendees = {
          some: { userId: input.attendeeUserId },
        };
      }

      // Execute query
      const [events, total] = await Promise.all([
        prisma.familyEvent.findMany({
          where,
          include: {
            attendees: true,
          },
          orderBy: { startAt: 'asc' },
          take: input.limit ?? 20,
        }),
        prisma.familyEvent.count({ where }),
      ]);

      // Get member names for attendees
      const memberMap = await getFamilyMembersMap(context.familyId);

      const result: ToolResult<CalendarSearchOutput> = {
        success: true,
        data: {
          events: events.map((e) => mapEventToOutput(e, memberMap)),
          total,
        },
      };

      const executionMs = Date.now() - startTime;
      await writeAuditLog(prisma, context, 'calendar.search', input, result, executionMs);

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      context.logger.error({ err, input }, 'calendar.search failed');

      const result: ToolResult<CalendarSearchOutput> = {
        success: false,
        error: `Failed to search events: ${errorMessage}`,
      };

      const executionMs = Date.now() - startTime;
      await writeAuditLog(prisma, context, 'calendar.search', input, result, executionMs);

      return result;
    }
  }

  // --------------------------------------------------------------------------
  // calendar.create
  // --------------------------------------------------------------------------
  async function create(
    input: CalendarCreateInput,
    context: ToolContext
  ): Promise<ToolResult<CalendarCreateOutput>> {
    const startTime = Date.now();

    try {
      // Validate date range
      const startAt = new Date(input.startAt);
      const endAt = new Date(input.endAt);

      if (endAt <= startAt) {
        return {
          success: false,
          error: 'End time must be after start time',
        };
      }

      // Validate attendees if provided
      if (input.attendeeUserIds && input.attendeeUserIds.length > 0) {
        const validMembers = await prisma.familyMember.findMany({
          where: {
            familyId: context.familyId,
            id: { in: input.attendeeUserIds },
            removedAt: null,
          },
          select: { id: true },
        });

        const validIds = new Set(validMembers.map((m) => m.id));
        const invalidIds = input.attendeeUserIds.filter((id) => !validIds.has(id));

        if (invalidIds.length > 0) {
          return {
            success: false,
            error: `Invalid attendee IDs: ${invalidIds.join(', ')}`,
          };
        }
      }

      // Create event with attendees
      const event = await prisma.familyEvent.create({
        data: {
          familyId: context.familyId,
          title: input.title,
          startAt,
          endAt,
          location: input.location ?? null,
          notes: input.notes ?? null,
          allDay: input.allDay ?? false,
          createdByUserId: context.familyMemberId,
          attendees: input.attendeeUserIds
            ? {
                create: input.attendeeUserIds.map((userId) => ({
                  userId,
                  status: 'pending',
                })),
              }
            : undefined,
        },
        include: {
          attendees: true,
        },
      });

      const memberMap = await getFamilyMembersMap(context.familyId);

      const result: ToolResult<CalendarCreateOutput> = {
        success: true,
        data: {
          event: mapEventToOutput(event, memberMap),
        },
      };

      const executionMs = Date.now() - startTime;
      await writeAuditLog(prisma, context, 'calendar.create', input, result, executionMs);

      context.logger.info(
        { eventId: event.id, title: event.title },
        'Created calendar event'
      );

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      context.logger.error({ err, input }, 'calendar.create failed');

      const result: ToolResult<CalendarCreateOutput> = {
        success: false,
        error: `Failed to create event: ${errorMessage}`,
      };

      const executionMs = Date.now() - startTime;
      await writeAuditLog(prisma, context, 'calendar.create', input, result, executionMs);

      return result;
    }
  }

  // --------------------------------------------------------------------------
  // calendar.update
  // --------------------------------------------------------------------------
  async function update(
    input: CalendarUpdateInput,
    context: ToolContext
  ): Promise<ToolResult<CalendarUpdateOutput>> {
    const startTime = Date.now();

    try {
      // Find the event
      const existing = await prisma.familyEvent.findFirst({
        where: {
          id: input.eventId,
          familyId: context.familyId,
          deletedAt: null,
        },
      });

      if (!existing) {
        return {
          success: false,
          error: `Event not found: ${input.eventId}`,
        };
      }

      // Build update data
      const updateData: Prisma.FamilyEventUpdateInput = {};

      if (input.patch.title !== undefined) {
        updateData.title = input.patch.title;
      }
      if (input.patch.location !== undefined) {
        updateData.location = input.patch.location;
      }
      if (input.patch.notes !== undefined) {
        updateData.notes = input.patch.notes;
      }
      if (input.patch.allDay !== undefined) {
        updateData.allDay = input.patch.allDay;
      }

      // Handle date changes
      let newStartAt = existing.startAt;
      let newEndAt = existing.endAt;

      if (input.patch.startAt !== undefined) {
        newStartAt = new Date(input.patch.startAt);
        updateData.startAt = newStartAt;
      }
      if (input.patch.endAt !== undefined) {
        newEndAt = new Date(input.patch.endAt);
        updateData.endAt = newEndAt;
      }

      // Validate date range if either changed
      if (input.patch.startAt || input.patch.endAt) {
        if (newEndAt <= newStartAt) {
          return {
            success: false,
            error: 'End time must be after start time',
          };
        }
      }

      // Update the event
      const event = await prisma.familyEvent.update({
        where: { id: input.eventId },
        data: updateData,
        include: {
          attendees: true,
        },
      });

      const memberMap = await getFamilyMembersMap(context.familyId);

      const result: ToolResult<CalendarUpdateOutput> = {
        success: true,
        data: {
          event: mapEventToOutput(event, memberMap),
        },
      };

      const executionMs = Date.now() - startTime;
      await writeAuditLog(prisma, context, 'calendar.update', input, result, executionMs);

      context.logger.info(
        { eventId: event.id, patch: Object.keys(input.patch) },
        'Updated calendar event'
      );

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      context.logger.error({ err, input }, 'calendar.update failed');

      const result: ToolResult<CalendarUpdateOutput> = {
        success: false,
        error: `Failed to update event: ${errorMessage}`,
      };

      const executionMs = Date.now() - startTime;
      await writeAuditLog(prisma, context, 'calendar.update', input, result, executionMs);

      return result;
    }
  }

  return {
    search,
    create,
    update,
  };
}
