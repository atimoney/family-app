import { z } from 'zod';

// ----------------------------------------------------------------------
// ENUMS
// ----------------------------------------------------------------------

export const listTemplateKeySchema = z.enum(['shopping', 'meal_plan', 'custom']);
export const listNavVisibilitySchema = z.enum(['pinned', 'visible', 'hidden']);
export const listViewKeySchema = z.enum(['list', 'table', 'grouped', 'week']);
export const listItemStatusSchema = z.enum(['open', 'done', 'archived']);
export const fieldTypeSchema = z.enum([
  'text',
  'number',
  'checkbox',
  'select',
  'multi_select',
  'date',
  'datetime',
  'user',
  'url',
]);

// ----------------------------------------------------------------------
// FIELD DEFINITION SCHEMA
// ----------------------------------------------------------------------

export const fieldOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const fieldDefinitionSchema = z.object({
  key: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  type: fieldTypeSchema,
  required: z.boolean().optional(),
  options: z.array(fieldOptionSchema).optional(),
  defaultValue: z.unknown().optional(),
  width: z.union([z.string(), z.number()]).optional(),
  hidden: z.boolean().optional(),
});

// ----------------------------------------------------------------------
// LIST CONFIG SCHEMA
// ----------------------------------------------------------------------

export const tableViewConfigSchema = z.object({
  visibleColumns: z.array(z.string()),
});

export const groupedViewConfigSchema = z.object({
  groupBy: z.string(),
});

export const weekViewConfigSchema = z.object({
  mealSlots: z.array(z.string()),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
});

export const listConfigSchema = z.object({
  fields: z.array(fieldDefinitionSchema),
  views: z.object({
    enabled: z.array(listViewKeySchema),
    defaultView: listViewKeySchema,
    table: tableViewConfigSchema.optional(),
    grouped: groupedViewConfigSchema.optional(),
    week: weekViewConfigSchema.optional(),
  }),
});

// ----------------------------------------------------------------------
// LIST CRUD SCHEMAS
// ----------------------------------------------------------------------

export const createListSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  templateKey: listTemplateKeySchema,
  navVisibility: listNavVisibilitySchema.optional().default('visible'),
  config: listConfigSchema.optional(), // If omitted, default config will be applied
  icon: z.string().max(100).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
});

export const updateListSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  navVisibility: listNavVisibilitySchema.optional(),
  config: listConfigSchema.optional(),
  icon: z.string().max(100).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
});

export const listsQuerySchema = z.object({
  navVisibility: listNavVisibilitySchema.optional(),
  templateKey: listTemplateKeySchema.optional(),
});

// ----------------------------------------------------------------------
// LIST ITEM CRUD SCHEMAS
// ----------------------------------------------------------------------

export const createListItemSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  status: listItemStatusSchema.optional().default('open'),
  sortOrder: z.number().int().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  assignedToUserId: z.string().nullable().optional(),
  fields: z.record(z.unknown()).optional().default({}),
});

export const updateListItemSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  status: listItemStatusSchema.optional(),
  sortOrder: z.number().int().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  assignedToUserId: z.string().nullable().optional(),
  fields: z.record(z.unknown()).optional(),
});

export const listItemsQuerySchema = z.object({
  status: z.union([listItemStatusSchema, z.array(listItemStatusSchema)]).optional(),
  includeArchived: z.coerce.boolean().optional().default(false),
});

// ----------------------------------------------------------------------
// USER LIST PREFERENCES SCHEMAS
// ----------------------------------------------------------------------

export const userListPreferencesSchema = z.object({
  lastViewKey: listViewKeySchema.nullable().optional(),
  sort: z
    .object({
      field: z.string(),
      direction: z.enum(['asc', 'desc']),
    })
    .nullable()
    .optional(),
  filters: z.record(z.unknown()).nullable().optional(),
  collapsedGroups: z.array(z.string()).nullable().optional(),
  groupBy: z.string().nullable().optional(),
});

// ----------------------------------------------------------------------
// MEAL PLAN GENERATE SHOPPING SCHEMA
// ----------------------------------------------------------------------

export const generateShoppingSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  targetListId: z.string().min(1),
});

// ----------------------------------------------------------------------
// TYPE EXPORTS
// ----------------------------------------------------------------------

export type CreateListInput = z.infer<typeof createListSchema>;
export type UpdateListInput = z.infer<typeof updateListSchema>;
export type ListsQueryInput = z.infer<typeof listsQuerySchema>;
export type CreateListItemInput = z.infer<typeof createListItemSchema>;
export type UpdateListItemInput = z.infer<typeof updateListItemSchema>;
export type ListItemsQueryInput = z.infer<typeof listItemsQuerySchema>;
export type UserListPreferencesInput = z.infer<typeof userListPreferencesSchema>;
export type GenerateShoppingInput = z.infer<typeof generateShoppingSchema>;
