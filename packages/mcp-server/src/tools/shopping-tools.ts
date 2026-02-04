import { defineTool } from '../registry.js';
import type { ToolContext, ToolResult } from '../types.js';
import {
  shoppingAddItemsInputSchema,
  shoppingAddItemsOutputSchema,
  shoppingGetPrimaryListInputSchema,
  shoppingGetPrimaryListOutputSchema,
  shoppingGetItemsInputSchema,
  shoppingGetItemsOutputSchema,
  shoppingCheckItemsInputSchema,
  shoppingCheckItemsOutputSchema,
  type ShoppingAddItemsInput,
  type ShoppingAddItemsOutput,
  type ShoppingGetPrimaryListInput,
  type ShoppingGetPrimaryListOutput,
  type ShoppingGetItemsInput,
  type ShoppingGetItemsOutput,
  type ShoppingCheckItemsInput,
  type ShoppingCheckItemsOutput,
} from './shopping-schemas.js';

// ----------------------------------------------------------------------
// SHOPPING TOOL HANDLER TYPE
// ----------------------------------------------------------------------

/**
 * Handler function for shopping tools.
 * Injected by the API layer with Prisma access.
 */
export type ShoppingToolHandler<TInput, TOutput> = (
  input: TInput,
  context: ToolContext
) => Promise<ToolResult<TOutput>>;

/**
 * Registry of shopping tool handlers.
 * These are injected by the API layer.
 */
export const shoppingToolHandlers: {
  addItems?: ShoppingToolHandler<ShoppingAddItemsInput, ShoppingAddItemsOutput>;
  getPrimaryList?: ShoppingToolHandler<ShoppingGetPrimaryListInput, ShoppingGetPrimaryListOutput>;
  getItems?: ShoppingToolHandler<ShoppingGetItemsInput, ShoppingGetItemsOutput>;
  checkItems?: ShoppingToolHandler<ShoppingCheckItemsInput, ShoppingCheckItemsOutput>;
} = {};

/**
 * Register shopping tool handlers (called by API layer).
 */
export function registerShoppingToolHandlers(handlers: {
  addItems: ShoppingToolHandler<ShoppingAddItemsInput, ShoppingAddItemsOutput>;
  getPrimaryList: ShoppingToolHandler<ShoppingGetPrimaryListInput, ShoppingGetPrimaryListOutput>;
  getItems: ShoppingToolHandler<ShoppingGetItemsInput, ShoppingGetItemsOutput>;
  checkItems: ShoppingToolHandler<ShoppingCheckItemsInput, ShoppingCheckItemsOutput>;
}): void {
  shoppingToolHandlers.addItems = handlers.addItems;
  shoppingToolHandlers.getPrimaryList = handlers.getPrimaryList;
  shoppingToolHandlers.getItems = handlers.getItems;
  shoppingToolHandlers.checkItems = handlers.checkItems;
}

// ----------------------------------------------------------------------
// TOOL DEFINITIONS
// ----------------------------------------------------------------------

/**
 * shopping.addItems - Add items to a shopping list
 * 
 * Adds items to the specified shopping list, or the family's primary
 * shopping list if no listId is provided.
 */
export const shoppingAddItemsTool = defineTool({
  name: 'shopping.addItems',
  description:
    'Add items to a shopping list. Uses the primary shopping list if no listId is specified. Creates the list if it does not exist.',
  inputSchema: shoppingAddItemsInputSchema,
  outputSchema: shoppingAddItemsOutputSchema,
  execute: async (input, context) => {
    if (!shoppingToolHandlers.addItems) {
      return { success: false, error: 'Shopping addItems handler not registered' };
    }
    return shoppingToolHandlers.addItems(input, context);
  },
});

/**
 * shopping.getPrimaryList - Get the family's primary shopping list
 */
export const shoppingGetPrimaryListTool = defineTool({
  name: 'shopping.getPrimaryList',
  description:
    'Get the primary shopping list for the family. Returns null if no shopping list exists.',
  inputSchema: shoppingGetPrimaryListInputSchema,
  outputSchema: shoppingGetPrimaryListOutputSchema,
  execute: async (input, context) => {
    if (!shoppingToolHandlers.getPrimaryList) {
      return { success: false, error: 'Shopping getPrimaryList handler not registered' };
    }
    return shoppingToolHandlers.getPrimaryList(input, context);
  },
});

/**
 * shopping.getItems - Get items from a shopping list
 */
export const shoppingGetItemsTool = defineTool({
  name: 'shopping.getItems',
  description:
    'Get items from a shopping list. Uses the primary shopping list if no listId is specified.',
  inputSchema: shoppingGetItemsInputSchema,
  outputSchema: shoppingGetItemsOutputSchema,
  execute: async (input, context) => {
    if (!shoppingToolHandlers.getItems) {
      return { success: false, error: 'Shopping getItems handler not registered' };
    }
    // Apply defaults
    const parsedInput: ShoppingGetItemsInput = {
      ...input,
      limit: input.limit ?? 100,
    };
    return shoppingToolHandlers.getItems(parsedInput, context);
  },
});

/**
 * shopping.checkItems - Mark shopping items as checked/purchased
 */
export const shoppingCheckItemsTool = defineTool({
  name: 'shopping.checkItems',
  description: 'Mark shopping list items as checked (purchased) or unchecked.',
  inputSchema: shoppingCheckItemsInputSchema,
  outputSchema: shoppingCheckItemsOutputSchema,
  execute: async (input, context) => {
    if (!shoppingToolHandlers.checkItems) {
      return { success: false, error: 'Shopping checkItems handler not registered' };
    }
    // Apply defaults
    const parsedInput: ShoppingCheckItemsInput = {
      ...input,
      checked: input.checked ?? true,
    };
    return shoppingToolHandlers.checkItems(parsedInput, context);
  },
});
