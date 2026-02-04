import type { AgentDomain, IntentRoute, AgentLogger } from './types.js';

// ----------------------------------------------------------------------
// KEYWORD PATTERNS FOR INTENT ROUTING
// ----------------------------------------------------------------------

const DOMAIN_PATTERNS: Record<Exclude<AgentDomain, 'unknown'>, RegExp[]> = {
  tasks: [
    /\b(task|tasks|todo|todos|to-do|to do)\b/i,
    /\b(remind|reminder|reminders)\b/i,
    /\b(chore|chores|assignment|assignments)\b/i,
    /\b(complete|finish|done|mark done|check off)\b/i,
    /\b(assign|assigned|assignee)\b/i,
    /\b(due|deadline|overdue)\b/i,
    /\b(priority|urgent|high priority)\b/i,
  ],
  calendar: [
    /\b(calendar|calendars|schedule|schedules)\b/i,
    /\b(event|events|appointment|appointments)\b/i,
    /\b(meeting|meetings)\b/i,
    /\b(when is|what's on|what time)\b/i,
    /\b(free time|available|availability|busy)\b/i,
    /\b(book|booking|reschedule|move|shift)\b.*\b(to|for)\b/i,
    /\b(training|practice|lesson|class)\b/i,
  ],
  meals: [
    /\b(meal|meals|dinner|lunch|breakfast)\b/i,
    /\b(recipe|recipes|cook|cooking)\b/i,
    /\b(menu|menus|meal plan|meal planning)\b/i,
    /\b(grocery|groceries|ingredients)\b/i,
    /\b(eat|eating|food|foods)\b/i,
  ],
  lists: [
    /\b(list|lists|shopping list|shopping)\b/i,
    /\b(buy|purchase|need to get)\b/i,
    /\b(add to list|remove from list)\b/i,
    /\b(check list|checklist)\b/i,
  ],
};

// Patterns that indicate multiple intents in a single message
const MULTI_INTENT_INDICATORS = [
  /\b(and also|and then|also|plus|as well as)\b/i,
  /\b(after that|then|next)\b/i,
  /[,;]\s*(also|and)\s+/i,
];

// ----------------------------------------------------------------------
// MULTI-INTENT DETECTION
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
 */
export function detectMultiIntent(
  message: string,
  options?: { logger?: AgentLogger }
): MultiIntentResult {
  const { logger } = options ?? {};

  // Check for multi-intent indicators
  const hasIndicator = MULTI_INTENT_INDICATORS.some((pattern) => pattern.test(message));

  // Score each domain
  const domainScores: Map<AgentDomain, number> = new Map();
  const reasons: string[] = [];

  for (const [domain, patterns] of Object.entries(DOMAIN_PATTERNS)) {
    let score = 0;
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        score += 1;
      }
    }
    if (score > 0) {
      domainScores.set(domain as AgentDomain, score);
      reasons.push(`${domain}: ${score} pattern matches`);
    }
  }

  // If multiple domains have significant scores and there's an indicator, it's multi-intent
  const significantDomains = Array.from(domainScores.entries())
    .filter(([_, score]) => score >= 1)
    .sort((a, b) => b[1] - a[1])
    .map(([domain]) => domain);

  const isMultiIntent = significantDomains.length >= 2 && hasIndicator;

  if (isMultiIntent) {
    logger?.debug(
      { domains: significantDomains, reasons },
      'Multi-intent detected'
    );
  }

  return {
    isMultiIntent,
    domains: significantDomains,
    reasons,
  };
}

// ----------------------------------------------------------------------
// ROUTER
// ----------------------------------------------------------------------

/**
 * Routes a user message to the appropriate agent domain.
 *
 * Uses keyword pattern matching with confidence scoring.
 * Future: Could be enhanced with ML-based intent classification.
 */
export function routeIntent(
  message: string,
  options?: {
    domainHint?: AgentDomain;
    logger?: AgentLogger;
  }
): IntentRoute {
  const { domainHint, logger } = options ?? {};

  // If a domain hint is provided and it's not 'unknown', use it with high confidence
  if (domainHint && domainHint !== 'unknown') {
    logger?.debug({ domainHint, message }, 'Using domain hint for routing');
    return {
      domain: domainHint,
      confidence: 0.95,
      reasons: [`Domain hint provided: ${domainHint}`],
    };
  }

  const scores: Record<AgentDomain, { score: number; reasons: string[] }> = {
    tasks: { score: 0, reasons: [] },
    calendar: { score: 0, reasons: [] },
    meals: { score: 0, reasons: [] },
    lists: { score: 0, reasons: [] },
    unknown: { score: 0, reasons: [] },
  };

  // Score each domain based on pattern matches
  for (const [domain, patterns] of Object.entries(DOMAIN_PATTERNS)) {
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        scores[domain as AgentDomain].score += 1;
        scores[domain as AgentDomain].reasons.push(`Matched pattern: "${match[0]}"`);
      }
    }
  }

  // Find the domain with the highest score
  let bestDomain: AgentDomain = 'unknown';
  let bestScore = 0;

  for (const [domain, { score }] of Object.entries(scores)) {
    if (domain !== 'unknown' && score > bestScore) {
      bestScore = score;
      bestDomain = domain as AgentDomain;
    }
  }

  // Calculate confidence based on score and whether there's ambiguity
  const totalMatches = Object.values(scores).reduce((sum, { score }) => sum + score, 0);
  const confidence = totalMatches > 0 ? bestScore / (totalMatches + 1) : 0;

  // If no patterns matched, mark as unknown
  if (bestScore === 0) {
    logger?.debug({ message }, 'No domain patterns matched, routing to unknown');
    return {
      domain: 'unknown',
      confidence: 0,
      reasons: ['No domain patterns matched'],
    };
  }

  const result: IntentRoute = {
    domain: bestDomain,
    confidence: Math.min(confidence + 0.3, 0.9), // Boost confidence but cap at 0.9
    reasons: scores[bestDomain].reasons,
  };

  logger?.debug(
    { domain: result.domain, confidence: result.confidence, reasons: result.reasons },
    'Intent routed'
  );

  return result;
}
