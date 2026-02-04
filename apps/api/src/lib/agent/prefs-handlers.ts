/**
 * Preference (memory) tool handlers.
 *
 * Implements Prisma-based handlers for preference tools with RBAC enforcement
 * and audit logging.
 */

import { type PrismaClient, Prisma } from '@prisma/client';
import type { ToolContext, ToolResult } from '@family/mcp-server';
import type {
  PrefsGetInput,
  PrefsGetOutput,
  PrefsSetInput,
  PrefsSetOutput,
  PrefsDeleteInput,
  PrefsDeleteOutput,
  PrefsListInput,
  PrefsListOutput,
  PrefsGetBulkInput,
  PrefsGetBulkOutput,
  PrefItem,
} from '@family/mcp-server';

// ----------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------

export type PrefsHandlerDependencies = {
  prisma: PrismaClient;
};

// ----------------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------------

/**
 * Sensitive keys that should have values redacted in audit logs.
 */
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /credential/i,
];

/**
 * Keys that can only be set by admins/parents at the family level.
 */
const FAMILY_ADMIN_ONLY_KEYS = [
  'meals.allergies',
  'meals.dietaryRestrictions',
  'general.timezone',
];

// ----------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function redactInput(
  input: Record<string, unknown>,
  key: string
): Record<string, unknown> {
  if (isSensitiveKey(key) && 'valueJson' in input) {
    return { ...input, valueJson: '[REDACTED]' };
  }
  return { ...input };
}

async function writeAuditLog(
  prisma: PrismaClient,
  context: ToolContext,
  toolName: string,
  input: Record<string, unknown>,
  key: string,
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
        input: redactInput(input, key) as Prisma.InputJsonValue,
        output:
          result.success && result.data
            ? (result.data as Prisma.InputJsonValue)
            : Prisma.JsonNull,
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

/**
 * Check if the user has permission to set a family-wide preference.
 * Returns true if allowed, false otherwise.
 */
async function canSetFamilyPreference(
  prisma: PrismaClient,
  familyId: string,
  userId: string,
  key: string
): Promise<boolean> {
  // Get the family member record
  const member = await prisma.familyMember.findFirst({
    where: {
      familyId,
      profileId: userId,
      removedAt: null,
    },
    select: {
      role: true,
      isChild: true,
    },
  });

  if (!member) {
    return false; // Not a member of this family
  }

  // Admin-only keys require owner/admin role
  if (FAMILY_ADMIN_ONLY_KEYS.includes(key)) {
    return member.role === 'owner' || member.role === 'admin';
  }

  // Children cannot set family preferences
  if (member.isChild) {
    return false;
  }

  // Regular members can set non-admin family preferences
  return true;
}

/**
 * Check if the user has permission to set a person-specific preference.
 * - Users can set their own preferences
 * - Parents/admins can set preferences for children
 */
async function canSetPersonPreference(
  prisma: PrismaClient,
  familyId: string,
  actingUserId: string,
  targetUserId: string
): Promise<boolean> {
  // Users can always set their own preferences
  if (actingUserId === targetUserId) {
    return true;
  }

  // Check if acting user is admin/owner and target is a child
  const [actingMember, targetMember] = await Promise.all([
    prisma.familyMember.findFirst({
      where: {
        familyId,
        profileId: actingUserId,
        removedAt: null,
      },
      select: { role: true },
    }),
    prisma.familyMember.findFirst({
      where: {
        familyId,
        profileId: targetUserId,
        removedAt: null,
      },
      select: { isChild: true },
    }),
  ]);

  if (!actingMember || !targetMember) {
    return false;
  }

  // Admins/owners can set preferences for children
  if (
    (actingMember.role === 'owner' || actingMember.role === 'admin') &&
    targetMember.isChild
  ) {
    return true;
  }

  return false;
}

/**
 * Check if the user is a member of the family.
 */
async function isFamilyMember(
  prisma: PrismaClient,
  familyId: string,
  userId: string
): Promise<boolean> {
  const member = await prisma.familyMember.findFirst({
    where: {
      familyId,
      profileId: userId,
      removedAt: null,
    },
  });
  return !!member;
}

// ----------------------------------------------------------------------
// HANDLER FACTORY
// ----------------------------------------------------------------------

export function createPrefsToolHandlers({ prisma }: PrefsHandlerDependencies) {
  // ====================================================================
  // prefs.get
  // ====================================================================
  async function get(
    input: PrefsGetInput,
    context: ToolContext
  ): Promise<ToolResult<PrefsGetOutput>> {
    const startTime = Date.now();
    const { scope, key, userId: targetUserId } = input;
    const { familyId, userId: actingUserId } = context;

    try {
      // Verify user is a family member
      if (!(await isFamilyMember(prisma, familyId, actingUserId))) {
        const result: ToolResult<PrefsGetOutput> = {
          success: false,
          error: 'User is not a member of this family',
        };
        await writeAuditLog(
          prisma,
          context,
          'prefs.get',
          input as unknown as Record<string, unknown>,
          key,
          result,
          Date.now() - startTime
        );
        return result;
      }

      if (scope === 'family') {
        const pref = await prisma.familyPreference.findUnique({
          where: {
            familyId_key: { familyId, key },
          },
        });

        const output: PrefsGetOutput = {
          key,
          valueJson: pref?.valueJson ?? null,
          exists: !!pref,
          updatedAt: pref?.updatedAt?.toISOString() ?? null,
          updatedByUserId: pref?.updatedByUserId ?? null,
        };

        const result: ToolResult<PrefsGetOutput> = { success: true, data: output };
        await writeAuditLog(
          prisma,
          context,
          'prefs.get',
          input as unknown as Record<string, unknown>,
          key,
          result,
          Date.now() - startTime
        );
        return result;
      } else {
        // Person scope
        const userId = targetUserId ?? actingUserId;

        const pref = await prisma.personPreference.findUnique({
          where: {
            familyId_userId_key: { familyId, userId, key },
          },
        });

        const output: PrefsGetOutput = {
          key,
          valueJson: pref?.valueJson ?? null,
          exists: !!pref,
          updatedAt: pref?.updatedAt?.toISOString() ?? null,
          updatedByUserId: pref?.updatedByUserId ?? null,
        };

        const result: ToolResult<PrefsGetOutput> = { success: true, data: output };
        await writeAuditLog(
          prisma,
          context,
          'prefs.get',
          input as unknown as Record<string, unknown>,
          key,
          result,
          Date.now() - startTime
        );
        return result;
      }
    } catch (err) {
      const result: ToolResult<PrefsGetOutput> = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
      await writeAuditLog(
        prisma,
        context,
        'prefs.get',
        input as unknown as Record<string, unknown>,
        key,
        result,
        Date.now() - startTime
      );
      return result;
    }
  }

  // ====================================================================
  // prefs.set
  // ====================================================================
  async function set(
    input: PrefsSetInput,
    context: ToolContext
  ): Promise<ToolResult<PrefsSetOutput>> {
    const startTime = Date.now();
    const { scope, key, userId: targetUserId, valueJson } = input;
    const { familyId, userId: actingUserId } = context;

    try {
      if (scope === 'family') {
        // Check permission
        if (!(await canSetFamilyPreference(prisma, familyId, actingUserId, key))) {
          const result: ToolResult<PrefsSetOutput> = {
            success: false,
            error: 'Permission denied: cannot set family preference',
          };
          await writeAuditLog(
            prisma,
            context,
            'prefs.set',
            input as unknown as Record<string, unknown>,
            key,
            result,
            Date.now() - startTime
          );
          return result;
        }

        // Check if preference exists
        const existing = await prisma.familyPreference.findUnique({
          where: { familyId_key: { familyId, key } },
        });

        // Upsert the preference
        await prisma.familyPreference.upsert({
          where: { familyId_key: { familyId, key } },
          create: {
            familyId,
            key,
            valueJson: valueJson as Prisma.InputJsonValue,
            updatedByUserId: actingUserId,
          },
          update: {
            valueJson: valueJson as Prisma.InputJsonValue,
            updatedByUserId: actingUserId,
          },
        });

        const output: PrefsSetOutput = {
          ok: true,
          key,
          created: !existing,
        };

        const result: ToolResult<PrefsSetOutput> = { success: true, data: output };
        await writeAuditLog(
          prisma,
          context,
          'prefs.set',
          input as unknown as Record<string, unknown>,
          key,
          result,
          Date.now() - startTime
        );
        return result;
      } else {
        // Person scope
        const userId = targetUserId ?? actingUserId;

        // Check permission
        if (!(await canSetPersonPreference(prisma, familyId, actingUserId, userId))) {
          const result: ToolResult<PrefsSetOutput> = {
            success: false,
            error: 'Permission denied: cannot set preference for this person',
          };
          await writeAuditLog(
            prisma,
            context,
            'prefs.set',
            input as unknown as Record<string, unknown>,
            key,
            result,
            Date.now() - startTime
          );
          return result;
        }

        // Check if preference exists
        const existing = await prisma.personPreference.findUnique({
          where: { familyId_userId_key: { familyId, userId, key } },
        });

        // Upsert the preference
        await prisma.personPreference.upsert({
          where: { familyId_userId_key: { familyId, userId, key } },
          create: {
            familyId,
            userId,
            key,
            valueJson: valueJson as Prisma.InputJsonValue,
            updatedByUserId: actingUserId,
          },
          update: {
            valueJson: valueJson as Prisma.InputJsonValue,
            updatedByUserId: actingUserId,
          },
        });

        const output: PrefsSetOutput = {
          ok: true,
          key,
          created: !existing,
        };

        const result: ToolResult<PrefsSetOutput> = { success: true, data: output };
        await writeAuditLog(
          prisma,
          context,
          'prefs.set',
          input as unknown as Record<string, unknown>,
          key,
          result,
          Date.now() - startTime
        );
        return result;
      }
    } catch (err) {
      const result: ToolResult<PrefsSetOutput> = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
      await writeAuditLog(
        prisma,
        context,
        'prefs.set',
        input as unknown as Record<string, unknown>,
        key,
        result,
        Date.now() - startTime
      );
      return result;
    }
  }

  // ====================================================================
  // prefs.delete
  // ====================================================================
  async function deletePref(
    input: PrefsDeleteInput,
    context: ToolContext
  ): Promise<ToolResult<PrefsDeleteOutput>> {
    const startTime = Date.now();
    const { scope, key, userId: targetUserId } = input;
    const { familyId, userId: actingUserId } = context;

    try {
      if (scope === 'family') {
        // Check permission (same as set)
        if (!(await canSetFamilyPreference(prisma, familyId, actingUserId, key))) {
          const result: ToolResult<PrefsDeleteOutput> = {
            success: false,
            error: 'Permission denied: cannot delete family preference',
          };
          await writeAuditLog(
            prisma,
            context,
            'prefs.delete',
            input as unknown as Record<string, unknown>,
            key,
            result,
            Date.now() - startTime
          );
          return result;
        }

        // Try to delete
        const deleted = await prisma.familyPreference.deleteMany({
          where: { familyId, key },
        });

        const output: PrefsDeleteOutput = {
          ok: true,
          existed: deleted.count > 0,
        };

        const result: ToolResult<PrefsDeleteOutput> = { success: true, data: output };
        await writeAuditLog(
          prisma,
          context,
          'prefs.delete',
          input as unknown as Record<string, unknown>,
          key,
          result,
          Date.now() - startTime
        );
        return result;
      } else {
        // Person scope
        const userId = targetUserId ?? actingUserId;

        // Check permission (same as set)
        if (!(await canSetPersonPreference(prisma, familyId, actingUserId, userId))) {
          const result: ToolResult<PrefsDeleteOutput> = {
            success: false,
            error: 'Permission denied: cannot delete preference for this person',
          };
          await writeAuditLog(
            prisma,
            context,
            'prefs.delete',
            input as unknown as Record<string, unknown>,
            key,
            result,
            Date.now() - startTime
          );
          return result;
        }

        // Try to delete
        const deleted = await prisma.personPreference.deleteMany({
          where: { familyId, userId, key },
        });

        const output: PrefsDeleteOutput = {
          ok: true,
          existed: deleted.count > 0,
        };

        const result: ToolResult<PrefsDeleteOutput> = { success: true, data: output };
        await writeAuditLog(
          prisma,
          context,
          'prefs.delete',
          input as unknown as Record<string, unknown>,
          key,
          result,
          Date.now() - startTime
        );
        return result;
      }
    } catch (err) {
      const result: ToolResult<PrefsDeleteOutput> = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
      await writeAuditLog(
        prisma,
        context,
        'prefs.delete',
        input as unknown as Record<string, unknown>,
        key,
        result,
        Date.now() - startTime
      );
      return result;
    }
  }

  // ====================================================================
  // prefs.list
  // ====================================================================
  async function list(
    input: PrefsListInput,
    context: ToolContext
  ): Promise<ToolResult<PrefsListOutput>> {
    const startTime = Date.now();
    const { scope, userId: targetUserId, keyPrefix } = input;
    const { familyId, userId: actingUserId } = context;

    try {
      // Verify user is a family member
      if (!(await isFamilyMember(prisma, familyId, actingUserId))) {
        const result: ToolResult<PrefsListOutput> = {
          success: false,
          error: 'User is not a member of this family',
        };
        await writeAuditLog(
          prisma,
          context,
          'prefs.list',
          input as unknown as Record<string, unknown>,
          keyPrefix ?? '*',
          result,
          Date.now() - startTime
        );
        return result;
      }

      if (scope === 'family') {
        const prefs = await prisma.familyPreference.findMany({
          where: {
            familyId,
            ...(keyPrefix ? { key: { startsWith: keyPrefix } } : {}),
          },
          orderBy: { key: 'asc' },
        });

        const items: PrefItem[] = prefs.map((p) => ({
          key: p.key,
          valueJson: p.valueJson,
          updatedAt: p.updatedAt.toISOString(),
          updatedByUserId: p.updatedByUserId,
        }));

        const output: PrefsListOutput = {
          preferences: items,
          count: items.length,
        };

        const result: ToolResult<PrefsListOutput> = { success: true, data: output };
        await writeAuditLog(
          prisma,
          context,
          'prefs.list',
          input as unknown as Record<string, unknown>,
          keyPrefix ?? '*',
          result,
          Date.now() - startTime
        );
        return result;
      } else {
        // Person scope
        const userId = targetUserId ?? actingUserId;

        const prefs = await prisma.personPreference.findMany({
          where: {
            familyId,
            userId,
            ...(keyPrefix ? { key: { startsWith: keyPrefix } } : {}),
          },
          orderBy: { key: 'asc' },
        });

        const items: PrefItem[] = prefs.map((p) => ({
          key: p.key,
          valueJson: p.valueJson,
          updatedAt: p.updatedAt.toISOString(),
          updatedByUserId: p.updatedByUserId,
        }));

        const output: PrefsListOutput = {
          preferences: items,
          count: items.length,
        };

        const result: ToolResult<PrefsListOutput> = { success: true, data: output };
        await writeAuditLog(
          prisma,
          context,
          'prefs.list',
          input as unknown as Record<string, unknown>,
          keyPrefix ?? '*',
          result,
          Date.now() - startTime
        );
        return result;
      }
    } catch (err) {
      const result: ToolResult<PrefsListOutput> = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
      await writeAuditLog(
        prisma,
        context,
        'prefs.list',
        input as unknown as Record<string, unknown>,
        keyPrefix ?? '*',
        result,
        Date.now() - startTime
      );
      return result;
    }
  }

  // ====================================================================
  // prefs.getBulk
  // ====================================================================
  async function getBulk(
    input: PrefsGetBulkInput,
    context: ToolContext
  ): Promise<ToolResult<PrefsGetBulkOutput>> {
    const startTime = Date.now();
    const { requests } = input;
    const { familyId, userId: actingUserId } = context;

    try {
      // Verify user is a family member
      if (!(await isFamilyMember(prisma, familyId, actingUserId))) {
        const result: ToolResult<PrefsGetBulkOutput> = {
          success: false,
          error: 'User is not a member of this family',
        };
        await writeAuditLog(
          prisma,
          context,
          'prefs.getBulk',
          input as unknown as Record<string, unknown>,
          '*',
          result,
          Date.now() - startTime
        );
        return result;
      }

      const results: Record<string, unknown> = {};

      // Process each request
      for (const req of requests) {
        const { scope, key, userId: targetUserId } = req;
        const resultKey = scope === 'person' && targetUserId ? `${key}:${targetUserId}` : key;

        if (scope === 'family') {
          const pref = await prisma.familyPreference.findUnique({
            where: { familyId_key: { familyId, key } },
          });
          results[resultKey] = pref?.valueJson ?? null;
        } else {
          const userId = targetUserId ?? actingUserId;
          const pref = await prisma.personPreference.findUnique({
            where: { familyId_userId_key: { familyId, userId, key } },
          });
          results[resultKey] = pref?.valueJson ?? null;
        }
      }

      const output: PrefsGetBulkOutput = { results };

      const result: ToolResult<PrefsGetBulkOutput> = { success: true, data: output };
      await writeAuditLog(
        prisma,
        context,
        'prefs.getBulk',
        { requestCount: requests.length },
        '*',
        result,
        Date.now() - startTime
      );
      return result;
    } catch (err) {
      const result: ToolResult<PrefsGetBulkOutput> = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
      await writeAuditLog(
        prisma,
        context,
        'prefs.getBulk',
        { requestCount: requests.length },
        '*',
        result,
        Date.now() - startTime
      );
      return result;
    }
  }

  return {
    get,
    set,
    delete: deletePref,
    list,
    getBulk,
  };
}
