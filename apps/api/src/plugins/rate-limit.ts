import type { FastifyInstance } from "fastify";

import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";

async function rateLimitPlugin(fastify: FastifyInstance) {
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });
}

export default fp(rateLimitPlugin, { name: "rate-limit" });
