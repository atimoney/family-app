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
    version: z.string().nullable().optional(),
  });

  // GET / - Root endpoint for probes and clients (public, no auth)
  fastify.get('/', async () => {
    const response = {
      status: 'ok' as const,
      service: 'family-api',
      env: process.env.NODE_ENV ?? null,
      version: process.env.APP_VERSION ?? null,
    };
    responseSchema.parse(response);
    return response;
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

  // GET /favicon.ico - Return 204 to prevent browser spam in logs
  fastify.get('/favicon.ico', async (_request, reply) => {
    return reply.code(204).send();
  });
};

export default healthRoutes;
