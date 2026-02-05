import type { ToolCall } from './types.js';

// ----------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------

/**
 * Generate a random hex string for tokens.
 * Uses Web Crypto API which is available in all modern runtimes.
 */
function generateRandomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  // crypto is a global in Node.js 19+ and all modern browsers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cryptoObj = typeof globalThis !== 'undefined' && (globalThis as any).crypto;
  if (cryptoObj && cryptoObj.getRandomValues) {
    cryptoObj.getRandomValues(array);
  } else {
    // Fallback for testing environments
    for (let i = 0; i < bytes; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * A pending action awaiting user confirmation.
 */
export type PendingAction = {
  /** Unique confirmation token */
  token: string;
  /** User ID who initiated the action */
  userId: string;
  /** Family ID for scoping */
  familyId: string;
  /** Original request ID for correlation */
  requestId: string;
  /** Conversation ID for context */
  conversationId: string;
  /** The tool call to execute on confirmation */
  toolCall: ToolCall;
  /** Human-readable description of what will happen */
  description: string;
  /** When the action was created */
  createdAt: Date;
  /** TTL in milliseconds (default 5 minutes) */
  ttlMs: number;
  /** Whether this is a destructive action (delete/update) */
  isDestructive: boolean;
};

/**
 * Options for creating a pending action.
 */
export type CreatePendingActionOptions = {
  userId: string;
  familyId: string;
  requestId: string;
  conversationId: string;
  toolCall: ToolCall;
  description: string;
  isDestructive?: boolean;
  ttlMs?: number;
};

/**
 * Result of retrieving a pending action.
 */
export type GetPendingActionResult =
  | { found: true; action: PendingAction }
  | { found: false; reason: 'not_found' | 'expired' | 'user_mismatch' | 'family_mismatch' };

// ----------------------------------------------------------------------
// IN-MEMORY STORE
// ----------------------------------------------------------------------

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

/**
 * Error thrown when pending action capacity is exceeded.
 */
export class PendingActionCapacityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PendingActionCapacityError';
  }
}

/**
 * In-memory store for pending actions.
 * Production: Replace with Redis or database-backed store.
 */
class PendingActionStore {
  private actions: Map<string, PendingAction> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /** Maximum pending actions per user to prevent abuse */
  private static readonly MAX_ACTIONS_PER_USER = 10;
  /** Maximum total actions to prevent memory exhaustion */
  private static readonly MAX_TOTAL_ACTIONS = 10000;

  constructor() {
    this.startCleanup();
  }

  /**
   * Generate a secure, non-guessable token.
   * Format: pa_<32 random hex chars>
   * - No secrets, timestamps, or user data embedded
   * - Just a correlation ID
   */
  private generateToken(): string {
    return `pa_${generateRandomHex(16)}`;
  }

  /**
   * Create a pending action and return its token.
   * @throws {PendingActionCapacityError} If capacity limits are exceeded.
   */
  create(options: CreatePendingActionOptions): PendingAction {
    // Check per-user limit to prevent abuse
    const userActions = this.getByUser(options.userId);
    if (userActions.length >= PendingActionStore.MAX_ACTIONS_PER_USER) {
      throw new PendingActionCapacityError(
        `User has too many pending actions (max ${PendingActionStore.MAX_ACTIONS_PER_USER}). Please confirm or cancel existing actions first.`
      );
    }

    // Check total capacity to prevent memory exhaustion
    if (this.actions.size >= PendingActionStore.MAX_TOTAL_ACTIONS) {
      // Try cleanup first
      this.cleanup();
      if (this.actions.size >= PendingActionStore.MAX_TOTAL_ACTIONS) {
        throw new PendingActionCapacityError(
          'System is at capacity. Please try again later.'
        );
      }
    }

    const token = this.generateToken();
    const action: PendingAction = {
      token,
      userId: options.userId,
      familyId: options.familyId,
      requestId: options.requestId,
      conversationId: options.conversationId,
      toolCall: options.toolCall,
      description: options.description,
      createdAt: new Date(),
      ttlMs: options.ttlMs ?? DEFAULT_TTL_MS,
      isDestructive: options.isDestructive ?? false,
    };

    this.actions.set(token, action);
    return action;
  }

  /**
   * Get and validate a pending action.
   * Returns the action if valid, or reason for failure.
   */
  get(token: string, userId: string, familyId: string): GetPendingActionResult {
    const action = this.actions.get(token);

    if (!action) {
      return { found: false, reason: 'not_found' };
    }

    // Check expiry
    const elapsed = Date.now() - action.createdAt.getTime();
    if (elapsed > action.ttlMs) {
      this.actions.delete(token);
      return { found: false, reason: 'expired' };
    }

    // Validate user ownership
    if (action.userId !== userId) {
      return { found: false, reason: 'user_mismatch' };
    }

    // Validate family context
    if (action.familyId !== familyId) {
      return { found: false, reason: 'family_mismatch' };
    }

    return { found: true, action };
  }

  /**
   * Consume (get and delete) a pending action.
   * Use this when executing the confirmed action.
   */
  consume(token: string, userId: string, familyId: string): GetPendingActionResult {
    const result = this.get(token, userId, familyId);
    if (result.found) {
      this.actions.delete(token);
    }
    return result;
  }

  /**
   * Delete a pending action (e.g., on cancel).
   */
  delete(token: string): boolean {
    return this.actions.delete(token);
  }

  /**
   * Get all pending actions for a user (for debugging/admin).
   */
  getByUser(userId: string): PendingAction[] {
    const now = Date.now();
    return Array.from(this.actions.values()).filter((a) => {
      const elapsed = now - a.createdAt.getTime();
      return a.userId === userId && elapsed <= a.ttlMs;
    });
  }

  /**
   * Clean up expired actions.
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [token, action] of this.actions) {
      const elapsed = now - action.createdAt.getTime();
      if (elapsed > action.ttlMs) {
        this.actions.delete(token);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Start periodic cleanup.
   */
  private startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, CLEANUP_INTERVAL_MS);

    // Don't block process exit (Node.js specific)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (this.cleanupTimer as any).unref === 'function') {
      (this.cleanupTimer as any).unref();
    }
  }

  /**
   * Stop cleanup (for testing).
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Clear all actions (for testing).
   */
  clear(): void {
    this.actions.clear();
  }

  /**
   * Get count of pending actions (for monitoring).
   */
  get size(): number {
    return this.actions.size;
  }
}

// Singleton instance
export const pendingActionStore = new PendingActionStore();

// ----------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------

/**
 * Determine if a tool is a write operation that may require confirmation.
 */
export function isWriteTool(toolName: string): boolean {
  const writePatterns = ['.create', '.update', '.delete', '.assign', '.complete'];
  return writePatterns.some((p) => toolName.includes(p));
}

/**
 * Determine if a tool is destructive (harder to undo).
 */
export function isDestructiveTool(toolName: string): boolean {
  const destructivePatterns = ['.delete', '.remove'];
  return destructivePatterns.some((p) => toolName.includes(p));
}

/**
 * Confidence threshold for requiring confirmation.
 * Below this threshold, always ask for confirmation.
 */
export const CONFIDENCE_THRESHOLD = 0.85;
