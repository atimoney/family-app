import type { FastifyPluginAsync } from 'fastify';
import healthRoutes from './health.js';
import calendarRoutes from './calendar/index.js';
import tasksRoutes from './tasks/index.js';
import shoppingRoutes from './shopping/index.js';

const routes: FastifyPluginAsync = async (fastify) => {
  // Health check at root level
  fastify.register(healthRoutes);

  // v1 API routes
  fastify.register(calendarRoutes, { prefix: '/v1/calendar' });
  fastify.register(tasksRoutes, { prefix: '/v1/tasks' });
  fastify.register(shoppingRoutes, { prefix: '/v1/shopping' });
};

export default routes;
