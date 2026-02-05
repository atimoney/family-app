// Task tool schemas
export * from './task-schemas.js';

// Task tools
export {
  tasksListTool,
  tasksCreateTool,
  tasksCompleteTool,
  tasksAssignTool,
  registerTaskToolHandlers,
  taskToolHandlers,
  type TaskToolHandler,
} from './task-tools.js';

// Calendar tool schemas
export * from './calendar-schemas.js';

// Calendar tools
export {
  calendarSearchTool,
  calendarCreateTool,
  calendarUpdateTool,
  calendarBatchUpdateTool,
  registerCalendarToolHandlers,
  calendarToolHandlers,
  type CalendarToolHandler,
} from './calendar-tools.js';

// Meal tool schemas
export * from './meal-schemas.js';

// Meal tools
export {
  mealsGeneratePlanTool,
  mealsSavePlanTool,
  mealsGetPlanTool,
  registerMealToolHandlers,
  mealToolHandlers,
  type MealToolHandler,
} from './meal-tools.js';

// Shopping tool schemas
export * from './shopping-schemas.js';

// Shopping tools
export {
  shoppingAddItemsTool,
  shoppingGetPrimaryListTool,
  shoppingGetItemsTool,
  shoppingCheckItemsTool,
  registerShoppingToolHandlers,
  shoppingToolHandlers,
  type ShoppingToolHandler,
} from './shopping-tools.js';

// Prefs (memory) tool schemas
export * from './prefs-schemas.js';

// Prefs tools
export {
  prefsGetTool,
  prefsSetTool,
  prefsDeleteTool,
  prefsListTool,
  prefsGetBulkTool,
  registerPrefsToolHandlers,
  prefsToolHandlers,
  type PrefsToolHandler,
} from './prefs-tools.js';
