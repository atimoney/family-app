import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      jwt: JWTPayload;
    };
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Create remote JWKS for ES256 verification with timeout
  // The JWKS is cached by jose, but the initial fetch can hang if network is blocked
  const jwksUrl = new URL(fastify.config.SUPABASE_JWKS_URL);
  fastify.log.info({ jwksUrl: jwksUrl.toString() }, 'Initializing JWKS from Supabase');

  const JWKS = createRemoteJWKSet(jwksUrl, {
    // Timeout for fetching JWKS (in ms)
    timeoutDuration: 10000,
    // Cache the JWKS for 1 hour
    cooldownDuration: 3600000,
  });

  const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing Authorization header' });
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      fastify.log.debug('Verifying JWT token...');
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: fastify.config.SUPABASE_JWT_ISSUER,
        audience: fastify.config.SUPABASE_JWT_AUDIENCE,
      });
      fastify.log.debug({ userId: payload.sub }, 'JWT verified successfully');

      const userId = payload.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'Invalid token subject' });
      }

      request.user = {
        id: userId,
        jwt: payload,
      };
    } catch (err) {
      fastify.log.warn({ err }, 'Supabase token verification failed');
      return reply.status(401).send({ error: 'Invalid token' });
    }
  };

  fastify.decorate('authenticate', authenticate);
};

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['env'],
});
