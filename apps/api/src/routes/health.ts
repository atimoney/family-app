import type { FastifyPluginAsync } from 'fastify';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/healthz', async () => {
    return { ok: true };
  });
};

export default healthRoutes;
