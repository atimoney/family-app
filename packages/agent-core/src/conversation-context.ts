// ----------------------------------------------------------------------
// CONVERSATION CONTEXT STORE
// ----------------------------------------------------------------------

/**
 * Pending event data waiting for user clarification.
 */
export type PendingEventContext = {
  title: string;
  location?: string | null;
  attendees?: string[];
  startAt?: string | null;
  notes?: string | null;
};

/**
 * Context stored for a conversation to enable multi-turn interactions.
 */
export type ConversationContext = {
  /** Conversation ID */
  conversationId: string;
  /** User ID */
  userId: string;
  /** Family ID */
  familyId: string;
  /** The domain that was last active */
  lastDomain?: 'tasks' | 'calendar' | 'meals' | 'lists' | 'unknown';
  /** What kind of input we're waiting for */
  awaitingInput?: 'dateTime' | 'time' | 'title' | 'confirmation' | null;
  /** Pending event data for calendar multi-turn */
  pendingEvent?: PendingEventContext;
  /** Pending task data for tasks multi-turn */
  pendingTask?: {
    title?: string;
    dueAt?: string | null;
    assignee?: string | null;
    priority?: string | null;
  };
  /** When this context was created */
  createdAt: Date;
  /** When this context expires */
  expiresAt: Date;
};

/**
 * In-memory conversation context store with TTL.
 */
class ConversationContextStore {
  private contexts: Map<string, ConversationContext> = new Map();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs: number = 10 * 60 * 1000) {
    // 10 minutes default TTL
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Generate a storage key from conversation, user, and family IDs.
   */
  private makeKey(conversationId: string, userId: string, familyId: string): string {
    return `${conversationId}:${userId}:${familyId}`;
  }

  /**
   * Store or update conversation context.
   */
  set(
    conversationId: string,
    userId: string,
    familyId: string,
    context: Partial<Omit<ConversationContext, 'conversationId' | 'userId' | 'familyId' | 'createdAt' | 'expiresAt'>>,
    ttlMs?: number
  ): ConversationContext {
    const key = this.makeKey(conversationId, userId, familyId);
    const existing = this.contexts.get(key);
    const now = new Date();
    const ttl = ttlMs ?? this.defaultTtlMs;

    const newContext: ConversationContext = {
      conversationId,
      userId,
      familyId,
      lastDomain: context.lastDomain ?? existing?.lastDomain,
      awaitingInput: context.awaitingInput ?? existing?.awaitingInput ?? null,
      pendingEvent: context.pendingEvent ?? existing?.pendingEvent,
      pendingTask: context.pendingTask ?? existing?.pendingTask,
      createdAt: existing?.createdAt ?? now,
      expiresAt: new Date(now.getTime() + ttl),
    };

    this.contexts.set(key, newContext);
    this.cleanup();
    return newContext;
  }

  /**
   * Get conversation context if it exists and hasn't expired.
   */
  get(
    conversationId: string,
    userId: string,
    familyId: string
  ): ConversationContext | null {
    const key = this.makeKey(conversationId, userId, familyId);
    const context = this.contexts.get(key);

    if (!context) {
      return null;
    }

    // Check expiration
    if (new Date() > context.expiresAt) {
      this.contexts.delete(key);
      return null;
    }

    return context;
  }

  /**
   * Clear conversation context (e.g., after successful action).
   */
  clear(conversationId: string, userId: string, familyId: string): boolean {
    const key = this.makeKey(conversationId, userId, familyId);
    return this.contexts.delete(key);
  }

  /**
   * Clear only specific parts of the context.
   */
  clearPending(
    conversationId: string,
    userId: string,
    familyId: string,
    type: 'event' | 'task' | 'all'
  ): void {
    const key = this.makeKey(conversationId, userId, familyId);
    const context = this.contexts.get(key);
    if (!context) return;

    if (type === 'event' || type === 'all') {
      context.pendingEvent = undefined;
    }
    if (type === 'task' || type === 'all') {
      context.pendingTask = undefined;
    }
    if (type === 'all') {
      context.awaitingInput = null;
    }

    this.contexts.set(key, context);
  }

  /**
   * Remove expired contexts.
   */
  private cleanup(): void {
    const now = new Date();
    for (const [key, context] of this.contexts) {
      if (now > context.expiresAt) {
        this.contexts.delete(key);
      }
    }
  }

  /**
   * Get store size (for testing/monitoring).
   */
  get size(): number {
    return this.contexts.size;
  }
}

// Export singleton instance
export const conversationContextStore = new ConversationContextStore();
