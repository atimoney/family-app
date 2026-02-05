import type { FastifyRequest, FastifyReply } from 'fastify';

// ----------------------------------------------------------------------
// SIMPLE IN-MEMORY RATE LIMITER
// Production: Use Redis-backed rate limiter for distributed systems
// ----------------------------------------------------------------------

/**
 * Rate limit configuration.
 */
export type RateLimitConfig = {
  /** Maximum requests allowed in the window */
  max: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Key extractor function (default: user ID) */
  keyGenerator?: (request: FastifyRequest) => string;
  /** Custom error message */
  message?: string;
};

/**
 * Rate limit entry for tracking request counts.
 */
type RateLimitEntry = {
  count: number;
  resetAt: number;
};

/**
 * Simple in-memory rate limiter.
 * For production with multiple instances, use Redis.
 */
class RateLimiter {
  private entries: Map<string, RateLimitEntry> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private static readonly CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

  constructor() {
    this.startCleanup();
  }

  /**
   * Check if request is allowed and increment counter.
   * Returns { allowed: true } or { allowed: false, retryAfterMs }.
   */
  check(
    key: string,
    config: { max: number; windowMs: number }
  ): { allowed: true } | { allowed: false; retryAfterMs: number; current: number } {
    const now = Date.now();
    const entry = this.entries.get(key);

    // No existing entry or window expired
    if (!entry || now >= entry.resetAt) {
      this.entries.set(key, {
        count: 1,
        resetAt: now + config.windowMs,
      });
      return { allowed: true };
    }

    // Within window, check limit
    if (entry.count >= config.max) {
      return {
        allowed: false,
        retryAfterMs: entry.resetAt - now,
        current: entry.count,
      };
    }

    // Increment and allow
    entry.count++;
    return { allowed: true };
  }

  /**
   * Get remaining requests for a key.
   */
  getRemaining(key: string, max: number): number {
    const entry = this.entries.get(key);
    if (!entry || Date.now() >= entry.resetAt) {
      return max;
    }
    return Math.max(0, max - entry.count);
  }

  /**
   * Clean up expired entries.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now >= entry.resetAt) {
        this.entries.delete(key);
      }
    }
  }

  private startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, RateLimiter.CLEANUP_INTERVAL_MS);

    // Don't block process exit
    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
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
   * Clear all entries (for testing).
   */
  clear(): void {
    this.entries.clear();
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

/**
 * Create a rate limiting preHandler for Fastify routes.
 */
export function createRateLimitHandler(config: RateLimitConfig) {
  const {
    max,
    windowMs,
    keyGenerator = (req) => req.user?.id ?? req.ip,
    message = 'Too many requests, please try again later.',
  } = config;

  return async function rateLimitHandler(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const key = keyGenerator(request);
    const result = rateLimiter.check(key, { max, windowMs });

    // Add rate limit headers
    const remaining = rateLimiter.getRemaining(key, max);
    reply.header('X-RateLimit-Limit', max);
    reply.header('X-RateLimit-Remaining', remaining);

    if (!result.allowed) {
      const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);
      reply.header('Retry-After', retryAfterSeconds);
      reply.header('X-RateLimit-Reset', Date.now() + result.retryAfterMs);

      request.log.warn(
        {
          key,
          current: result.current,
          max,
          retryAfterMs: result.retryAfterMs,
        },
        'Rate limit exceeded'
      );

      reply.status(429).send({
        error: 'Too Many Requests',
        message,
        retryAfterSeconds,
      });
      return;
    }
  };
}

/**
 * Pre-configured rate limiters for different endpoints.
 */
export const rateLimits = {
  /**
   * Rate limit for /agent/chat endpoint.
   * 30 requests per minute per user.
   */
  agentChat: createRateLimitHandler({
    max: 30,
    windowMs: 60 * 1000,
    message: 'Too many chat requests. Please wait before sending more messages.',
  }),

  /**
   * Rate limit for /mcp/invoke endpoint.
   * More restrictive: 10 requests per minute per user.
   * This endpoint bypasses the agent confirmation flow.
   */
  mcpInvoke: createRateLimitHandler({
    max: 10,
    windowMs: 60 * 1000,
    message: 'Too many tool invocations. Please wait before trying again.',
  }),
};

// Export for testing
export { rateLimiter };
