import { z } from 'zod';
import type { AgentDomain, IntentRoute, AgentLogger } from './types.js';
import { MockLLMProvider } from './llm/index.js';

// Initialize LLM Provider (In production, inject this via dependency injection)
const llmProvider = new MockLLMProvider();

// ----------------------------------------------------------------------
// SCHEMAS
// ----------------------------------------------------------------------

const routerResponseSchema = z.object({
  domain: z.enum(['tasks', 'calendar', 'meals', 'lists', 'unknown']),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  isMultiIntent: z.boolean(),
  multiDomains: z.array(z.enum(['tasks', 'calendar', 'meals', 'lists', 'unknown'])).optional(),
});

// ----------------------------------------------------------------------
// ROUTER
// ----------------------------------------------------------------------

/**
 * Result of multi-intent detection.
 */
export type MultiIntentResult = {
  isMultiIntent: boolean;
  domains: AgentDomain[];
  reasons: string[];
};

/**
 * Detect if a message contains multiple intents across different domains.
 * Uses LLM to analyze the request.
 */
export async function detectMultiIntent(
  message: string,
  options?: { logger?: AgentLogger; timezone?: string }
): Promise<MultiIntentResult> {
  const { logger, timezone } = options ?? {};

  // Short-circuit for very short messages
  if (message.length < 5) {
    return { isMultiIntent: false, domains: [], reasons: ['Message too short'] };
  }

  const systemPrompt = `You are an AI router for a family assistant app. 
Your goal is to classify user messages into domains:
- tasks: To-do items, reminders, chores
- calendar: Events, appointments, schedules
- meals: Recipes, meal plans, cooking
- lists: Shopping lists, groceries
- unknown: General chit-chat or unrelated topics

Analyze if the message requires actions in MULTIPLE domains (e.g., "Add milk to list AND remind me to call Mom").
Current User Timezone: ${timezone || 'UTC'}`;

  try {
    const result = await llmProvider.completeJson(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      routerResponseSchema,
      { description: 'Intent Routing' } as any
    );

    if (result.isMultiIntent && result.multiDomains && result.multiDomains.length > 1) {
      return {
        isMultiIntent: true,
        domains: result.multiDomains,
        reasons: result.reasons,
      };
    }
  } catch (err) {
    logger?.error({ err }, 'LLM Router failed, falling back to heuristic');
    // Fallback? For now, return false
  }

  return { isMultiIntent: false, domains: [], reasons: [] };
}


/**
 * Routes a user message to the appropriate agent domain.
 * Uses LLM for classification.
 */
export async function routeIntent(
  message: string,
  options?: {
    domainHint?: AgentDomain;
    logger?: AgentLogger;
    timezone?: string;
  }
): Promise<IntentRoute> {
  const { domainHint, logger, timezone } = options ?? {};

  // If a domain hint is provided and it's not 'unknown', use it with high confidence
  if (domainHint && domainHint !== 'unknown') {
    logger?.debug({ domainHint, message }, 'Using domain hint for routing');
    return {
      domain: domainHint,
      confidence: 0.95,
      reasons: [`Domain hint provided: ${domainHint}`],
    };
  }

  const systemPrompt = `You are an AI router for a family assistant app. 
Classify the user's intent into ONE primary domain:
- tasks: To-do items, reminders, chores
- calendar: Events, appointments, schedules
- meals: Recipes, meal plans, cooking
- lists: Shopping lists, groceries
- unknown: General chit-chat or unrelated topics

Current User Timezone: ${timezone || 'UTC'}`;

  try {
    const result = await llmProvider.completeJson(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      routerResponseSchema,
      { description: 'Intent Routing' } as any
    );

    return {
      domain: result.domain,
      confidence: result.confidence,
      reasons: result.reasons,
    };

  } catch (err) {
    logger?.error({ err }, 'LLM Router failed, returning unknown');
    
    return {
      domain: 'unknown',
      confidence: 0,
      reasons: ['LLM routing failed'],
    };
  }
}

