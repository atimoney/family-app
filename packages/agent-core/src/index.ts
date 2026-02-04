// Types
export * from './types.js';

// Router
export { routeIntent, detectMultiIntent, type MultiIntentResult } from './router.js';

// Orchestrator
export {
  orchestrate,
  registerAgentExecutor,
  getAgentExecutor,
  type AgentExecutor,
  type AgentExecutorResult,
} from './orchestrator.js';

// Agents
export {
  executeTasksAgent,
  executeTasksConfirmedAction,
  type TasksAgentResult,
  type ToolExecutor,
  executeCalendarAgent,
  executeCalendarConfirmedAction,
  type CalendarAgentResult,
} from './agents/index.js';

// Utils
export { parseDateTime, extractDateTimeFromMessage, parseDateRange } from './utils/index.js';

// Confirmation
export {
  pendingActionStore,
  isWriteTool,
  isDestructiveTool,
  CONFIDENCE_THRESHOLD,
  type PendingAction,
  type CreatePendingActionOptions,
  type GetPendingActionResult,
} from './confirmation.js';
