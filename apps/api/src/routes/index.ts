import type { FastifyPluginAsync } from 'fastify';
import healthRoutes from './health.js';
import calendarRoutes from './calendar/index.js';
import tasksRoutes from './tasks/index.js';
import shoppingRoutes from './shopping/index.js';
import googleIntegrationRoutes from './integrations/google/index.js';
import eventsRoutes from './events/index.js';
import profileRoutes from './profile/index.js';
import familyRoutes from './family/index.js';
import inviteRoutes from './invites/index.js';
import categoriesRoutes from './family/categories.js';

const routes: FastifyPluginAsync = async (fastify) => {
  // Health check at root level
  fastify.register(healthRoutes);

  // Profile routes
  fastify.register(profileRoutes, { prefix: '/api' });

  // Family and invite routes
  fastify.register(familyRoutes, { prefix: '/api' });
  fastify.register(inviteRoutes, { prefix: '/api' });
  fastify.register(categoriesRoutes, { prefix: '/api' });

  // Integration routes
  fastify.register(googleIntegrationRoutes, { prefix: '/integrations/google' });

  // Calendar events routes
  fastify.register(eventsRoutes);

  // v1 API routes
  fastify.register(calendarRoutes, { prefix: '/v1/calendar' });
  fastify.register(tasksRoutes, { prefix: '/v1/tasks' });
  fastify.register(shoppingRoutes, { prefix: '/v1/shopping' });
};

export default routes;
