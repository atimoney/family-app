import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Dynamic import for Prisma client (CJS/ESM interop)
const { PrismaClient } = await import('@prisma/client');

type PrismaClientType = InstanceType<typeof PrismaClient>;

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClientType;
  }
}

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  const pool = new pg.Pool({
    connectionString: fastify.config.DATABASE_URL,
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  await prisma.$connect();

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (instance) => {
    await instance.prisma.$disconnect();
    await pool.end();
  });
};

export default fp(prismaPlugin, {
  name: 'prisma',
  dependencies: ['env'],
});
