import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyEnv from '@fastify/env';

declare module 'fastify' {
  interface FastifyInstance {
    config: {
      DATABASE_URL: string;
      API_PORT: number;
      API_HOST: string;
      CORS_ORIGIN?: string;
    };
  }
}

const schema = {
  type: 'object',
  required: ['DATABASE_URL'],
  properties: {
    DATABASE_URL: {
      type: 'string',
    },
    API_PORT: {
      type: 'number',
      default: 3001,
    },
    API_HOST: {
      type: 'string',
      default: '0.0.0.0',
    },
    CORS_ORIGIN: {
      type: 'string',
    },
  },
} as const;

const envPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyEnv, {
    confKey: 'config',
    schema,
    dotenv: true,
  });
};

export default fp(envPlugin, {
  name: 'env',
});
