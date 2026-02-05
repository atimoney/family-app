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
      SUPABASE_JWKS_URL: string;
      SUPABASE_JWT_ISSUER?: string;
      SUPABASE_JWT_AUDIENCE?: string;
      GOOGLE_CLIENT_ID: string;
      GOOGLE_CLIENT_SECRET: string;
      GOOGLE_REDIRECT_URL: string;
      GOOGLE_SCOPES?: string;
      OAUTH_STATE_SECRET: string;
      TOKEN_ENCRYPTION_KEY: string;
      FRONTEND_URL?: string;
      // AI/LLM Configuration
      OPENAI_API_KEY?: string;
      AI_MODEL?: string;
      AI_MAX_TOKENS?: number;
      AI_TEMPERATURE?: number;
    };
  }
}

const schema = {
  type: 'object',
  required: [
    'DATABASE_URL',
    'SUPABASE_JWKS_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URL',
    'OAUTH_STATE_SECRET',
    'TOKEN_ENCRYPTION_KEY',
  ],
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
    SUPABASE_JWKS_URL: {
      type: 'string',
    },
    SUPABASE_JWT_ISSUER: {
      type: 'string',
    },
    SUPABASE_JWT_AUDIENCE: {
      type: 'string',
    },
    GOOGLE_CLIENT_ID: {
      type: 'string',
    },
    GOOGLE_CLIENT_SECRET: {
      type: 'string',
    },
    GOOGLE_REDIRECT_URL: {
      type: 'string',
    },
    GOOGLE_SCOPES: {
      type: 'string',
    },
    OAUTH_STATE_SECRET: {
      type: 'string',
    },
    TOKEN_ENCRYPTION_KEY: {
      type: 'string',
    },
    FRONTEND_URL: {
      type: 'string',
      default: 'http://localhost:8081',
    },
    // AI/LLM Configuration
    OPENAI_API_KEY: {
      type: 'string',
    },
    AI_MODEL: {
      type: 'string',
      default: 'gpt-4o',
    },
    AI_MAX_TOKENS: {
      type: 'number',
      default: 1024,
    },
    AI_TEMPERATURE: {
      type: 'number',
      default: 0.7,
    },
  },
} as const;

const envPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyEnv, {
    confKey: 'config',
    schema,
    dotenv: process.env.NODE_ENV !== 'production',
  });
};

export default fp(envPlugin, {
  name: 'env',
});
