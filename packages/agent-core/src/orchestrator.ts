import type {
  AgentRequest,
  AgentResponse,
  AgentRunContext,
  AgentDomain,
  AgentAction,
  PendingActionInfo,
} from './types.js';
import { routeIntent, detectMultiIntent } from './router.js';
import { conversationContextStore, type ConversationContext, type LastResultsContext, type CalendarEventSummary } from './conversation-context.js';

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
  message: string,
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
        const result = await executor(message, context);
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
 * 1. Load previous conversation context (for multi-turn interactions)
 * 2. Check for multi-intent messages
 * 3. Route the intent to a domain (or multiple domains)
 * 4. Get the specialist executor(s) for those domains
 * 5. Execute and return the response
 * 6. Store conversation context for follow-up messages
 */
export async function orchestrate(
  request: AgentRequest,
  context: AgentRunContext
): Promise<AgentResponse> {
  const startTime = Date.now();

  // Message should always be present when orchestrate is called
  // (confirmation flow is handled separately in the API layer)
  const message = request.message ?? '';

  // Step 0: Load previous conversation context
  const previousContext = conversationContextStore.get(
    context.conversationId,
    context.userId,
    context.familyId
  );

  // Attach previous context to the run context for agents to use
  context.previousContext = previousContext;

  // Debug: log context retrieval details
  context.logger.debug(
    {
      conversationId: context.conversationId,
      userId: context.userId,
      familyId: context.familyId,
      contextFound: !!previousContext,
      lastResultsEventCount: previousContext?.lastResults?.events?.length ?? 0,
      contextStoreSize: conversationContextStore.size,
    },
    'Orchestrator: context retrieval details'
  );

  context.logger.info(
    {
      requestId: context.requestId,
      message: message.substring(0, 100),
      conversationId: context.conversationId,
      domainHint: request.domainHint,
      hasPreviousContext: !!previousContext,
      awaitingInput: previousContext?.awaitingInput,
    },
    'Orchestrator: starting request'
  );

  // If we have previous context with pending input, use the previous domain as a hint
  let effectiveDomainHint = request.domainHint;
  if (!effectiveDomainHint && previousContext?.awaitingInput && previousContext.lastDomain) {
    effectiveDomainHint = previousContext.lastDomain;
    context.logger.debug(
      { lastDomain: previousContext.lastDomain, awaitingInput: previousContext.awaitingInput },
      'Orchestrator: using previous domain from context'
    );
  }

  // Step 1: Check for multi-intent (unless domain hint is provided)
  if (!effectiveDomainHint) {
    const multiIntent = await detectMultiIntent(message, { logger: context.logger, timezone: context.timezone });

    if (multiIntent.isMultiIntent && multiIntent.domains.length > 1) {
      context.logger.info(
        { domains: multiIntent.domains, reasons: multiIntent.reasons },
        'Orchestrator: detected multi-intent'
      );

      const result = await handleMultiIntent(multiIntent.domains, message, context);

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

      // Store context for multi-intent results (same logic as single-intent)
      const payload = result.payload ?? {};
      let lastResults: LastResultsContext | undefined;
      
      // Check if calendar domain returned events we should remember
      if (multiIntent.domains.includes('calendar') && payload.events && Array.isArray(payload.events)) {
        const events = payload.events as Array<{ id: string; title: string; startAt: string; allDay?: boolean; recurrenceRule?: string | null }>;
        if (events.length > 0 && events[0].id) {
          const eventSummaries: CalendarEventSummary[] = events.map((e) => ({
            id: e.id,
            title: e.title,
            startAt: e.startAt,
            allDay: e.allDay,
            recurrenceRule: e.recurrenceRule,
          }));
          
          lastResults = {
            domain: 'calendar',
            queryType: payload.analysisType === 'calendar_reasoning' ? 'analyze' : 'search',
            description: payload.analysisType === 'calendar_reasoning' 
              ? 'analyzed events' 
              : `searched for ${payload.matchingCount ?? events.length} events`,
            events: eventSummaries,
            timestamp: new Date(),
          };
          
          context.logger.info(
            { eventCount: eventSummaries.length, queryType: lastResults.queryType },
            'Orchestrator: storing multi-intent analyze/search results for follow-up'
          );
        }
      }
      
      if (lastResults) {
        conversationContextStore.set(
          context.conversationId,
          context.userId,
          context.familyId,
          {
            lastDomain: multiIntent.domains[0],
            lastResults,
          }
        );
        context.logger.info(
          { 
            conversationId: context.conversationId,
            domain: multiIntent.domains[0], 
            hasLastResults: true,
            lastResultsEventCount: lastResults.events?.length ?? 0,
            contextStoreSize: conversationContextStore.size,
          },
          'Orchestrator: stored multi-intent conversation context for follow-up'
        );
      }

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
  const route = await routeIntent(message, {
    domainHint: effectiveDomainHint,
    logger: context.logger,
    timezone: context.timezone,
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
    result = await executor(message, context);
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

  // Step 5: Update conversation context for multi-turn interactions
  const payload = result.payload ?? {};
  
  // Check if this result contains events from an analyze/search that we should remember
  // This enables follow-up commands like "change these to all-day events"
  let lastResults: LastResultsContext | undefined;
  if (route.domain === 'calendar' && payload.events && Array.isArray(payload.events)) {
    const events = payload.events as Array<{ id: string; title: string; startAt: string; allDay?: boolean; recurrenceRule?: string | null }>;
    if (events.length > 0 && events[0].id) {
      // Store summarized events for follow-up references
      const eventSummaries: CalendarEventSummary[] = events.map((e) => ({
        id: e.id,
        title: e.title,
        startAt: e.startAt,
        allDay: e.allDay,
        recurrenceRule: e.recurrenceRule,
      }));
      
      lastResults = {
        domain: 'calendar',
        queryType: payload.analysisType === 'calendar_reasoning' ? 'analyze' : 'search',
        description: payload.analysisType === 'calendar_reasoning' 
          ? 'analyzed events' 
          : `searched for ${payload.matchingCount ?? events.length} events`,
        events: eventSummaries,
        timestamp: new Date(),
      };
      
      context.logger.debug(
        { eventCount: eventSummaries.length, queryType: lastResults.queryType },
        'Orchestrator: storing analyze/search results for follow-up'
      );
    }
  }
  
  if (payload.awaitingInput || payload.pendingEvent || payload.pendingTask || lastResults) {
    // Store context for follow-up messages
    conversationContextStore.set(
      context.conversationId,
      context.userId,
      context.familyId,
      {
        lastDomain: route.domain,
        awaitingInput: payload.awaitingInput as ConversationContext['awaitingInput'],
        pendingEvent: payload.pendingEvent as ConversationContext['pendingEvent'],
        pendingTask: payload.pendingTask as ConversationContext['pendingTask'],
        lastResults,
      }
    );
    context.logger.info(
      { 
        conversationId: context.conversationId,
        domain: route.domain, 
        awaitingInput: payload.awaitingInput, 
        hasLastResults: !!lastResults,
        lastResultsEventCount: lastResults?.events?.length ?? 0,
        contextStoreSize: conversationContextStore.size,
      },
      'Orchestrator: stored conversation context for follow-up'
    );
  } else if (result.actions.length > 0 && result.actions.some(a => a.result.success)) {
    // Clear context after successful action
    conversationContextStore.clear(context.conversationId, context.userId, context.familyId);
    context.logger.debug({}, 'Orchestrator: cleared conversation context after successful action');
  }

  // Step 6: Build and return the response
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
