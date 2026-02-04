import { z } from 'zod';

// ----------------------------------------------------------------------
// MEAL TYPES
// ----------------------------------------------------------------------

/**
 * Meal type enum - matches the standard meal slots
 */
export const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export type MealType = z.infer<typeof mealTypeSchema>;

/**
 * Date string in YYYY-MM-DD format (local date, no timezone)
 */
export const localDateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Must be YYYY-MM-DD format'
);

// ----------------------------------------------------------------------
// MEAL ITEM SCHEMA
// ----------------------------------------------------------------------

/**
 * A single meal item in a meal plan.
 * Stored in ListItem.fields as JSON.
 */
export const mealItemFieldsSchema = z.object({
  /** Local date string (YYYY-MM-DD) */
  date: localDateSchema,
  /** Type of meal */
  mealType: mealTypeSchema,
  /** Number of servings */
  servings: z.number().int().min(1).max(50).optional(),
  /** Recipe notes or instructions */
  notes: z.string().max(2000).optional(),
  /** External recipe reference (URL or ID) */
  recipeRef: z.string().max(500).optional(),
});

export type MealItemFields = z.infer<typeof mealItemFieldsSchema>;

/**
 * Output representation of a meal item.
 */
export const mealItemOutputSchema = z.object({
  id: z.string(),
  date: localDateSchema,
  mealType: mealTypeSchema,
  title: z.string(),
  servings: z.number().optional(),
  notes: z.string().optional(),
  recipeRef: z.string().optional(),
});

export type MealItemOutput = z.infer<typeof mealItemOutputSchema>;

// ----------------------------------------------------------------------
// CONSTRAINTS & PREFERENCES
// ----------------------------------------------------------------------

/**
 * Constraints for meal plan generation.
 */
export const mealConstraintsSchema = z.object({
  /** Prefer low-carb meals */
  lowCarb: z.boolean().optional(),
  /** Prefer kid-friendly meals */
  kidFriendly: z.boolean().optional(),
  /** Allergies/intolerances to avoid */
  allergies: z.array(z.string()).optional(),
  /** Vegetarian meals only */
  vegetarian: z.boolean().optional(),
  /** Maximum prep + cook time in minutes */
  maxTotalTime: z.number().int().min(10).max(300).optional(),
}).optional();

export type MealConstraints = z.infer<typeof mealConstraintsSchema>;

/**
 * Schedule hint from calendar (e.g., busy times).
 */
export const scheduleHintSchema = z.object({
  /** Event start time (ISO datetime) */
  startAt: z.string().datetime(),
  /** Event end time (ISO datetime) */
  endAt: z.string().datetime(),
  /** Event title for context */
  title: z.string(),
});

export type ScheduleHint = z.infer<typeof scheduleHintSchema>;

// ----------------------------------------------------------------------
// MEALS.GENERATE_PLAN
// ----------------------------------------------------------------------

export const mealsGeneratePlanInputSchema = z.object({
  /** Start date of the week (Monday) in YYYY-MM-DD format */
  weekStartDate: localDateSchema,
  /** Dietary constraints and preferences */
  constraints: mealConstraintsSchema.optional(),
  /** Additional preferences (flexible object for future expansion) */
  preferences: z.record(z.unknown()).optional(),
  /** Calendar schedule hints to avoid meal prep during busy times */
  scheduleHints: z.array(scheduleHintSchema).optional(),
});

export type MealsGeneratePlanInput = z.infer<typeof mealsGeneratePlanInputSchema>;

/**
 * A draft meal item (not yet saved).
 */
export const mealPlanDraftItemSchema = z.object({
  date: localDateSchema,
  mealType: mealTypeSchema,
  title: z.string(),
  servings: z.number().int().optional(),
  notes: z.string().optional(),
  recipeRef: z.string().optional(),
});

export type MealPlanDraftItem = z.infer<typeof mealPlanDraftItemSchema>;

/**
 * A shopping delta item (ingredient to add).
 */
export const shoppingDeltaItemSchema = z.object({
  name: z.string(),
  qty: z.string().optional(),
  unit: z.string().optional(),
  category: z.string().optional(),
});

export type ShoppingDeltaItem = z.infer<typeof shoppingDeltaItemSchema>;

export const mealsGeneratePlanOutputSchema = z.object({
  /** The generated meal plan draft */
  mealPlanDraft: z.object({
    weekStartDate: localDateSchema,
    items: z.array(mealPlanDraftItemSchema),
  }),
  /** Shopping items that would be needed */
  shoppingDelta: z.array(shoppingDeltaItemSchema),
});

export type MealsGeneratePlanOutput = z.infer<typeof mealsGeneratePlanOutputSchema>;

// ----------------------------------------------------------------------
// MEALS.SAVE_PLAN
// ----------------------------------------------------------------------

export const mealsSavePlanInputSchema = z.object({
  /** Family ID (optional, will use context if omitted) */
  familyId: z.string().optional(),
  /** Existing list ID to update (optional, creates new if omitted) */
  listId: z.string().optional(),
  /** Start date of the week in YYYY-MM-DD format */
  weekStartDate: localDateSchema,
  /** Meal items to save */
  items: z.array(mealPlanDraftItemSchema).min(1, 'At least one meal item is required'),
});

export type MealsSavePlanInput = z.infer<typeof mealsSavePlanInputSchema>;

/**
 * Minimal list info returned after save.
 */
export const listInfoSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
});

export type ListInfo = z.infer<typeof listInfoSchema>;

export const mealsSavePlanOutputSchema = z.object({
  /** The saved/updated list */
  list: listInfoSchema,
  /** Number of items created */
  createdItemsCount: z.number().int(),
  /** Number of items updated */
  updatedItemsCount: z.number().int(),
});

export type MealsSavePlanOutput = z.infer<typeof mealsSavePlanOutputSchema>;

// ----------------------------------------------------------------------
// MEALS.GET_PLAN
// ----------------------------------------------------------------------

export const mealsGetPlanInputSchema = z.object({
  /** List ID of the meal plan */
  listId: z.string().optional(),
  /** Week start date (YYYY-MM-DD) - used to find plan if listId not provided */
  weekStartDate: localDateSchema.optional(),
});

export type MealsGetPlanInput = z.infer<typeof mealsGetPlanInputSchema>;

export const mealsGetPlanOutputSchema = z.object({
  /** The list info */
  list: listInfoSchema.nullable(),
  /** Meal items in the plan */
  items: z.array(mealItemOutputSchema),
});

export type MealsGetPlanOutput = z.infer<typeof mealsGetPlanOutputSchema>;
