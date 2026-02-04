import { defineTool } from '../registry.js';
import type { ToolContext, ToolResult } from '../types.js';
import {
  mealsGeneratePlanInputSchema,
  mealsGeneratePlanOutputSchema,
  mealsSavePlanInputSchema,
  mealsSavePlanOutputSchema,
  mealsGetPlanInputSchema,
  mealsGetPlanOutputSchema,
  type MealsGeneratePlanInput,
  type MealsGeneratePlanOutput,
  type MealsSavePlanInput,
  type MealsSavePlanOutput,
  type MealsGetPlanInput,
  type MealsGetPlanOutput,
} from './meal-schemas.js';

// ----------------------------------------------------------------------
// MEAL TOOL HANDLER TYPE
// ----------------------------------------------------------------------

/**
 * Handler function for meal tools.
 * Injected by the API layer with Prisma access.
 */
export type MealToolHandler<TInput, TOutput> = (
  input: TInput,
  context: ToolContext
) => Promise<ToolResult<TOutput>>;

/**
 * Registry of meal tool handlers.
 * These are injected by the API layer.
 */
export const mealToolHandlers: {
  generatePlan?: MealToolHandler<MealsGeneratePlanInput, MealsGeneratePlanOutput>;
  savePlan?: MealToolHandler<MealsSavePlanInput, MealsSavePlanOutput>;
  getPlan?: MealToolHandler<MealsGetPlanInput, MealsGetPlanOutput>;
} = {};

/**
 * Register meal tool handlers (called by API layer).
 */
export function registerMealToolHandlers(handlers: {
  generatePlan: MealToolHandler<MealsGeneratePlanInput, MealsGeneratePlanOutput>;
  savePlan: MealToolHandler<MealsSavePlanInput, MealsSavePlanOutput>;
  getPlan: MealToolHandler<MealsGetPlanInput, MealsGetPlanOutput>;
}): void {
  mealToolHandlers.generatePlan = handlers.generatePlan;
  mealToolHandlers.savePlan = handlers.savePlan;
  mealToolHandlers.getPlan = handlers.getPlan;
}

// ----------------------------------------------------------------------
// TOOL DEFINITIONS
// ----------------------------------------------------------------------

/**
 * meals.generatePlan - Generate a weekly meal plan draft
 * 
 * This tool generates a meal plan based on constraints and preferences,
 * but does NOT save it. The user must confirm before calling meals.savePlan.
 */
export const mealsGeneratePlanTool = defineTool({
  name: 'meals.generatePlan',
  description:
    'Generate a weekly meal plan draft based on dietary constraints, preferences, and schedule. Returns a draft that must be confirmed before saving.',
  inputSchema: mealsGeneratePlanInputSchema,
  outputSchema: mealsGeneratePlanOutputSchema,
  execute: async (input, context) => {
    if (!mealToolHandlers.generatePlan) {
      return { success: false, error: 'Meal generatePlan handler not registered' };
    }
    return mealToolHandlers.generatePlan(input, context);
  },
});

/**
 * meals.savePlan - Save a meal plan to the family's list
 * 
 * Creates or updates a MEAL_PLAN type list with the provided meal items.
 * Items are matched by date + mealType for upsert behavior.
 */
export const mealsSavePlanTool = defineTool({
  name: 'meals.savePlan',
  description:
    'Save a meal plan to the family list. Creates a new MEAL_PLAN list or updates an existing one. Items are matched by date+mealType for upsert.',
  inputSchema: mealsSavePlanInputSchema,
  outputSchema: mealsSavePlanOutputSchema,
  execute: async (input, context) => {
    if (!mealToolHandlers.savePlan) {
      return { success: false, error: 'Meal savePlan handler not registered' };
    }
    return mealToolHandlers.savePlan(input, context);
  },
});

/**
 * meals.getPlan - Get meals for a specific week
 */
export const mealsGetPlanTool = defineTool({
  name: 'meals.getPlan',
  description: 'Get the meal plan for a specific week, either by list ID or week start date.',
  inputSchema: mealsGetPlanInputSchema,
  outputSchema: mealsGetPlanOutputSchema,
  execute: async (input, context) => {
    if (!mealToolHandlers.getPlan) {
      return { success: false, error: 'Meal getPlan handler not registered' };
    }
    return mealToolHandlers.getPlan(input, context);
  },
});
