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
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { createEvent as createGoogleEvent, listEvents as listGoogleEvents } from '../google/calendar.js';
import { getOAuthClient, getAuthorizedClient } from '../google/oauth.js';
import { decryptSecret } from '../crypto.js';

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
  googleOAuth?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  tokenEncryptionKey?: string;
};

/**
 * Create calendar tool handlers with injected dependencies.
 */
export function createCalendarToolHandlers(deps: CalendarHandlerDependencies) {
  const { prisma, googleOAuth, tokenEncryptionKey } = deps;

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

  /**
   * Helper to get an authorized Google Calendar OAuth client for a user.
   * Returns null if Google OAuth is not configured or user has no account.
   */
  async function getGoogleCalendarAuth(userId: string): Promise<OAuth2Client | null> {
    if (!googleOAuth || !tokenEncryptionKey) {
      return null;
    }

    const googleAccount = await prisma.googleAccount.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    if (!googleAccount) {
      return null;
    }

    try {
      const refreshToken = decryptSecret(googleAccount.refreshToken, tokenEncryptionKey);
      const oauthClient = getOAuthClient(googleOAuth);
      return getAuthorizedClient({ oauthClient, refreshToken });
    } catch (err) {
      // Failed to get OAuth client, will fall back to local-only
      return null;
    }
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
      // Get Google OAuth client for the user
      const authClient = await getGoogleCalendarAuth(context.userId);
      if (!authClient) {
        return {
          success: false,
          error: 'Google Calendar not connected. Please connect your Google account in Settings.',
        };
      }

      // Determine which calendar to use (same logic as create)
      let calendarId: string = 'primary';

      const family = await prisma.family.findUnique({
        where: { id: context.familyId },
        select: { sharedCalendarId: true },
      });

      if (family?.sharedCalendarId) {
        calendarId = family.sharedCalendarId;
      } else {
        // Fall back to user's first selected calendar
        const selectedCalendar = await prisma.selectedCalendar.findFirst({
          where: { userId: context.userId, isVisible: true },
          orderBy: { createdAt: 'asc' },
        });
        if (selectedCalendar) {
          calendarId = selectedCalendar.calendarId;
        }
      }

      // Set default date range if not provided (default to next 30 days)
      const now = new Date();
      const timeMin = input.from ?? now.toISOString();
      const timeMax = input.to ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch events from Google Calendar
      const googleEvents = await listGoogleEvents({
        auth: authClient,
        calendarId,
        timeMin,
        timeMax,
      });

      // Filter by query if provided
      let filteredEvents = googleEvents;
      if (input.query) {
        const queryLower = input.query.toLowerCase();
        filteredEvents = googleEvents.filter((event) => {
          const title = event.summary?.toLowerCase() ?? '';
          const description = event.description?.toLowerCase() ?? '';
          return title.includes(queryLower) || description.includes(queryLower);
        });
      }

      // Apply limit
      const limit = input.limit ?? 20;
      const limitedEvents = filteredEvents.slice(0, limit);

      // Map Google Calendar events to our output format
      const events: CalendarEventOutput[] = limitedEvents.map((event) => {
        // Parse start/end times
        const startAt = event.start?.dateTime ?? event.start?.date ?? '';
        const endAt = event.end?.dateTime ?? event.end?.date ?? '';
        const allDay = !event.start?.dateTime;

        return {
          id: event.id ?? '',
          familyId: context.familyId,
          title: event.summary ?? 'Untitled Event',
          startAt,
          endAt,
          location: event.location ?? null,
          notes: event.description ?? null,
          allDay,
          createdByUserId: context.familyMemberId,
          attendees: event.attendees?.map((a) => ({
            userId: a.email ?? '',
            displayName: a.displayName ?? a.email ?? null,
            status: (a.responseStatus === 'accepted' ? 'accepted' :
                    a.responseStatus === 'declined' ? 'declined' : 'pending') as 'pending' | 'accepted' | 'declined',
          })) ?? [],
          createdAt: event.created ?? new Date().toISOString(),
          updatedAt: event.updated ?? new Date().toISOString(),
        };
      });

      const result: ToolResult<CalendarSearchOutput> = {
        success: true,
        data: {
          events,
          total: filteredEvents.length,
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

      // Get Google OAuth client for the user
      const authClient = await getGoogleCalendarAuth(context.userId);
      if (!authClient) {
        return {
          success: false,
          error: 'Google Calendar not connected. Please connect your Google account in Settings.',
        };
      }

      // Determine which calendar to use:
      // 1. Family's shared calendar (if set)
      // 2. User's first selected calendar
      // 3. Primary calendar as fallback
      let calendarId: string = 'primary';

      const family = await prisma.family.findUnique({
        where: { id: context.familyId },
        select: { sharedCalendarId: true },
      });

      if (family?.sharedCalendarId) {
        calendarId = family.sharedCalendarId;
      } else {
        // Fall back to user's first selected calendar
        const selectedCalendar = await prisma.selectedCalendar.findFirst({
          where: { userId: context.userId, isVisible: true },
          orderBy: { createdAt: 'asc' },
        });
        if (selectedCalendar) {
          calendarId = selectedCalendar.calendarId;
        }
      }

      // Create event directly in Google Calendar (same as calendar page)
      const googleEvent = await createGoogleEvent({
        auth: authClient,
        calendarId,
        event: {
          summary: input.title,
          description: input.notes ?? undefined,
          location: input.location ?? undefined,
          start: input.allDay
            ? { date: startAt.toISOString().split('T')[0] }
            : { dateTime: startAt.toISOString(), timeZone: context.timezone ?? 'UTC' },
          end: input.allDay
            ? { date: endAt.toISOString().split('T')[0] }
            : { dateTime: endAt.toISOString(), timeZone: context.timezone ?? 'UTC' },
        },
      });

      const eventId = googleEvent.id ?? '';

      // Store metadata in EventLink (same pattern as calendar page)
      if (eventId) {
        const eventExtraData = {
          tags: [] as string[],
          category: null,
          notes: input.notes ?? null,
          audience: 'family',
          createdVia: 'ai-agent',
        };

        await prisma.eventLink.upsert({
          where: {
            userId_calendarId_eventId: {
              userId: context.userId,
              calendarId,
              eventId,
            },
          },
          create: {
            userId: context.userId,
            calendarId,
            eventId,
            extraData: eventExtraData,
          },
          update: {
            extraData: eventExtraData,
          },
        });
      }

      // Build response in the expected format
      const result: ToolResult<CalendarCreateOutput> = {
        success: true,
        data: {
          event: {
            id: eventId,
            familyId: context.familyId,
            title: googleEvent.summary ?? input.title,
            startAt: input.startAt,
            endAt: input.endAt,
            location: googleEvent.location ?? input.location ?? null,
            notes: input.notes ?? null,
            allDay: input.allDay ?? false,
            createdByUserId: context.familyMemberId,
            attendees: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      };

      const executionMs = Date.now() - startTime;
      await writeAuditLog(prisma, context, 'calendar.create', input, result, executionMs);

      context.logger.info(
        { eventId, title: input.title, calendarId },
        'Created calendar event in Google Calendar'
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
