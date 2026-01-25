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
    return {
      origin: instance.config.CORS_ORIGIN ?? true,
      credentials: true,
    };
  });

  // Register all routes
  fastify.register(routes);

  return fastify;
}
