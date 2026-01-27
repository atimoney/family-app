import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import authPlugin from '../plugins/auth.js';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(authPlugin);

  const responseSchema = z.object({
    ok: z.literal(true),
  });

  fastify.get('/healthz', { preHandler: [fastify.authenticate] }, async () => {
    const response = { ok: true };
    responseSchema.parse(response);
    return response;
  });
};

export default healthRoutes;
