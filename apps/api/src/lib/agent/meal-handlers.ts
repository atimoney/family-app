import { type PrismaClient, Prisma } from '@prisma/client';
import type { ToolContext, ToolResult } from '@family/mcp-server';
import type {
  MealsGeneratePlanInput,
  MealsGeneratePlanOutput,
  MealsSavePlanInput,
  MealsSavePlanOutput,
  MealsGetPlanInput,
  MealsGetPlanOutput,
  MealPlanDraftItem,
  ShoppingDeltaItem,
  MealItemOutput,
} from '@family/mcp-server';
import type { ListConfig } from '@family/shared';

// ----------------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------------

const LIST_TEMPLATE_KEY = 'meal_plan';
const DEFAULT_MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ----------------------------------------------------------------------
// DEFAULT CONFIGURATION
// ----------------------------------------------------------------------

/**
 * Default config for a meal plan list.
 */
function getDefaultMealPlanConfig(): ListConfig {
  return {
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true },
      {
        key: 'mealType',
        label: 'Meal',
        type: 'select',
        required: true,
        options: DEFAULT_MEAL_SLOTS.map((s) => ({ value: s, label: capitalize(s) })),
      },
      { key: 'servings', label: 'Servings', type: 'number' },
      { key: 'notes', label: 'Notes', type: 'text' },
      { key: 'recipeRef', label: 'Recipe', type: 'url' },
    ],
    views: {
      enabled: ['week', 'list', 'table'],
      defaultView: 'week',
      week: {
        mealSlots: DEFAULT_MEAL_SLOTS.map(capitalize),
        weekStartsOn: 1, // Monday
      },
      table: {
        visibleColumns: ['title', 'date', 'mealType', 'servings'],
      },
    },
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ----------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------

function redactInput(input: Record<string, unknown>): Record<string, unknown> {
  return { ...input };
}

async function writeAuditLog(
  prisma: PrismaClient,
  context: ToolContext,
  toolName: string,
  input: Record<string, unknown>,
  result: ToolResult,
  executionMs: number
): Promise<void> {
  try {
    await prisma.agentAuditLog.create({
      data: {
        requestId: context.requestId,
        userId: context.userId,
        familyId: context.familyId,
        toolName,
        input: redactInput(input) as Prisma.InputJsonValue,
        output: result.success && result.data ? (result.data as Prisma.InputJsonValue) : Prisma.JsonNull,
        success: result.success,
        errorMessage: result.error ?? null,
        executionMs,
      },
    });
  } catch (err) {
    context.logger.error(
      { err, toolName, requestId: context.requestId },
      'Failed to write audit log'
    );
  }
}

/**
 * Generate a unique key for a meal item (date + mealType).
 */
function getMealItemKey(date: string, mealType: string): string {
  return `${date}:${mealType}`;
}

/**
 * Parse the list name from a week start date.
 */
function getMealPlanName(weekStartDate: string): string {
  const date = new Date(weekStartDate);
  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + 6);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });

  return `Meal Plan: ${formatDate(date)} - ${formatDate(endDate)}`;
}

/**
 * Map a list item to MealItemOutput.
 */
function mapListItemToMealOutput(item: {
  id: string;
  title: string;
  fields: unknown;
}): MealItemOutput {
  const fields = item.fields as Record<string, unknown>;
  return {
    id: item.id,
    date: fields.date as string,
    mealType: fields.mealType as MealItemOutput['mealType'],
    title: item.title,
    servings: fields.servings as number | undefined,
    notes: fields.notes as string | undefined,
    recipeRef: fields.recipeRef as string | undefined,
  };
}

// ----------------------------------------------------------------------
// SIMPLE MEAL GENERATOR
// ----------------------------------------------------------------------

/**
 * Simple meal suggestions based on day and meal type.
 * In production, this would be replaced with an AI-powered generator.
 */
const MEAL_SUGGESTIONS: Record<string, string[]> = {
  breakfast: [
    'Scrambled Eggs on Toast',
    'Overnight Oats with Berries',
    'Banana Pancakes',
    'Greek Yogurt Parfait',
    'Avocado Toast',
    'Smoothie Bowl',
    'Porridge with Honey',
  ],
  lunch: [
    'Chicken Caesar Salad',
    'BLT Sandwich',
    'Vegetable Soup with Bread',
    'Tuna Wrap',
    'Pasta Salad',
    'Grilled Cheese & Tomato Soup',
    'Rice Paper Rolls',
  ],
  dinner: [
    'Spaghetti Bolognese',
    'Roast Chicken with Vegetables',
    'Salmon with Rice',
    'Beef Stir Fry',
    'Tacos',
    'Shepherd\'s Pie',
    'Thai Green Curry',
  ],
  snack: [
    'Fruit & Cheese Platter',
    'Hummus with Veggie Sticks',
    'Trail Mix',
    'Apple Slices with Peanut Butter',
    'Popcorn',
    'Rice Crackers',
    'Smoothie',
  ],
};

/**
 * Generate a simple meal plan draft.
 * This is a placeholder - production would use AI.
 */
function generateSimpleMealPlan(
  weekStartDate: string,
  constraints?: MealsGeneratePlanInput['constraints']
): MealPlanDraftItem[] {
  const items: MealPlanDraftItem[] = [];
  const startDate = new Date(weekStartDate);

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + dayOffset);
    const dateStr = currentDate.toISOString().split('T')[0];

    // Generate meals for each slot
    for (const mealType of ['breakfast', 'lunch', 'dinner']) {
      const suggestions = MEAL_SUGGESTIONS[mealType];
      // Rotate through suggestions based on day
      const title = suggestions[(dayOffset + items.length) % suggestions.length];

      const item: MealPlanDraftItem = {
        date: dateStr,
        mealType: mealType as MealPlanDraftItem['mealType'],
        title,
        servings: 4,
      };

      // Add notes based on constraints
      if (constraints?.kidFriendly) {
        item.notes = 'Kid-friendly option';
      }
      if (constraints?.lowCarb && mealType === 'dinner') {
        item.notes = 'Low-carb alternative available';
      }

      items.push(item);
    }
  }

  return items;
}

/**
 * Generate a simple shopping list from meal items.
 * This is a placeholder - production would parse recipes.
 */
function generateSimpleShoppingDelta(
  items: MealPlanDraftItem[]
): ShoppingDeltaItem[] {
  // Simple mock - in production, this would parse recipes
  const shoppingItems: ShoppingDeltaItem[] = [
    { name: 'Eggs', qty: '1', unit: 'dozen', category: 'dairy' },
    { name: 'Bread', qty: '1', unit: 'loaf', category: 'bakery' },
    { name: 'Chicken breast', qty: '500', unit: 'g', category: 'meat' },
    { name: 'Pasta', qty: '500', unit: 'g', category: 'pantry' },
    { name: 'Mixed vegetables', qty: '1', unit: 'bag', category: 'frozen' },
    { name: 'Rice', qty: '1', unit: 'kg', category: 'pantry' },
    { name: 'Olive oil', qty: '1', unit: 'bottle', category: 'pantry' },
    { name: 'Garlic', qty: '1', unit: 'head', category: 'produce' },
    { name: 'Onions', qty: '1', unit: 'kg', category: 'produce' },
    { name: 'Tomatoes', qty: '500', unit: 'g', category: 'produce' },
    { name: 'Milk', qty: '2', unit: 'L', category: 'dairy' },
    { name: 'Cheese', qty: '200', unit: 'g', category: 'dairy' },
  ];

  return shoppingItems;
}

// ----------------------------------------------------------------------
// HANDLER FACTORY
// ----------------------------------------------------------------------

export type MealHandlerDependencies = {
  prisma: PrismaClient;
};

/**
 * Create meal tool handlers with injected dependencies.
 */
export function createMealToolHandlers(deps: MealHandlerDependencies) {
  const { prisma } = deps;

  // --------------------------------------------------------------------------
  // Helper: Find or create meal plan list for a week
  // --------------------------------------------------------------------------
  async function findOrCreateMealPlanList(
    familyId: string,
    weekStartDate: string
  ): Promise<{ id: string; name: string; isNew: boolean }> {
    const listName = getMealPlanName(weekStartDate);

    // Look for existing list with matching name
    const existing = await prisma.list.findFirst({
      where: {
        familyId,
        templateKey: LIST_TEMPLATE_KEY,
        name: listName,
      },
    });

    if (existing) {
      return { id: existing.id, name: existing.name, isNew: false };
    }

    // Create new list
    const newList = await prisma.list.create({
      data: {
        familyId,
        name: listName,
        templateKey: LIST_TEMPLATE_KEY,
        navVisibility: 'visible',
        config: getDefaultMealPlanConfig() as unknown as Prisma.InputJsonValue,
      },
    });

    return { id: newList.id, name: newList.name, isNew: true };
  }

  // --------------------------------------------------------------------------
  // meals.generatePlan
  // --------------------------------------------------------------------------
  async function generatePlan(
    input: MealsGeneratePlanInput,
    context: ToolContext
  ): Promise<ToolResult<MealsGeneratePlanOutput>> {
    const startTime = Date.now();

    context.logger.info(
      { input, familyId: context.familyId },
      'meals.generatePlan executing'
    );

    try {
      // Generate meal plan draft
      const items = generateSimpleMealPlan(input.weekStartDate, input.constraints);

      // Generate shopping list delta
      const shoppingDelta = generateSimpleShoppingDelta(items);

      const result: ToolResult<MealsGeneratePlanOutput> = {
        success: true,
        data: {
          mealPlanDraft: {
            weekStartDate: input.weekStartDate,
            items,
          },
          shoppingDelta,
        },
      };

      await writeAuditLog(
        prisma,
        context,
        'meals.generatePlan',
        input as unknown as Record<string, unknown>,
        result,
        Date.now() - startTime
      );

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      context.logger.error({ err }, 'meals.generatePlan failed');

      const result: ToolResult<MealsGeneratePlanOutput> = { success: false, error };
      await writeAuditLog(
        prisma,
        context,
        'meals.generatePlan',
        input as unknown as Record<string, unknown>,
        result,
        Date.now() - startTime
      );

      return result;
    }
  }

  // --------------------------------------------------------------------------
  // meals.savePlan
  // --------------------------------------------------------------------------
  async function savePlan(
    input: MealsSavePlanInput,
    context: ToolContext
  ): Promise<ToolResult<MealsSavePlanOutput>> {
    const startTime = Date.now();
    const familyId = input.familyId ?? context.familyId;

    context.logger.info(
      { input, familyId },
      'meals.savePlan executing'
    );

    try {
      // Find or create the meal plan list
      let listId = input.listId;
      let listName: string;
      let isNewList = false;

      if (listId) {
        // Verify list exists and belongs to family
        const list = await prisma.list.findFirst({
          where: { id: listId, familyId, templateKey: LIST_TEMPLATE_KEY },
        });
        if (!list) {
          return {
            success: false,
            error: 'Meal plan list not found or access denied',
          };
        }
        listName = list.name;
      } else {
        const listInfo = await findOrCreateMealPlanList(familyId, input.weekStartDate);
        listId = listInfo.id;
        listName = listInfo.name;
        isNewList = listInfo.isNew;
      }

      // Get existing items in the list
      const existingItems = await prisma.listItem.findMany({
        where: { listId },
      });

      // Build a map of existing items by (date + mealType)
      const existingByKey = new Map<string, { id: string; title: string }>();
      for (const item of existingItems) {
        const fields = item.fields as Record<string, unknown>;
        if (fields.date && fields.mealType) {
          const key = getMealItemKey(fields.date as string, fields.mealType as string);
          existingByKey.set(key, { id: item.id, title: item.title });
        }
      }

      // Upsert items
      let createdCount = 0;
      let updatedCount = 0;

      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        const key = getMealItemKey(item.date, item.mealType);
        const existing = existingByKey.get(key);

        const fields: Record<string, unknown> = {
          date: item.date,
          mealType: item.mealType,
          servings: item.servings,
          notes: item.notes,
          recipeRef: item.recipeRef,
        };

        if (existing) {
          // Update existing item
          await prisma.listItem.update({
            where: { id: existing.id },
            data: {
              title: item.title,
              fields: fields as Prisma.InputJsonValue,
              updatedAt: new Date(),
            },
          });
          updatedCount++;
        } else {
          // Create new item
          await prisma.listItem.create({
            data: {
              listId,
              title: item.title,
              status: 'open',
              sortOrder: i,
              fields: fields as Prisma.InputJsonValue,
            },
          });
          createdCount++;
        }
      }

      const result: ToolResult<MealsSavePlanOutput> = {
        success: true,
        data: {
          list: {
            id: listId,
            type: LIST_TEMPLATE_KEY,
            name: listName,
          },
          createdItemsCount: createdCount,
          updatedItemsCount: updatedCount,
        },
      };

      await writeAuditLog(
        prisma,
        context,
        'meals.savePlan',
        input as unknown as Record<string, unknown>,
        result,
        Date.now() - startTime
      );

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      context.logger.error({ err }, 'meals.savePlan failed');

      const result: ToolResult<MealsSavePlanOutput> = { success: false, error };
      await writeAuditLog(
        prisma,
        context,
        'meals.savePlan',
        input as unknown as Record<string, unknown>,
        result,
        Date.now() - startTime
      );

      return result;
    }
  }

  // --------------------------------------------------------------------------
  // meals.getPlan
  // --------------------------------------------------------------------------
  async function getPlan(
    input: MealsGetPlanInput,
    context: ToolContext
  ): Promise<ToolResult<MealsGetPlanOutput>> {
    const startTime = Date.now();

    context.logger.info(
      { input, familyId: context.familyId },
      'meals.getPlan executing'
    );

    try {
      let list: { id: string; name: string; type: string } | null = null;
      let listId: string | null = null;

      if (input.listId) {
        // Find by list ID
        const found = await prisma.list.findFirst({
          where: {
            id: input.listId,
            familyId: context.familyId,
            templateKey: LIST_TEMPLATE_KEY,
          },
        });
        if (found) {
          list = { id: found.id, name: found.name, type: found.templateKey };
          listId = found.id;
        }
      } else if (input.weekStartDate) {
        // Find by week start date (list name)
        const listName = getMealPlanName(input.weekStartDate);
        const found = await prisma.list.findFirst({
          where: {
            familyId: context.familyId,
            templateKey: LIST_TEMPLATE_KEY,
            name: listName,
          },
        });
        if (found) {
          list = { id: found.id, name: found.name, type: found.templateKey };
          listId = found.id;
        }
      }

      // Get items if list was found
      const items: MealItemOutput[] = [];
      if (listId) {
        const listItems = await prisma.listItem.findMany({
          where: { listId, status: { not: 'archived' } },
          orderBy: [{ sortOrder: 'asc' }],
        });
        for (const item of listItems) {
          items.push(mapListItemToMealOutput(item));
        }
      }

      const result: ToolResult<MealsGetPlanOutput> = {
        success: true,
        data: { list, items },
      };

      await writeAuditLog(
        prisma,
        context,
        'meals.getPlan',
        input as unknown as Record<string, unknown>,
        result,
        Date.now() - startTime
      );

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      context.logger.error({ err }, 'meals.getPlan failed');

      const result: ToolResult<MealsGetPlanOutput> = { success: false, error };
      await writeAuditLog(
        prisma,
        context,
        'meals.getPlan',
        input as unknown as Record<string, unknown>,
        result,
        Date.now() - startTime
      );

      return result;
    }
  }

  return {
    generatePlan,
    savePlan,
    getPlan,
  };
}
