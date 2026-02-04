import { z } from 'zod';

// ----------------------------------------------------------------------
// SHOPPING ITEM SCHEMA
// ----------------------------------------------------------------------

/**
 * Shopping item category - common grocery categories.
 */
export const shoppingCategorySchema = z.enum([
  'produce',
  'dairy',
  'meat',
  'seafood',
  'bakery',
  'frozen',
  'pantry',
  'beverages',
  'snacks',
  'household',
  'personal',
  'other',
]);

export type ShoppingCategory = z.infer<typeof shoppingCategorySchema>;

/**
 * Fields stored in ListItem.fields for shopping items.
 */
export const shoppingItemFieldsSchema = z.object({
  /** Quantity (e.g., "2", "500g", "1 dozen") */
  qty: z.string().max(50).optional(),
  /** Unit (e.g., "lbs", "oz", "pack") */
  unit: z.string().max(30).optional(),
  /** Category for grouping in the list */
  category: z.string().max(50).optional(),
  /** Source of the item (e.g., "meal_plan", "manual", "recurring") */
  source: z.string().max(50).optional(),
  /** Reference to source item (e.g., meal plan item ID) */
  sourceItemId: z.string().optional(),
});

export type ShoppingItemFields = z.infer<typeof shoppingItemFieldsSchema>;

/**
 * Output representation of a shopping item.
 */
export const shoppingItemOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  qty: z.string().optional(),
  unit: z.string().optional(),
  category: z.string().optional(),
  checked: z.boolean(),
});

export type ShoppingItemOutput = z.infer<typeof shoppingItemOutputSchema>;

// ----------------------------------------------------------------------
// SHOPPING.ADD_ITEMS
// ----------------------------------------------------------------------

/**
 * A shopping item to add.
 */
export const shoppingItemInputSchema = z.object({
  /** Item name */
  name: z.string().min(1, 'Name is required').max(200),
  /** Quantity (optional) */
  qty: z.string().max(50).optional(),
  /** Unit (optional) */
  unit: z.string().max(30).optional(),
  /** Category for grouping */
  category: z.string().max(50).optional(),
});

export type ShoppingItemInput = z.infer<typeof shoppingItemInputSchema>;

export const shoppingAddItemsInputSchema = z.object({
  /** List ID (optional, uses primary shopping list if omitted) */
  listId: z.string().optional(),
  /** Items to add */
  items: z.array(shoppingItemInputSchema).min(1, 'At least one item is required').max(100),
});

export type ShoppingAddItemsInput = z.infer<typeof shoppingAddItemsInputSchema>;

export const shoppingAddItemsOutputSchema = z.object({
  /** Number of items added */
  addedCount: z.number().int(),
  /** The added items */
  items: z.array(shoppingItemOutputSchema),
});

export type ShoppingAddItemsOutput = z.infer<typeof shoppingAddItemsOutputSchema>;

// ----------------------------------------------------------------------
// SHOPPING.GET_PRIMARY_LIST
// ----------------------------------------------------------------------

export const shoppingGetPrimaryListInputSchema = z.object({
  /** Optional family ID (uses context if omitted) */
  familyId: z.string().optional(),
});

export type ShoppingGetPrimaryListInput = z.infer<typeof shoppingGetPrimaryListInputSchema>;

export const shoppingGetPrimaryListOutputSchema = z.object({
  /** The primary shopping list info */
  list: z.object({
    id: z.string(),
    name: z.string(),
  }).nullable(),
});

export type ShoppingGetPrimaryListOutput = z.infer<typeof shoppingGetPrimaryListOutputSchema>;

// ----------------------------------------------------------------------
// SHOPPING.GET_ITEMS
// ----------------------------------------------------------------------

export const shoppingGetItemsInputSchema = z.object({
  /** List ID (optional, uses primary if omitted) */
  listId: z.string().optional(),
  /** Filter by checked status */
  checked: z.boolean().optional(),
  /** Limit results */
  limit: z.number().int().min(1).max(500).default(100),
});

export type ShoppingGetItemsInput = z.infer<typeof shoppingGetItemsInputSchema>;

export const shoppingGetItemsOutputSchema = z.object({
  /** Shopping list info */
  list: z.object({
    id: z.string(),
    name: z.string(),
  }),
  /** Items in the list */
  items: z.array(shoppingItemOutputSchema),
  /** Total count */
  total: z.number().int(),
});

export type ShoppingGetItemsOutput = z.infer<typeof shoppingGetItemsOutputSchema>;

// ----------------------------------------------------------------------
// SHOPPING.CHECK_ITEMS
// ----------------------------------------------------------------------

export const shoppingCheckItemsInputSchema = z.object({
  /** Item IDs to mark as checked/purchased */
  itemIds: z.array(z.string()).min(1).max(100),
  /** Whether to check (true) or uncheck (false) */
  checked: z.boolean().default(true),
});

export type ShoppingCheckItemsInput = z.infer<typeof shoppingCheckItemsInputSchema>;

export const shoppingCheckItemsOutputSchema = z.object({
  /** Number of items updated */
  updatedCount: z.number().int(),
});

export type ShoppingCheckItemsOutput = z.infer<typeof shoppingCheckItemsOutputSchema>;
