import type {
  AgentRequest,
  AgentResponse,
  AgentRunContext,
  AgentDomain,
  AgentAction,
} from './types.js';
import { routeIntent } from './router.js';

// ----------------------------------------------------------------------
// SPECIALIST AGENT EXECUTORS
// ----------------------------------------------------------------------

/**
 * Executor function signature for specialist agents.
 */
export type AgentExecutor = (
  message: string,
  context: AgentRunContext
) => Promise<{
  text: string;
  actions: AgentAction[];
  payload?: Record<string, unknown>;
}>;

/**
 * Registry of specialist agent executors by domain.
 */
const agentExecutors: Partial<Record<AgentDomain, AgentExecutor>> = {};

/**
 * Register a specialist agent executor for a domain.
 */
export function registerAgentExecutor(domain: AgentDomain, executor: AgentExecutor): void {
  agentExecutors[domain] = executor;
}

/**
 * Get the registered executor for a domain.
 */
export function getAgentExecutor(domain: AgentDomain): AgentExecutor | undefined {
  return agentExecutors[domain];
}

// ----------------------------------------------------------------------
// DEFAULT EXECUTORS (STAGE 0 PLACEHOLDERS)
// ----------------------------------------------------------------------

const defaultUnknownExecutor: AgentExecutor = async (message, context) => {
  context.logger.info({ message }, 'Unknown domain executor called');
  return {
    text: "I'm not sure how to help with that. I can assist with tasks, calendar events, meals, and lists. Could you rephrase your request?",
    actions: [],
    payload: { hint: 'Try asking about tasks, events, meals, or shopping lists.' },
  };
};

const createPlaceholderExecutor = (domain: AgentDomain): AgentExecutor => {
  return async (message, context) => {
    context.logger.info({ domain, message }, 'Placeholder executor called');
    return {
      text: `I understand you want help with ${domain}. This feature is coming soon! For now, I've logged your request.`,
      actions: [],
      payload: { domain, status: 'placeholder' },
    };
  };
};

// Register default placeholder executors
registerAgentExecutor('unknown', defaultUnknownExecutor);
registerAgentExecutor('tasks', createPlaceholderExecutor('tasks'));
registerAgentExecutor('calendar', createPlaceholderExecutor('calendar'));
registerAgentExecutor('meals', createPlaceholderExecutor('meals'));
registerAgentExecutor('lists', createPlaceholderExecutor('lists'));

// ----------------------------------------------------------------------
// ORCHESTRATOR
// ----------------------------------------------------------------------

/**
 * Main orchestrator that routes requests and coordinates agent execution.
 *
 * Flow:
 * 1. Route the intent to a domain
 * 2. Get the specialist executor for that domain
 * 3. Execute and return the response
 */
export async function orchestrate(
  request: AgentRequest,
  context: AgentRunContext
): Promise<AgentResponse> {
  const startTime = Date.now();

  context.logger.info(
    {
      requestId: context.requestId,
      message: request.message.substring(0, 100),
      conversationId: context.conversationId,
      domainHint: request.domainHint,
    },
    'Orchestrator: starting request'
  );

  // Step 1: Route the intent
  const route = routeIntent(request.message, {
    domainHint: request.domainHint,
    logger: context.logger,
  });

  context.logger.info(
    {
      requestId: context.requestId,
      domain: route.domain,
      confidence: route.confidence,
      reasons: route.reasons,
    },
    'Orchestrator: intent routed'
  );

  // Step 2: Get the specialist executor
  const executor = getAgentExecutor(route.domain) ?? getAgentExecutor('unknown')!;

  // Step 3: Execute the specialist agent
  let result: Awaited<ReturnType<AgentExecutor>>;
  try {
    result = await executor(request.message, context);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.logger.error(
      {
        requestId: context.requestId,
        domain: route.domain,
        error: errorMessage,
      },
      'Orchestrator: executor failed'
    );

    result = {
      text: 'Sorry, I encountered an error processing your request. Please try again.',
      actions: [],
      payload: { error: true },
    };
  }

  const durationMs = Date.now() - startTime;

  context.logger.info(
    {
      requestId: context.requestId,
      domain: route.domain,
      durationMs,
      actionCount: result.actions.length,
    },
    'Orchestrator: request completed'
  );

  // Step 4: Build and return the response
  return {
    text: result.text,
    actions: result.actions,
    payload: result.payload,
    domain: route.domain,
    conversationId: context.conversationId,
    requestId: context.requestId,
  };
}
