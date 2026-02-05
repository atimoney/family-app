// Types
export * from './types.js';

// Registry
export {
  toolRegistry,
  defineTool,
  systemPingTool,
  systemListToolsTool,
} from './registry.js';

// Task tools
export * from './tools/index.js';

// Register task tools with the registry
import { toolRegistry } from './registry.js';
import {
  tasksListTool,
  tasksCreateTool,
  tasksCompleteTool,
  tasksAssignTool,
  calendarSearchTool,
  calendarCreateTool,
  calendarUpdateTool,
  calendarBatchUpdateTool,
  mealsGeneratePlanTool,
  mealsSavePlanTool,
  mealsGetPlanTool,
  shoppingAddItemsTool,
  shoppingGetPrimaryListTool,
  shoppingGetItemsTool,
  shoppingCheckItemsTool,
  prefsGetTool,
  prefsSetTool,
  prefsDeleteTool,
  prefsListTool,
  prefsGetBulkTool,
} from './tools/index.js';

toolRegistry.register(tasksListTool);
toolRegistry.register(tasksCreateTool);
toolRegistry.register(tasksCompleteTool);
toolRegistry.register(tasksAssignTool);

// Register calendar tools
toolRegistry.register(calendarSearchTool);
toolRegistry.register(calendarCreateTool);
toolRegistry.register(calendarUpdateTool);
toolRegistry.register(calendarBatchUpdateTool);

// Register meal tools
toolRegistry.register(mealsGeneratePlanTool);
toolRegistry.register(mealsSavePlanTool);
toolRegistry.register(mealsGetPlanTool);

// Register shopping tools
toolRegistry.register(shoppingAddItemsTool);
toolRegistry.register(shoppingGetPrimaryListTool);
toolRegistry.register(shoppingGetItemsTool);
toolRegistry.register(shoppingCheckItemsTool);

// Register preference (memory) tools
toolRegistry.register(prefsGetTool);
toolRegistry.register(prefsSetTool);
toolRegistry.register(prefsDeleteTool);
toolRegistry.register(prefsListTool);
toolRegistry.register(prefsGetBulkTool);
