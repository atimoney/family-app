import type {
  AgentRequest,
  AgentResponse,
  AgentRunContext,
  AgentDomain,
  AgentAction,
  PendingActionInfo,
} from './types.js';
import { routeIntent, detectMultiIntent } from './router.js';

// ----------------------------------------------------------------------
// SPECIALIST AGENT EXECUTORS
// ----------------------------------------------------------------------

/**
 * Result from an agent executor.
 */
export type AgentExecutorResult = {
  text: string;
  actions: AgentAction[];
  payload?: Record<string, unknown>;
  requiresConfirmation?: boolean;
  pendingAction?: PendingActionInfo;
};

/**
 * Executor function signature for specialist agents.
 */
export type AgentExecutor = (
  message: string,
  context: AgentRunContext
) => Promise<AgentExecutorResult>;

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
// MULTI-INTENT HANDLER
// ----------------------------------------------------------------------

/**
 * Handle multi-intent messages by executing multiple agents and merging results.
 */
async function handleMultiIntent(
  domains: AgentDomain[],
  request: AgentRequest,
  context: AgentRunContext
): Promise<AgentExecutorResult> {
  context.logger.info(
    { domains, requestId: context.requestId },
    'Orchestrator: handling multi-intent request'
  );

  const results: AgentExecutorResult[] = [];
  const allActions: AgentAction[] = [];

  // Execute each domain's specialist agent
  for (const domain of domains) {
    const executor = getAgentExecutor(domain);
    if (executor) {
      try {
        const result = await executor(request.message, context);
        results.push(result);
        allActions.push(...result.actions);

        // If any result requires confirmation, prioritize it
        if (result.requiresConfirmation) {
          return {
            text: result.text,
            actions: result.actions,
            payload: { ...result.payload, multiIntent: true, domains },
            requiresConfirmation: true,
            pendingAction: result.pendingAction,
          };
        }
      } catch (error) {
        context.logger.error(
          { domain, error: error instanceof Error ? error.message : 'Unknown error' },
          'Multi-intent: executor failed for domain'
        );
      }
    }
  }

  // Merge successful results
  if (results.length === 0) {
    return {
      text: 'Sorry, I had trouble processing your request. Please try again.',
      actions: [],
      payload: { error: true },
    };
  }

  // Combine text responses
  const combinedText = results.map((r) => r.text).join('\n\n---\n\n');

  // Merge payloads
  const combinedPayload: Record<string, unknown> = {
    multiIntent: true,
    domains,
  };
  for (const result of results) {
    if (result.payload) {
      Object.assign(combinedPayload, result.payload);
    }
  }

  return {
    text: combinedText,
    actions: allActions,
    payload: combinedPayload,
  };
}

// ----------------------------------------------------------------------
// ORCHESTRATOR
// ----------------------------------------------------------------------

/**
 * Main orchestrator that routes requests and coordinates agent execution.
 *
 * Flow:
 * 1. Check for multi-intent messages
 * 2. Route the intent to a domain (or multiple domains)
 * 3. Get the specialist executor(s) for those domains
 * 4. Execute and return the response
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

  // Step 1: Check for multi-intent (unless domain hint is provided)
  if (!request.domainHint) {
    const multiIntent = detectMultiIntent(request.message, { logger: context.logger });

    if (multiIntent.isMultiIntent && multiIntent.domains.length > 1) {
      context.logger.info(
        { domains: multiIntent.domains, reasons: multiIntent.reasons },
        'Orchestrator: detected multi-intent'
      );

      const result = await handleMultiIntent(multiIntent.domains, request, context);

      const durationMs = Date.now() - startTime;
      context.logger.info(
        {
          requestId: context.requestId,
          domains: multiIntent.domains,
          durationMs,
          actionCount: result.actions.length,
        },
        'Orchestrator: multi-intent request completed'
      );

      return {
        text: result.text,
        actions: result.actions,
        payload: result.payload,
        domain: multiIntent.domains[0], // Primary domain
        conversationId: context.conversationId,
        requestId: context.requestId,
        requiresConfirmation: result.requiresConfirmation,
        pendingAction: result.pendingAction,
      };
    }
  }

  // Step 2: Route the intent (single domain)
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

  // Step 3: Get the specialist executor
  const executor = getAgentExecutor(route.domain) ?? getAgentExecutor('unknown')!;

  // Step 4: Execute the specialist agent
  let result: AgentExecutorResult;
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
      requiresConfirmation: result.requiresConfirmation ?? false,
    },
    'Orchestrator: request completed'
  );

  // Step 5: Build and return the response
  return {
    text: result.text,
    actions: result.actions,
    payload: result.payload,
    domain: route.domain,
    conversationId: context.conversationId,
    requestId: context.requestId,
    requiresConfirmation: result.requiresConfirmation,
    pendingAction: result.pendingAction,
  };
}
