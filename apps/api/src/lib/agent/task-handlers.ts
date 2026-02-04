import { type PrismaClient, Prisma } from '@prisma/client';
import type { ToolContext, ToolResult } from '@family/mcp-server';
import type {
  TasksListInput,
  TasksListOutput,
  TasksCreateInput,
  TasksCreateOutput,
  TasksCompleteInput,
  TasksCompleteOutput,
  TasksAssignInput,
  TasksAssignOutput,
  TaskOutput,
} from '@family/mcp-server';

// ----------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------

type DbTask = {
  id: string;
  familyId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: Date | null;
  completedAt: Date | null;
  assignedToUserId: string | null;
  createdByUserId: string;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
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

function mapTaskToOutput(
  task: DbTask,
  memberMap?: Map<string, FamilyMemberWithProfile>
): TaskOutput {
  const assignee = task.assignedToUserId
    ? memberMap?.get(task.assignedToUserId)
    : undefined;
  const assignedToName = assignee
    ? assignee.displayName || assignee.profile.displayName || assignee.profile.email
    : null;

  return {
    id: task.id,
    familyId: task.familyId,
    title: task.title,
    description: task.description,
    status: task.status as TaskOutput['status'],
    priority: task.priority as TaskOutput['priority'],
    dueAt: task.dueAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    assignedToUserId: task.assignedToUserId,
    assignedToName,
    createdByUserId: task.createdByUserId,
    labels: task.labels,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

/**
 * Redact sensitive fields from input for audit logging.
 */
function redactInput(input: Record<string, unknown>): Record<string, unknown> {
  // For now, task inputs don't have sensitive fields, but this is a good pattern
  const redacted = { ...input };
  // Example: if (redacted.password) redacted.password = '[REDACTED]';
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
    // Don't fail the tool if audit logging fails
    context.logger.error(
      { err, toolName, requestId: context.requestId },
      'Failed to write audit log'
    );
  }
}

// ----------------------------------------------------------------------
// HANDLER FACTORY
// ----------------------------------------------------------------------

export type TaskHandlerDependencies = {
  prisma: PrismaClient;
};

/**
 * Create task tool handlers with injected dependencies.
 */
export function createTaskToolHandlers(deps: TaskHandlerDependencies) {
  const { prisma } = deps;

  // Helper to get family members map
  async function getFamilyMembersMap(
    familyId: string
  ): Promise<Map<string, FamilyMemberWithProfile>> {
    const members = await prisma.familyMember.findMany({
      where: { familyId, removedAt: null },
      include: { profile: true },
    });
    return new Map(members.map((m) => [m.id, m as FamilyMemberWithProfile]));
  }

  // Helper to validate assignee belongs to family
  async function validateAssignee(
    familyId: string,
    assigneeId: string | null | undefined
  ): Promise<{ valid: boolean; error?: string }> {
    if (!assigneeId) return { valid: true };

    const member = await prisma.familyMember.findFirst({
      where: { id: assigneeId, familyId, removedAt: null },
    });

    if (!member) {
      return { valid: false, error: 'Assignee is not a member of this family' };
    }

    return { valid: true };
  }

  // --------------------------------------------------------------------------
  // tasks.list
  // --------------------------------------------------------------------------
  const listHandler = async (
    input: TasksListInput,
    context: ToolContext
  ): Promise<ToolResult<TasksListOutput>> => {
    const startTime = Date.now();

    context.logger.debug(
      { input, familyId: context.familyId },
      'tasks.list executing'
    );

    try {
      // Build where clause
      const where: Prisma.TaskWhereInput = {
        familyId: context.familyId,
        deletedAt: null,
      };

      // Status filter
      if (input.status === 'open') {
        where.status = { in: ['todo', 'doing'] };
      } else if (input.status === 'done') {
        where.status = 'done';
      }

      // Assignee filter
      if (input.assignedToUserId) {
        where.assignedToUserId = input.assignedToUserId;
      }

      const [tasks, total] = await Promise.all([
        prisma.task.findMany({
          where,
          orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
          take: input.limit,
        }),
        prisma.task.count({ where }),
      ]);

      const membersMap = await getFamilyMembersMap(context.familyId);

      const result: ToolResult<TasksListOutput> = {
        success: true,
        data: {
          items: tasks.map((t) => mapTaskToOutput(t, membersMap)),
          total,
        },
      };

      await writeAuditLog(prisma, context, 'tasks.list', input, result, Date.now() - startTime);

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      context.logger.error({ err }, 'tasks.list failed');

      const result: ToolResult<TasksListOutput> = { success: false, error };
      await writeAuditLog(prisma, context, 'tasks.list', input, result, Date.now() - startTime);

      return result;
    }
  };

  // --------------------------------------------------------------------------
  // tasks.create
  // --------------------------------------------------------------------------
  const createHandler = async (
    input: TasksCreateInput,
    context: ToolContext
  ): Promise<ToolResult<TasksCreateOutput>> => {
    const startTime = Date.now();

    context.logger.debug(
      { input, familyId: context.familyId },
      'tasks.create executing'
    );

    try {
      // Validate assignee if provided
      const assigneeValidation = await validateAssignee(
        context.familyId,
        input.assignedToUserId
      );
      if (!assigneeValidation.valid) {
        const result: ToolResult<TasksCreateOutput> = {
          success: false,
          error: assigneeValidation.error,
        };
        await writeAuditLog(prisma, context, 'tasks.create', input, result, Date.now() - startTime);
        return result;
      }

      const task = await prisma.task.create({
        data: {
          familyId: context.familyId,
          title: input.title,
          description: input.notes ?? null,
          status: 'todo',
          priority: input.priority ?? 'medium',
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          assignedToUserId: input.assignedToUserId ?? null,
          createdByUserId: context.familyMemberId,
          labels: [],
          isRecurring: false,
        },
      });

      const membersMap = await getFamilyMembersMap(context.familyId);

      const result: ToolResult<TasksCreateOutput> = {
        success: true,
        data: { task: mapTaskToOutput(task, membersMap) },
      };

      await writeAuditLog(prisma, context, 'tasks.create', input, result, Date.now() - startTime);

      context.logger.info(
        { taskId: task.id, title: task.title },
        'Task created via agent'
      );

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      context.logger.error({ err }, 'tasks.create failed');

      const result: ToolResult<TasksCreateOutput> = { success: false, error };
      await writeAuditLog(prisma, context, 'tasks.create', input, result, Date.now() - startTime);

      return result;
    }
  };

  // --------------------------------------------------------------------------
  // tasks.complete
  // --------------------------------------------------------------------------
  const completeHandler = async (
    input: TasksCompleteInput,
    context: ToolContext
  ): Promise<ToolResult<TasksCompleteOutput>> => {
    const startTime = Date.now();

    context.logger.debug(
      { input, familyId: context.familyId },
      'tasks.complete executing'
    );

    try {
      // Find the task
      const existing = await prisma.task.findFirst({
        where: {
          id: input.taskId,
          familyId: context.familyId,
          deletedAt: null,
        },
      });

      if (!existing) {
        const result: ToolResult<TasksCompleteOutput> = {
          success: false,
          error: 'Task not found',
        };
        await writeAuditLog(prisma, context, 'tasks.complete', input, result, Date.now() - startTime);
        return result;
      }

      const task = await prisma.task.update({
        where: { id: input.taskId },
        data: {
          status: 'done',
          completedAt: new Date(),
        },
      });

      const membersMap = await getFamilyMembersMap(context.familyId);

      const result: ToolResult<TasksCompleteOutput> = {
        success: true,
        data: { task: mapTaskToOutput(task, membersMap) },
      };

      await writeAuditLog(prisma, context, 'tasks.complete', input, result, Date.now() - startTime);

      context.logger.info(
        { taskId: task.id, title: task.title },
        'Task completed via agent'
      );

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      context.logger.error({ err }, 'tasks.complete failed');

      const result: ToolResult<TasksCompleteOutput> = { success: false, error };
      await writeAuditLog(prisma, context, 'tasks.complete', input, result, Date.now() - startTime);

      return result;
    }
  };

  // --------------------------------------------------------------------------
  // tasks.assign
  // --------------------------------------------------------------------------
  const assignHandler = async (
    input: TasksAssignInput,
    context: ToolContext
  ): Promise<ToolResult<TasksAssignOutput>> => {
    const startTime = Date.now();

    context.logger.debug(
      { input, familyId: context.familyId },
      'tasks.assign executing'
    );

    try {
      // Find the task
      const existing = await prisma.task.findFirst({
        where: {
          id: input.taskId,
          familyId: context.familyId,
          deletedAt: null,
        },
      });

      if (!existing) {
        const result: ToolResult<TasksAssignOutput> = {
          success: false,
          error: 'Task not found',
        };
        await writeAuditLog(prisma, context, 'tasks.assign', input, result, Date.now() - startTime);
        return result;
      }

      // Validate assignee if not null
      const assigneeValidation = await validateAssignee(
        context.familyId,
        input.assignedToUserId
      );
      if (!assigneeValidation.valid) {
        const result: ToolResult<TasksAssignOutput> = {
          success: false,
          error: assigneeValidation.error,
        };
        await writeAuditLog(prisma, context, 'tasks.assign', input, result, Date.now() - startTime);
        return result;
      }

      const task = await prisma.task.update({
        where: { id: input.taskId },
        data: {
          assignedToUserId: input.assignedToUserId,
        },
      });

      const membersMap = await getFamilyMembersMap(context.familyId);

      const result: ToolResult<TasksAssignOutput> = {
        success: true,
        data: { task: mapTaskToOutput(task, membersMap) },
      };

      await writeAuditLog(prisma, context, 'tasks.assign', input, result, Date.now() - startTime);

      context.logger.info(
        { taskId: task.id, assignedTo: input.assignedToUserId },
        'Task assigned via agent'
      );

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      context.logger.error({ err }, 'tasks.assign failed');

      const result: ToolResult<TasksAssignOutput> = { success: false, error };
      await writeAuditLog(prisma, context, 'tasks.assign', input, result, Date.now() - startTime);

      return result;
    }
  };

  return {
    list: listHandler,
    create: createHandler,
    complete: completeHandler,
    assign: assignHandler,
  };
}
