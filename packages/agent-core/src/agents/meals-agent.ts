import type { AgentRunContext, AgentAction, ToolResult, ToolCall, PendingActionInfo } from '../types.js';
import { parseDateRange } from '../utils/date-parser.js';
import {
  pendingActionStore,
  isWriteTool,
  CONFIDENCE_THRESHOLD,
} from '../confirmation.js';

// ----------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------

export type MealsAgentResult = {
  text: string;
  actions: AgentAction[];
  payload?: Record<string, unknown>;
  /** If true, response requires user confirmation */
  requiresConfirmation?: boolean;
  /** Details about pending action */
  pendingAction?: PendingActionInfo;
};

/**
 * Parsed meal planning intent from user message.
 */
type MealsIntent =
  | {
      type: 'generatePlan';
      weekStartDate: string | null;
      constraints?: {
        lowCarb?: boolean;
        kidFriendly?: boolean;
        vegetarian?: boolean;
        allergies?: string[];
      };
      needsClarification: 'date' | null;
      confidence: number;
    }
  | {
      type: 'savePlan';
      weekStartDate: string;
      items: Array<{
        date: string;
        mealType: string;
        title: string;
        servings?: number;
        notes?: string;
      }>;
      confidence: number;
    }
  | {
      type: 'getPlan';
      weekStartDate: string | null;
      confidence: number;
    }
  | {
      type: 'addShopping';
      items: Array<{
        name: string;
        qty?: string;
        unit?: string;
        category?: string;
      }>;
      confidence: number;
    }
  | {
      type: 'getShopping';
      confidence: number;
    }
  | { type: 'unclear'; confidence: number };

/**
 * Tool executor function injected by the API layer.
 */
export type ToolExecutor = (
  toolName: string,
  input: Record<string, unknown>
) => Promise<ToolResult>;

/**
 * Loaded preferences for the meals agent.
 */
type MealsPreferences = {
  allergies?: string[];
  dietaryRestrictions?: string[];
  defaultServings?: number;
  kidFriendlyDefault?: boolean;
  preferredDinnerTime?: string;
  weekStartsMonday?: boolean;
  dislikedIngredients?: string[];
  budgetLevel?: 'budget' | 'moderate' | 'premium';
  preferQuickMeals?: boolean;
};

// Preference keys for meals domain
const MEALS_PREF_KEYS = {
  ALLERGIES: 'meals.allergies',
  DIETARY_RESTRICTIONS: 'meals.dietaryRestrictions',
  DEFAULT_SERVINGS: 'meals.defaultServings',
  KID_FRIENDLY_DEFAULT: 'meals.kidFriendlyDefault',
  PREFERRED_DINNER_TIME: 'meals.preferredDinnerTime',
  WEEK_STARTS_MONDAY: 'meals.weekStartsMonday',
  DISLIKED_INGREDIENTS: 'meals.dislikedIngredients',
  BUDGET_LEVEL: 'meals.budgetLevel',
  PREFER_QUICK_MEALS: 'meals.preferQuickMeals',
};

// ----------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------

/**
 * Load meals-related preferences using the prefs.getBulk tool.
 */
async function loadMealsPreferences(
  toolExecutor: ToolExecutor
): Promise<MealsPreferences> {
  const prefs: MealsPreferences = {};

  try {
    const result = await toolExecutor('prefs.getBulk', {
      requests: [
        { scope: 'family', key: MEALS_PREF_KEYS.ALLERGIES },
        { scope: 'family', key: MEALS_PREF_KEYS.DIETARY_RESTRICTIONS },
        { scope: 'family', key: MEALS_PREF_KEYS.DEFAULT_SERVINGS },
        { scope: 'family', key: MEALS_PREF_KEYS.KID_FRIENDLY_DEFAULT },
        { scope: 'family', key: MEALS_PREF_KEYS.PREFERRED_DINNER_TIME },
        { scope: 'family', key: MEALS_PREF_KEYS.WEEK_STARTS_MONDAY },
        { scope: 'family', key: MEALS_PREF_KEYS.DISLIKED_INGREDIENTS },
        { scope: 'family', key: MEALS_PREF_KEYS.BUDGET_LEVEL },
        { scope: 'family', key: MEALS_PREF_KEYS.PREFER_QUICK_MEALS },
      ],
    });

    if (result.success && result.data) {
      const data = result.data as { results: Record<string, unknown> };
      const r = data.results;

      if (Array.isArray(r[MEALS_PREF_KEYS.ALLERGIES])) {
        prefs.allergies = r[MEALS_PREF_KEYS.ALLERGIES] as string[];
      }
      if (Array.isArray(r[MEALS_PREF_KEYS.DIETARY_RESTRICTIONS])) {
        prefs.dietaryRestrictions = r[MEALS_PREF_KEYS.DIETARY_RESTRICTIONS] as string[];
      }
      if (typeof r[MEALS_PREF_KEYS.DEFAULT_SERVINGS] === 'number') {
        prefs.defaultServings = r[MEALS_PREF_KEYS.DEFAULT_SERVINGS] as number;
      }
      if (typeof r[MEALS_PREF_KEYS.KID_FRIENDLY_DEFAULT] === 'boolean') {
        prefs.kidFriendlyDefault = r[MEALS_PREF_KEYS.KID_FRIENDLY_DEFAULT] as boolean;
      }
      if (typeof r[MEALS_PREF_KEYS.PREFERRED_DINNER_TIME] === 'string') {
        prefs.preferredDinnerTime = r[MEALS_PREF_KEYS.PREFERRED_DINNER_TIME] as string;
      }
      if (typeof r[MEALS_PREF_KEYS.WEEK_STARTS_MONDAY] === 'boolean') {
        prefs.weekStartsMonday = r[MEALS_PREF_KEYS.WEEK_STARTS_MONDAY] as boolean;
      }
      if (Array.isArray(r[MEALS_PREF_KEYS.DISLIKED_INGREDIENTS])) {
        prefs.dislikedIngredients = r[MEALS_PREF_KEYS.DISLIKED_INGREDIENTS] as string[];
      }
      if (typeof r[MEALS_PREF_KEYS.BUDGET_LEVEL] === 'string') {
        prefs.budgetLevel = r[MEALS_PREF_KEYS.BUDGET_LEVEL] as 'budget' | 'moderate' | 'premium';
      }
      if (typeof r[MEALS_PREF_KEYS.PREFER_QUICK_MEALS] === 'boolean') {
        prefs.preferQuickMeals = r[MEALS_PREF_KEYS.PREFER_QUICK_MEALS] as boolean;
      }
    }
  } catch (err) {
    // Preferences are optional, continue without them
  }

  return prefs;
}

/**
 * Get the Monday of the current or specified week.
 */
function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

/**
 * Get the Monday of next week.
 */
function getNextWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  d.setDate(d.getDate() + 7);
  return getWeekStart(d);
}

/**
 * Detect if we should infer "this week" or "next week".
 * If it's Thursday or later, might be ambiguous.
 */
function isNearWeekBoundary(date: Date = new Date()): boolean {
  const day = date.getDay();
  return day >= 4 || day === 0; // Thursday, Friday, Saturday, Sunday
}

/**
 * Parse week reference from message.
 */
function parseWeekReference(message: string, now: Date = new Date()): { weekStart: string | null; needsClarification: boolean } {
  const lower = message.toLowerCase();

  // Explicit date (YYYY-MM-DD)
  const dateMatch = message.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (dateMatch) {
    return { weekStart: dateMatch[1], needsClarification: false };
  }

  // "next week"
  if (/\bnext\s+week\b/.test(lower)) {
    return { weekStart: getNextWeekStart(now), needsClarification: false };
  }

  // "this week"
  if (/\bthis\s+week\b/.test(lower)) {
    return { weekStart: getWeekStart(now), needsClarification: false };
  }

  // "the week of <date>"
  const weekOfMatch = lower.match(/week\s+of\s+(.+?)(?:\s|$)/);
  if (weekOfMatch) {
    const dateRange = parseDateRange(weekOfMatch[1], now);
    if (dateRange.from) {
      return { weekStart: getWeekStart(new Date(dateRange.from)), needsClarification: false };
    }
  }

  // No explicit week reference - check if near boundary
  if (isNearWeekBoundary(now)) {
    return { weekStart: null, needsClarification: true };
  }

  // Default to this week
  return { weekStart: getWeekStart(now), needsClarification: false };
}

/**
 * Constraints extracted from user message.
 */
type ExtractedConstraints = {
  lowCarb?: boolean;
  kidFriendly?: boolean;
  vegetarian?: boolean;
  allergies?: string[];
};

/**
 * Extract dietary constraints from message.
 */
function extractConstraints(message: string): ExtractedConstraints | undefined {
  const lower = message.toLowerCase();
  const constraints: {
    lowCarb?: boolean;
    kidFriendly?: boolean;
    vegetarian?: boolean;
    allergies?: string[];
  } = {};

  if (/\blow[\s-]?carb\b/.test(lower)) {
    constraints.lowCarb = true;
  }

  if (/\bkid[\s-]?friendly\b|\bfor\s+(the\s+)?kids?\b|\bchildren\b/.test(lower)) {
    constraints.kidFriendly = true;
  }

  if (/\bvegetarian\b|\bveggie\b|\bno\s+meat\b/.test(lower)) {
    constraints.vegetarian = true;
  }

  // Common allergies
  const allergies: string[] = [];
  if (/\bgluten[\s-]?free\b|\bno\s+gluten\b|\bceliac\b/.test(lower)) {
    allergies.push('gluten');
  }
  if (/\bdairy[\s-]?free\b|\bno\s+dairy\b|\blactose\b/.test(lower)) {
    allergies.push('dairy');
  }
  if (/\bnut[\s-]?free\b|\bno\s+nuts?\b|\bnut\s+allergy\b/.test(lower)) {
    allergies.push('nuts');
  }
  if (allergies.length > 0) {
    constraints.allergies = allergies;
  }

  return Object.keys(constraints).length > 0 ? constraints : undefined;
}

/**
 * Parse shopping items from message.
 */
function parseShoppingItems(message: string): Array<{ name: string; qty?: string; unit?: string; category?: string }> {
  const items: Array<{ name: string; qty?: string; unit?: string; category?: string }> = [];

  // Try to extract items from common patterns
  // "add eggs, milk, and bread to shopping"
  // "add 2 dozen eggs, 1L milk"
  
  // Split by common separators
  const itemParts = message
    .replace(/add|to\s+(?:the\s+)?(?:shopping\s+)?list|shopping|buy|get|need/gi, '')
    .split(/[,;]|\band\b/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const part of itemParts) {
    // Try to extract quantity
    const qtyMatch = part.match(/^(\d+(?:\.\d+)?)\s*(\w+)?\s+(.+)$/);
    if (qtyMatch) {
      items.push({
        name: qtyMatch[3].trim(),
        qty: qtyMatch[1],
        unit: qtyMatch[2],
      });
    } else {
      items.push({ name: part });
    }
  }

  return items;
}

// ----------------------------------------------------------------------
// INTENT PARSING
// ----------------------------------------------------------------------

/**
 * Parse user message into a structured meals intent.
 */
function parseMealsIntent(message: string, context: AgentRunContext): MealsIntent {
  const lower = message.toLowerCase();

  // GENERATE PLAN patterns
  const generatePatterns: Array<{ pattern: RegExp; confidence: number }> = [
    { pattern: /^(?:generate|create|make|plan)\s+(?:a\s+)?(?:weekly\s+)?meal\s+plan/i, confidence: 0.95 },
    { pattern: /^(?:what|suggest)\s+(?:should\s+(?:we|i)\s+)?(?:cook|eat|make|have)\s+(?:this|next)\s+week/i, confidence: 0.90 },
    { pattern: /\bmeal\s+plan\s+for\s+(?:this|next)\s+week\b/i, confidence: 0.90 },
    { pattern: /\bplan\s+(?:our|the|my)\s+(?:weekly\s+)?meals?\b/i, confidence: 0.85 },
    { pattern: /\bwhat's\s+for\s+(?:dinner|lunch|breakfast)\s+this\s+week\b/i, confidence: 0.80 },
  ];

  for (const { pattern, confidence } of generatePatterns) {
    if (pattern.test(message)) {
      const weekRef = parseWeekReference(message, new Date());
      const constraints = extractConstraints(message);
      
      return {
        type: 'generatePlan',
        weekStartDate: weekRef.weekStart,
        constraints,
        needsClarification: weekRef.needsClarification ? 'date' : null,
        confidence: weekRef.needsClarification ? confidence * 0.7 : confidence,
      };
    }
  }

  // GET PLAN patterns (view existing)
  const getPlanPatterns: Array<{ pattern: RegExp; confidence: number }> = [
    { pattern: /^(?:show|get|what's|display)\s+(?:the\s+)?(?:current\s+)?meal\s+plan/i, confidence: 0.95 },
    { pattern: /\bwhat(?:'s| is)\s+(?:on\s+)?(?:the\s+)?menu\b/i, confidence: 0.85 },
    { pattern: /\bwhat\s+are\s+we\s+(?:having|eating)\b/i, confidence: 0.80 },
  ];

  for (const { pattern, confidence } of getPlanPatterns) {
    if (pattern.test(message)) {
      const weekRef = parseWeekReference(message, new Date());
      return {
        type: 'getPlan',
        weekStartDate: weekRef.weekStart,
        confidence,
      };
    }
  }

  // ADD SHOPPING patterns
  const addShoppingPatterns: Array<{ pattern: RegExp; confidence: number }> = [
    { pattern: /^add\s+(.+?)\s+to\s+(?:the\s+)?(?:shopping\s+)?list/i, confidence: 0.95 },
    { pattern: /^(?:buy|get|need)\s+(.+?)(?:\s+from\s+the\s+(?:store|supermarket))?$/i, confidence: 0.80 },
    { pattern: /\badd\s+to\s+(?:shopping|grocery)\s+list[:\s]+(.+)/i, confidence: 0.90 },
    { pattern: /\bshopping\s+list[:\s]+add\s+(.+)/i, confidence: 0.90 },
  ];

  for (const { pattern, confidence } of addShoppingPatterns) {
    const match = message.match(pattern);
    if (match) {
      const items = parseShoppingItems(match[1] || message);
      if (items.length > 0) {
        return {
          type: 'addShopping',
          items,
          confidence,
        };
      }
    }
  }

  // GET SHOPPING patterns
  const getShoppingPatterns: Array<{ pattern: RegExp; confidence: number }> = [
    { pattern: /^(?:show|get|what's on|display)\s+(?:the\s+)?(?:shopping|grocery)\s+list/i, confidence: 0.95 },
    { pattern: /\bwhat\s+do\s+(?:we|i)\s+need\s+to\s+buy\b/i, confidence: 0.85 },
    { pattern: /\bwhat's\s+on\s+(?:the\s+)?(?:shopping|grocery)\s+list\b/i, confidence: 0.90 },
  ];

  for (const { pattern, confidence } of getShoppingPatterns) {
    if (pattern.test(message)) {
      return {
        type: 'getShopping',
        confidence,
      };
    }
  }

  // General meal-related keywords with implicit generate intent
  if (/\bmeal\b|\bdinner\b|\blunch\b|\bbreakfast\b|\bcook\b|\brecipe\b/i.test(lower)) {
    // If it's a question or suggestion request
    if (/\?$|\bwhat\b|\bsuggest\b|\bplan\b|\bhelp\b/i.test(lower)) {
      const weekRef = parseWeekReference(message, new Date());
      return {
        type: 'generatePlan',
        weekStartDate: weekRef.weekStart,
        constraints: extractConstraints(message),
        needsClarification: weekRef.needsClarification ? 'date' : null,
        confidence: 0.65,
      };
    }
  }

  // Shopping-related keywords
  if (/\bshopping\b|\bgrocery\b|\bgroceries\b|\bbuy\b|\bstore\b/i.test(lower)) {
    return {
      type: 'getShopping',
      confidence: 0.60,
    };
  }

  return { type: 'unclear', confidence: 0.0 };
}

// ----------------------------------------------------------------------
// AGENT EXECUTION
// ----------------------------------------------------------------------

/**
 * Execute the meals agent with the given message and context.
 */
export async function executeMealsAgent(
  message: string,
  context: AgentRunContext,
  toolExecutor: ToolExecutor
): Promise<MealsAgentResult> {
  const intent = parseMealsIntent(message, context);

  context.logger.info(
    { intent, requestId: context.requestId },
    'MealsAgent parsed intent'
  );

  // Handle unclear intent
  if (intent.type === 'unclear') {
    return {
      text: "I can help with meal planning and shopping lists. Try asking me to:\n• Generate a meal plan for this week\n• Show what's on the menu\n• Add items to the shopping list\n• Show the shopping list",
      actions: [],
      payload: { intent: 'unclear' },
    };
  }

  // Handle date clarification
  if (intent.type === 'generatePlan' && intent.needsClarification === 'date') {
    return {
      text: "Would you like me to plan meals for **this week** or **next week**? (It's currently near the weekend, so I want to make sure I plan the right week.)",
      actions: [],
      payload: {
        intent: 'generatePlan',
        awaitingClarification: 'date',
        options: ['this week', 'next week'],
      },
    };
  }

  // Route to specific intent handlers
  switch (intent.type) {
    case 'generatePlan':
      return handleGeneratePlan(intent, context, toolExecutor);
    case 'getPlan':
      return handleGetPlan(intent, context, toolExecutor);
    case 'addShopping':
      return handleAddShopping(intent, context, toolExecutor);
    case 'getShopping':
      return handleGetShopping(context, toolExecutor);
    default:
      return {
        text: "I'm not sure what you'd like me to do. Could you rephrase your request?",
        actions: [],
      };
  }
}

// ----------------------------------------------------------------------
// INTENT HANDLERS
// ----------------------------------------------------------------------

/**
 * Merge message-extracted constraints with stored preferences.
 * Message constraints take precedence over stored prefs.
 */
function mergeConstraintsWithPreferences(
  messageConstraints: ExtractedConstraints | undefined,
  prefs: MealsPreferences
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};

  // Start with stored preferences
  if (prefs.allergies && prefs.allergies.length > 0) {
    merged.allergies = prefs.allergies;
  }
  if (prefs.dietaryRestrictions && prefs.dietaryRestrictions.length > 0) {
    merged.dietaryRestrictions = prefs.dietaryRestrictions;
  }
  if (prefs.kidFriendlyDefault) {
    merged.kidFriendly = true;
  }
  if (prefs.dislikedIngredients && prefs.dislikedIngredients.length > 0) {
    merged.dislikedIngredients = prefs.dislikedIngredients;
  }
  if (prefs.budgetLevel) {
    merged.budgetLevel = prefs.budgetLevel;
  }
  if (prefs.preferQuickMeals) {
    merged.preferQuickMeals = true;
  }
  if (prefs.defaultServings) {
    merged.servings = prefs.defaultServings;
  }

  // Override with message constraints (explicit request takes priority)
  if (messageConstraints) {
    if (messageConstraints.lowCarb !== undefined) {
      merged.lowCarb = messageConstraints.lowCarb;
    }
    if (messageConstraints.kidFriendly !== undefined) {
      merged.kidFriendly = messageConstraints.kidFriendly;
    }
    if (messageConstraints.vegetarian !== undefined) {
      merged.vegetarian = messageConstraints.vegetarian;
    }
    if (messageConstraints.allergies && messageConstraints.allergies.length > 0) {
      // Merge allergies from message with stored allergies
      const existingAllergies = (merged.allergies as string[]) || [];
      merged.allergies = [...new Set([...existingAllergies, ...messageConstraints.allergies])];
    }
  }

  return Object.keys(merged).length > 0 ? merged : {};
}

async function handleGeneratePlan(
  intent: Extract<MealsIntent, { type: 'generatePlan' }>,
  context: AgentRunContext,
  toolExecutor: ToolExecutor
): Promise<MealsAgentResult> {
  const weekStartDate = intent.weekStartDate || getWeekStart();

  // Load preferences to merge with message constraints
  const prefs = await loadMealsPreferences(toolExecutor);
  const mergedConstraints = mergeConstraintsWithPreferences(intent.constraints, prefs);

  context.logger.debug(
    { prefs, mergedConstraints, requestId: context.requestId },
    'MealsAgent loaded preferences and merged constraints'
  );

  const toolInput = {
    weekStartDate,
    constraints: Object.keys(mergedConstraints).length > 0 ? mergedConstraints : undefined,
    preferences: {
      defaultServings: prefs.defaultServings,
      weekStartsMonday: prefs.weekStartsMonday,
      preferredDinnerTime: prefs.preferredDinnerTime,
    },
  };

  // Generate plan is read-only, no confirmation needed
  const result = await toolExecutor('meals.generatePlan', toolInput);

  const action: AgentAction = {
    tool: 'meals.generatePlan',
    input: toolInput,
    result,
  };

  if (!result.success) {
    return {
      text: `Sorry, I couldn't generate a meal plan: ${result.error}`,
      actions: [action],
    };
  }

  const data = result.data as {
    mealPlanDraft: {
      weekStartDate: string;
      items: Array<{ date: string; mealType: string; title: string }>;
    };
    shoppingDelta: Array<{ name: string; qty?: string; unit?: string }>;
  };

  // Format the meal plan for display
  const mealsByDay = new Map<string, string[]>();
  for (const item of data.mealPlanDraft.items) {
    const day = new Date(item.date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
    const meals = mealsByDay.get(day) || [];
    meals.push(`  • **${capitalize(item.mealType)}:** ${item.title}`);
    mealsByDay.set(day, meals);
  }

  let planText = '📅 **Meal Plan Draft**\n\n';
  for (const [day, meals] of mealsByDay) {
    planText += `**${day}**\n${meals.join('\n')}\n\n`;
  }

  planText += '\n🛒 **Shopping List Preview**\n';
  for (const item of data.shoppingDelta.slice(0, 8)) {
    const qty = item.qty && item.unit ? `${item.qty} ${item.unit}` : item.qty || '';
    planText += `• ${item.name}${qty ? ` (${qty})` : ''}\n`;
  }
  if (data.shoppingDelta.length > 8) {
    planText += `• ...and ${data.shoppingDelta.length - 8} more items\n`;
  }

  // Create pending action for saving
  const saveToolCall: ToolCall = {
    toolName: 'meals.savePlan',
    input: {
      weekStartDate,
      items: data.mealPlanDraft.items,
    },
  };

  const pendingAction = pendingActionStore.create({
    userId: context.userId,
    familyId: context.familyId,
    requestId: context.requestId,
    conversationId: context.conversationId,
    toolCall: saveToolCall,
    description: `Save meal plan for week of ${weekStartDate}`,
    isDestructive: false,
  });

  planText += '\n---\n**Would you like me to save this meal plan and add the shopping items to your list?**\nReply "yes" to confirm, or "no" to cancel.';

  return {
    text: planText,
    actions: [action],
    payload: {
      intent: 'generatePlan',
      draft: data.mealPlanDraft,
      shoppingDelta: data.shoppingDelta,
    },
    requiresConfirmation: true,
    pendingAction: {
      token: pendingAction.token,
      description: pendingAction.description,
      toolName: saveToolCall.toolName,
      inputPreview: {
        weekStartDate,
        itemCount: data.mealPlanDraft.items.length,
        shoppingItemCount: data.shoppingDelta.length,
      },
      expiresAt: new Date(pendingAction.createdAt.getTime() + pendingAction.ttlMs).toISOString(),
      isDestructive: false,
    },
  };
}

async function handleGetPlan(
  intent: Extract<MealsIntent, { type: 'getPlan' }>,
  context: AgentRunContext,
  toolExecutor: ToolExecutor
): Promise<MealsAgentResult> {
  const weekStartDate = intent.weekStartDate || getWeekStart();

  const toolInput = { weekStartDate };
  const result = await toolExecutor('meals.getPlan', toolInput);

  const action: AgentAction = {
    tool: 'meals.getPlan',
    input: toolInput,
    result,
  };

  if (!result.success) {
    return {
      text: `Sorry, I couldn't retrieve the meal plan: ${result.error}`,
      actions: [action],
    };
  }

  const data = result.data as {
    list: { id: string; name: string } | null;
    items: Array<{ date: string; mealType: string; title: string }>;
  };

  if (!data.list || data.items.length === 0) {
    return {
      text: `📅 No meal plan found for the week of ${weekStartDate}.\n\nWould you like me to generate one? Just say "generate a meal plan for this week".`,
      actions: [action],
    };
  }

  // Format the existing plan
  const mealsByDay = new Map<string, string[]>();
  for (const item of data.items) {
    const day = new Date(item.date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
    const meals = mealsByDay.get(day) || [];
    meals.push(`  • **${capitalize(item.mealType)}:** ${item.title}`);
    mealsByDay.set(day, meals);
  }

  let planText = `📅 **${data.list.name}**\n\n`;
  for (const [day, meals] of mealsByDay) {
    planText += `**${day}**\n${meals.join('\n')}\n\n`;
  }

  return {
    text: planText,
    actions: [action],
    payload: {
      intent: 'getPlan',
      list: data.list,
      items: data.items,
    },
  };
}

async function handleAddShopping(
  intent: Extract<MealsIntent, { type: 'addShopping' }>,
  context: AgentRunContext,
  toolExecutor: ToolExecutor
): Promise<MealsAgentResult> {
  // Check if we need confirmation for write operation
  const shouldConfirm = intent.confidence < CONFIDENCE_THRESHOLD;

  if (shouldConfirm) {
    const saveToolCall: ToolCall = {
      toolName: 'shopping.addItems',
      input: { items: intent.items },
    };

    const pendingAction = pendingActionStore.create({
      userId: context.userId,
      familyId: context.familyId,
      requestId: context.requestId,
      conversationId: context.conversationId,
      toolCall: saveToolCall,
      description: `Add ${intent.items.length} item(s) to shopping list`,
      isDestructive: false,
    });

    const itemList = intent.items.map((i) => `• ${i.name}`).join('\n');

    return {
      text: `I'll add these items to your shopping list:\n${itemList}\n\nPlease confirm to proceed, or say "cancel" to abort.`,
      actions: [],
      payload: { intent: 'addShopping', items: intent.items },
      requiresConfirmation: true,
      pendingAction: {
        token: pendingAction.token,
        description: pendingAction.description,
        toolName: saveToolCall.toolName,
        inputPreview: { itemCount: intent.items.length },
        expiresAt: new Date(pendingAction.createdAt.getTime() + pendingAction.ttlMs).toISOString(),
        isDestructive: false,
      },
    };
  }

  // Execute directly if high confidence
  const toolInput = { items: intent.items };
  const result = await toolExecutor('shopping.addItems', toolInput);

  const action: AgentAction = {
    tool: 'shopping.addItems',
    input: toolInput,
    result,
  };

  if (!result.success) {
    return {
      text: `Sorry, I couldn't add items to the shopping list: ${result.error}`,
      actions: [action],
    };
  }

  const data = result.data as {
    addedCount: number;
    items: Array<{ name: string }>;
  };

  const itemList = data.items.map((i) => `• ${i.name}`).join('\n');

  return {
    text: `✅ Added ${data.addedCount} item(s) to your shopping list:\n${itemList}`,
    actions: [action],
    payload: { intent: 'addShopping', addedItems: data.items },
  };
}

async function handleGetShopping(
  context: AgentRunContext,
  toolExecutor: ToolExecutor
): Promise<MealsAgentResult> {
  const result = await toolExecutor('shopping.getItems', { limit: 50 });

  const action: AgentAction = {
    tool: 'shopping.getItems',
    input: { limit: 50 },
    result,
  };

  if (!result.success) {
    return {
      text: `Sorry, I couldn't retrieve the shopping list: ${result.error}`,
      actions: [action],
    };
  }

  const data = result.data as {
    list: { id: string; name: string };
    items: Array<{ name: string; qty?: string; unit?: string; category?: string; checked: boolean }>;
    total: number;
  };

  if (data.items.length === 0) {
    return {
      text: `🛒 Your shopping list is empty.\n\nTo add items, say something like "add eggs and milk to the shopping list".`,
      actions: [action],
    };
  }

  // Group by category
  const byCategory = new Map<string, typeof data.items>();
  for (const item of data.items) {
    const cat = item.category || 'other';
    const items = byCategory.get(cat) || [];
    items.push(item);
    byCategory.set(cat, items);
  }

  let listText = `🛒 **${data.list.name}** (${data.total} items)\n\n`;

  for (const [category, items] of byCategory) {
    listText += `**${capitalize(category)}**\n`;
    for (const item of items) {
      const checkmark = item.checked ? '✅' : '⬜';
      const qty = item.qty && item.unit ? ` (${item.qty} ${item.unit})` : item.qty ? ` (${item.qty})` : '';
      listText += `${checkmark} ${item.name}${qty}\n`;
    }
    listText += '\n';
  }

  return {
    text: listText,
    actions: [action],
    payload: {
      intent: 'getShopping',
      list: data.list,
      items: data.items,
    },
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ----------------------------------------------------------------------
// CONFIRMATION HANDLER
// ----------------------------------------------------------------------

/**
 * Execute a confirmed meals action.
 */
export async function executeMealsConfirmedAction(
  token: string,
  context: AgentRunContext,
  toolExecutor: ToolExecutor
): Promise<MealsAgentResult> {
  const pendingResult = pendingActionStore.get(token, context.userId, context.familyId);

  if (!pendingResult.found) {
    // Log the actual reason for debugging, but return generic message to client
    // to prevent token enumeration attacks
    context.logger.warn(
      { token, reason: pendingResult.reason },
      'MealsAgent: confirmation validation failed'
    );

    return {
      text: '❌ This confirmation is invalid or has expired. Please try your request again.',
      actions: [],
      payload: { error: 'invalid_confirmation' },
    };
  }

  const { action: pendingAction } = pendingResult;
  const { toolCall } = pendingAction;

  // Consume the pending action
  pendingActionStore.consume(token, context.userId, context.familyId);

  context.logger.info(
    {
      token,
      toolName: toolCall.toolName,
      requestId: context.requestId,
    },
    'MealsAgent executing confirmed action'
  );

  // Execute the tool
  const result = await toolExecutor(toolCall.toolName, toolCall.input);

  const agentAction: AgentAction = {
    tool: toolCall.toolName,
    input: toolCall.input,
    result,
  };

  if (!result.success) {
    return {
      text: `Sorry, the operation failed: ${result.error}`,
      actions: [agentAction],
    };
  }

  // Handle different tool results
  if (toolCall.toolName === 'meals.savePlan') {
    const data = result.data as {
      list: { id: string; name: string };
      createdItemsCount: number;
      updatedItemsCount: number;
    };

    // Also add shopping items if available
    const input = toolCall.input as { weekStartDate: string; items: unknown[] };
    
    return {
      text: `✅ **Meal plan saved!**\n\n• **List:** ${data.list.name}\n• **Meals created:** ${data.createdItemsCount}\n• **Meals updated:** ${data.updatedItemsCount}\n\nYour meal plan for the week of ${input.weekStartDate} is now ready!`,
      actions: [agentAction],
      payload: {
        confirmed: true,
        list: data.list,
        createdCount: data.createdItemsCount,
        updatedCount: data.updatedItemsCount,
      },
    };
  }

  if (toolCall.toolName === 'shopping.addItems') {
    const data = result.data as {
      addedCount: number;
      items: Array<{ name: string }>;
    };

    const itemList = data.items.map((i) => `• ${i.name}`).join('\n');

    return {
      text: `✅ Added ${data.addedCount} item(s) to your shopping list:\n${itemList}`,
      actions: [agentAction],
      payload: {
        confirmed: true,
        addedItems: data.items,
      },
    };
  }

  // Generic success
  return {
    text: '✅ Done!',
    actions: [agentAction],
  };
}
