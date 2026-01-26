import Fastify from 'fastify';
import cors from '@fastify/cors';
import envPlugin from './plugins/env.js';
import prismaPlugin from './plugins/prisma.js';
import routes from './routes/index.js';

export function buildServer() {
  const fastify = Fastify({
    logger: process.env.NODE_ENV !== 'production',
  });

  // Register plugins
  fastify.register(envPlugin);
  fastify.register(prismaPlugin);

  fastify.register(cors, (instance) => {
    // Support comma-separated list of origins or allow all if not set
    const corsOrigin = instance.config.CORS_ORIGIN;
    let origin: string[] | boolean = true;

    if (corsOrigin) {
      // Split by comma and trim whitespace
      origin = corsOrigin.split(',').map((o) => o.trim());
    }

    return {
      origin,
      credentials: true,
    };
  });

  // Register all routes
  fastify.register(routes);

  return fastify;
}
