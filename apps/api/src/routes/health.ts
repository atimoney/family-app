import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

/**
 * Health check routes - PUBLIC (no auth required).
 * These endpoints are used by Azure Container Apps, load balancers,
 * and monitoring tools. They must remain unauthenticated.
 */
const healthRoutes: FastifyPluginAsync = async (fastify) => {
  const responseSchema = z.object({
    status: z.literal('ok'),
    service: z.string(),
    env: z.string().nullable(),
  });

  // GET /healthz - Primary health check endpoint (public, no auth)
  fastify.get('/healthz', async () => {
    const response = {
      status: 'ok' as const,
      service: 'family-api',
      env: process.env.NODE_ENV ?? null,
    };
    responseSchema.parse(response);
    return response;
  });

  // GET /health - Alias for /healthz (public, no auth)
  fastify.get('/health', async () => {
    const response = {
      status: 'ok' as const,
      service: 'family-api',
      env: process.env.NODE_ENV ?? null,
    };
    responseSchema.parse(response);
    return response;
  });
};

export default healthRoutes;
