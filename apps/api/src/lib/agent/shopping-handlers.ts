import { type PrismaClient, Prisma } from '@prisma/client';
import type { ToolContext, ToolResult } from '@family/mcp-server';
import type {
  ShoppingAddItemsInput,
  ShoppingAddItemsOutput,
  ShoppingGetPrimaryListInput,
  ShoppingGetPrimaryListOutput,
  ShoppingGetItemsInput,
  ShoppingGetItemsOutput,
  ShoppingCheckItemsInput,
  ShoppingCheckItemsOutput,
  ShoppingItemOutput,
} from '@family/mcp-server';
import type { ListConfig } from '@family/shared';

// ----------------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------------

const LIST_TEMPLATE_KEY = 'shopping';
const DEFAULT_LIST_NAME = 'Shopping List';

// ----------------------------------------------------------------------
// DEFAULT CONFIGURATION
// ----------------------------------------------------------------------

/**
 * Default config for a shopping list.
 */
function getDefaultShoppingConfig(): ListConfig {
  return {
    fields: [
      { key: 'qty', label: 'Qty', type: 'text' },
      { key: 'unit', label: 'Unit', type: 'text' },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        options: [
          { value: 'produce', label: 'Produce' },
          { value: 'dairy', label: 'Dairy' },
          { value: 'meat', label: 'Meat' },
          { value: 'seafood', label: 'Seafood' },
          { value: 'bakery', label: 'Bakery' },
          { value: 'frozen', label: 'Frozen' },
          { value: 'pantry', label: 'Pantry' },
          { value: 'beverages', label: 'Beverages' },
          { value: 'snacks', label: 'Snacks' },
          { value: 'household', label: 'Household' },
          { value: 'personal', label: 'Personal' },
          { value: 'other', label: 'Other' },
        ],
      },
      { key: 'source', label: 'Source', type: 'text', hidden: true },
      { key: 'sourceItemId', label: 'Source Item', type: 'text', hidden: true },
    ],
    views: {
      enabled: ['list', 'grouped', 'table'],
      defaultView: 'grouped',
      grouped: {
        groupBy: 'category',
      },
      table: {
        visibleColumns: ['title', 'qty', 'unit', 'category'],
      },
    },
  };
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
 * Map a list item to ShoppingItemOutput.
 */
function mapListItemToShoppingOutput(item: {
  id: string;
  title: string;
  status: string;
  fields: unknown;
}): ShoppingItemOutput {
  const fields = item.fields as Record<string, unknown>;
  return {
    id: item.id,
    name: item.title,
    qty: fields.qty as string | undefined,
    unit: fields.unit as string | undefined,
    category: fields.category as string | undefined,
    checked: item.status === 'done',
  };
}

// ----------------------------------------------------------------------
// HANDLER FACTORY
// ----------------------------------------------------------------------

export type ShoppingHandlerDependencies = {
  prisma: PrismaClient;
};

/**
 * Create shopping tool handlers with injected dependencies.
 */
export function createShoppingToolHandlers(deps: ShoppingHandlerDependencies) {
  const { prisma } = deps;

  // --------------------------------------------------------------------------
  // Helper: Find or create primary shopping list
  // --------------------------------------------------------------------------
  async function findOrCreatePrimaryList(
    familyId: string
  ): Promise<{ id: string; name: string; isNew: boolean }> {
    // Look for existing shopping list (take first one created)
    const existing = await prisma.list.findFirst({
      where: {
        familyId,
        templateKey: LIST_TEMPLATE_KEY,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (existing) {
      return { id: existing.id, name: existing.name, isNew: false };
    }

    // Create new list
    const newList = await prisma.list.create({
      data: {
        familyId,
        name: DEFAULT_LIST_NAME,
        templateKey: LIST_TEMPLATE_KEY,
        navVisibility: 'pinned', // Shopping list is pinned by default
        config: getDefaultShoppingConfig() as unknown as Prisma.InputJsonValue,
      },
    });

    return { id: newList.id, name: newList.name, isNew: true };
  }

  // --------------------------------------------------------------------------
  // shopping.addItems
  // --------------------------------------------------------------------------
  async function addItems(
    input: ShoppingAddItemsInput,
    context: ToolContext
  ): Promise<ToolResult<ShoppingAddItemsOutput>> {
    const startTime = Date.now();

    context.logger.info(
      { input, familyId: context.familyId },
      'shopping.addItems executing'
    );

    try {
      // Get or create list
      let listId: string;
      if (input.listId) {
        // Verify list exists and belongs to family
        const list = await prisma.list.findFirst({
          where: { id: input.listId, familyId: context.familyId, templateKey: LIST_TEMPLATE_KEY },
        });
        if (!list) {
          return {
            success: false,
            error: 'Shopping list not found or access denied',
          };
        }
        listId = list.id;
      } else {
        const listInfo = await findOrCreatePrimaryList(context.familyId);
        listId = listInfo.id;
      }

      // Get current max sort order
      const maxSortItem = await prisma.listItem.findFirst({
        where: { listId },
        orderBy: { sortOrder: 'desc' },
      });
      let sortOrder = (maxSortItem?.sortOrder ?? 0) + 1;

      // Create items
      const createdItems: ShoppingItemOutput[] = [];

      for (const item of input.items) {
        const fields: Record<string, unknown> = {
          qty: item.qty,
          unit: item.unit,
          category: item.category,
          source: 'agent', // Track that this was added by the agent
        };

        const created = await prisma.listItem.create({
          data: {
            listId,
            title: item.name,
            status: 'open',
            sortOrder: sortOrder++,
            fields: fields as Prisma.InputJsonValue,
          },
        });

        createdItems.push(mapListItemToShoppingOutput({ ...created, fields }));
      }

      const result: ToolResult<ShoppingAddItemsOutput> = {
        success: true,
        data: {
          addedCount: createdItems.length,
          items: createdItems,
        },
      };

      await writeAuditLog(
        prisma,
        context,
        'shopping.addItems',
        input as unknown as Record<string, unknown>,
        result,
        Date.now() - startTime
      );

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      context.logger.error({ err }, 'shopping.addItems failed');

      const result: ToolResult<ShoppingAddItemsOutput> = { success: false, error };
      await writeAuditLog(
        prisma,
        context,
        'shopping.addItems',
        input as unknown as Record<string, unknown>,
        result,
        Date.now() - startTime
      );

      return result;
    }
  }

  // --------------------------------------------------------------------------
  // shopping.getPrimaryList
  // --------------------------------------------------------------------------
  async function getPrimaryList(
    input: ShoppingGetPrimaryListInput,
    context: ToolContext
  ): Promise<ToolResult<ShoppingGetPrimaryListOutput>> {
    const startTime = Date.now();
    const familyId = input.familyId ?? context.familyId;

    context.logger.info(
      { input, familyId },
      'shopping.getPrimaryList executing'
    );

    try {
      // Find primary shopping list (don't create if not exists)
      const existing = await prisma.list.findFirst({
        where: {
          familyId,
          templateKey: LIST_TEMPLATE_KEY,
        },
        orderBy: { createdAt: 'asc' },
      });

      const result: ToolResult<ShoppingGetPrimaryListOutput> = {
        success: true,
        data: {
          list: existing ? { id: existing.id, name: existing.name } : null,
        },
      };

      await writeAuditLog(
        prisma,
        context,
        'shopping.getPrimaryList',
        input as unknown as Record<string, unknown>,
        result,
        Date.now() - startTime
      );

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      context.logger.error({ err }, 'shopping.getPrimaryList failed');

      const result: ToolResult<ShoppingGetPrimaryListOutput> = { success: false, error };
      await writeAuditLog(
        prisma,
        context,
        'shopping.getPrimaryList',
        input as unknown as Record<string, unknown>,
        result,
        Date.now() - startTime
      );

      return result;
    }
  }

  // --------------------------------------------------------------------------
  // shopping.getItems
  // --------------------------------------------------------------------------
  async function getItems(
    input: ShoppingGetItemsInput,
    context: ToolContext
  ): Promise<ToolResult<ShoppingGetItemsOutput>> {
    const startTime = Date.now();

    context.logger.info(
      { input, familyId: context.familyId },
      'shopping.getItems executing'
    );

    try {
      // Get list
      let listId: string;
      let listName: string;

      if (input.listId) {
        const list = await prisma.list.findFirst({
          where: { id: input.listId, familyId: context.familyId, templateKey: LIST_TEMPLATE_KEY },
        });
        if (!list) {
          return {
            success: false,
            error: 'Shopping list not found or access denied',
          };
        }
        listId = list.id;
        listName = list.name;
      } else {
        const listInfo = await findOrCreatePrimaryList(context.familyId);
        listId = listInfo.id;
        listName = listInfo.name;
      }

      // Build where clause
      const where: Prisma.ListItemWhereInput = {
        listId,
        status: { not: 'archived' },
      };

      // Filter by checked status
      if (input.checked !== undefined) {
        where.status = input.checked ? 'done' : 'open';
      }

      // Get items
      const [listItems, total] = await Promise.all([
        prisma.listItem.findMany({
          where,
          orderBy: [{ sortOrder: 'asc' }],
          take: input.limit ?? 100,
        }),
        prisma.listItem.count({ where }),
      ]);

      const items = listItems.map(mapListItemToShoppingOutput);

      const result: ToolResult<ShoppingGetItemsOutput> = {
        success: true,
        data: {
          list: { id: listId, name: listName },
          items,
          total,
        },
      };

      await writeAuditLog(
        prisma,
        context,
        'shopping.getItems',
        input as unknown as Record<string, unknown>,
        result,
        Date.now() - startTime
      );

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      context.logger.error({ err }, 'shopping.getItems failed');

      const result: ToolResult<ShoppingGetItemsOutput> = { success: false, error };
      await writeAuditLog(
        prisma,
        context,
        'shopping.getItems',
        input as unknown as Record<string, unknown>,
        result,
        Date.now() - startTime
      );

      return result;
    }
  }

  // --------------------------------------------------------------------------
  // shopping.checkItems
  // --------------------------------------------------------------------------
  async function checkItems(
    input: ShoppingCheckItemsInput,
    context: ToolContext
  ): Promise<ToolResult<ShoppingCheckItemsOutput>> {
    const startTime = Date.now();

    context.logger.info(
      { input, familyId: context.familyId },
      'shopping.checkItems executing'
    );

    try {
      const newStatus = input.checked ? 'done' : 'open';

      // Update items that belong to the user's family
      // First get items with their list to verify family ownership
      const itemsWithList = await prisma.listItem.findMany({
        where: {
          id: { in: input.itemIds },
          list: {
            familyId: context.familyId,
            templateKey: LIST_TEMPLATE_KEY,
          },
        },
      });

      if (itemsWithList.length === 0) {
        return {
          success: false,
          error: 'No valid items found',
        };
      }

      // Update the items
      const result_update = await prisma.listItem.updateMany({
        where: {
          id: { in: itemsWithList.map((i) => i.id) },
        },
        data: {
          status: newStatus,
          updatedAt: new Date(),
        },
      });

      const result: ToolResult<ShoppingCheckItemsOutput> = {
        success: true,
        data: {
          updatedCount: result_update.count,
        },
      };

      await writeAuditLog(
        prisma,
        context,
        'shopping.checkItems',
        input as unknown as Record<string, unknown>,
        result,
        Date.now() - startTime
      );

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      context.logger.error({ err }, 'shopping.checkItems failed');

      const result: ToolResult<ShoppingCheckItemsOutput> = { success: false, error };
      await writeAuditLog(
        prisma,
        context,
        'shopping.checkItems',
        input as unknown as Record<string, unknown>,
        result,
        Date.now() - startTime
      );

      return result;
    }
  }

  return {
    addItems,
    getPrimaryList,
    getItems,
    checkItems,
  };
}
