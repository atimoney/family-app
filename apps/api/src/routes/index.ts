import type { FastifyPluginAsync } from 'fastify';
import healthRoutes from './health.js';
import calendarRoutes from './calendar/index.js';
import tasksRoutes from './tasks/index.js';
import taskTemplatesRoutes from './task-templates/index.js';
import shoppingRoutes from './shopping/index.js';
import googleIntegrationRoutes from './integrations/google/index.js';
import eventsRoutes from './events/index.js';
import profileRoutes from './profile/index.js';
import familyRoutes from './family/index.js';
import inviteRoutes from './invites/index.js';
import categoriesRoutes from './family/categories.js';
import listsRoutes from './lists/index.js';
import listItemsRoutes from './lists/items.js';
import agentRoutes from './agent/index.js';

const routes: FastifyPluginAsync = async (fastify) => {
  // Health check at root level
  fastify.register(healthRoutes);

  // Profile routes
  fastify.register(profileRoutes, { prefix: '/api' });

  // Family and invite routes
  fastify.register(familyRoutes, { prefix: '/api' });
  fastify.register(inviteRoutes, { prefix: '/api' });
  fastify.register(categoriesRoutes, { prefix: '/api' });

  // Lists routes
  fastify.register(listsRoutes, { prefix: '/api/lists' });
  fastify.register(listItemsRoutes, { prefix: '/api/items' });

  // Integration routes
  fastify.register(googleIntegrationRoutes, { prefix: '/integrations/google' });

  // Calendar events routes
  fastify.register(eventsRoutes);

  // v1 API routes
  fastify.register(calendarRoutes, { prefix: '/v1/calendar' });
  fastify.register(tasksRoutes, { prefix: '/v1/tasks' });
  fastify.register(taskTemplatesRoutes, { prefix: '/v1/task-templates' });
  fastify.register(shoppingRoutes, { prefix: '/v1/shopping' });

  // Agent & MCP routes
  fastify.register(agentRoutes, { prefix: '/agent' });
};

export default routes;
