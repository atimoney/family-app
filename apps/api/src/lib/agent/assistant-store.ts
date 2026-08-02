import { randomBytes } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { ToolCall } from '@family/agent-core';

// ----------------------------------------------------------------------
// Postgres-backed assistant state: chat history + pending confirmations.
// Replaces the old in-memory stores so state survives restarts and works
// across multiple API replicas.
// ----------------------------------------------------------------------

const HISTORY_LIMIT = 20;
const PENDING_ACTION_TTL_MS = 10 * 60 * 1000; // 10 minutes

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export type ChatScope = {
  conversationId: string;
  userId: string;
  familyId: string;
};

export async function loadChatHistory(
  prisma: PrismaClient,
  scope: ChatScope
): Promise<ChatTurn[]> {
  const rows = await prisma.agentChatMessage.findMany({
    where: {
      conversationId: scope.conversationId,
      userId: scope.userId,
      familyId: scope.familyId,
    },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT,
  });

  return rows
    .reverse()
    .map((row) => ({ role: row.role === 'assistant' ? 'assistant' : 'user', content: row.content }));
}

export async function appendChatMessages(
  prisma: PrismaClient,
  scope: ChatScope,
  turns: ChatTurn[]
): Promise<void> {
  if (turns.length === 0) return;
  await prisma.agentChatMessage.createMany({
    data: turns.map((turn) => ({
      conversationId: scope.conversationId,
      userId: scope.userId,
      familyId: scope.familyId,
      role: turn.role,
      content: turn.content,
    })),
  });
}

export type CreatePendingActionInput = ChatScope & {
  description: string;
  actions: ToolCall[];
};

export async function createPendingAction(
  prisma: PrismaClient,
  input: CreatePendingActionInput
): Promise<{ token: string; expiresAt: Date }> {
  const token = `pa_${randomBytes(16).toString('hex')}`;
  const expiresAt = new Date(Date.now() + PENDING_ACTION_TTL_MS);

  await prisma.agentPendingAction.create({
    data: {
      token,
      familyId: input.familyId,
      userId: input.userId,
      conversationId: input.conversationId,
      description: input.description,
      actions: input.actions as unknown as Prisma.InputJsonValue,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export type ConsumePendingActionResult =
  | { found: true; actions: ToolCall[]; description: string; conversationId: string }
  | { found: false; reason: 'not_found' | 'expired' };

/**
 * Atomically consumes a pending action: the row is read and deleted in one
 * transaction so a confirmation can only ever execute once, even across
 * replicas.
 */
export async function consumePendingAction(
  prisma: PrismaClient,
  token: string,
  userId: string,
  familyId: string
): Promise<ConsumePendingActionResult> {
  // Opportunistic cleanup of expired rows
  await prisma.agentPendingAction.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  return prisma.$transaction(async (tx) => {
    const row = await tx.agentPendingAction.findUnique({ where: { token } });
    if (!row || row.userId !== userId || row.familyId !== familyId) {
      return { found: false, reason: 'not_found' } as const;
    }

    await tx.agentPendingAction.delete({ where: { token } });

    if (row.expiresAt.getTime() < Date.now()) {
      return { found: false, reason: 'expired' } as const;
    }

    return {
      found: true,
      actions: row.actions as unknown as ToolCall[],
      description: row.description,
      conversationId: row.conversationId,
    } as const;
  });
}
