// ============================================================================
// LIST PRIMITIVE - CORE TYPES
// ============================================================================

/**
 * Template key identifies the type of list and determines default configuration.
 * - 'shopping': Shopping/grocery list with purchase tracking
 * - 'meal_plan': Weekly meal planning with meal slots
 * - 'custom': User-defined list with custom fields
 */
export type ListTemplateKey = 'shopping' | 'meal_plan' | 'custom';

/**
 * Controls how the list appears in the navigation sidebar.
 * - 'pinned': Always visible at top of nav
 * - 'visible': Shown in nav under lists section
 * - 'hidden': Not shown in nav (accessible via lists page)
 */
export type ListNavVisibility = 'pinned' | 'visible' | 'hidden';

/**
 * Available view modes for displaying list items.
 * - 'list': Simple checklist view
 * - 'table': Spreadsheet-style with columns
 * - 'grouped': Items grouped by a field (e.g., category, aisle)
 * - 'week': Calendar week view (for meal planning)
 */
export type ListViewKey = 'list' | 'table' | 'grouped' | 'week';

/**
 * Status of a list item.
 * - 'open': Active/pending item
 * - 'done': Completed item
 * - 'archived': Hidden from default views but retained
 */
export type ListItemStatus = 'open' | 'done' | 'archived';

// ============================================================================
// FIELD DEFINITIONS
// ============================================================================

/**
 * Supported field types for dynamic list item fields.
 */
export type FieldType =
  | 'text'
  | 'number'
  | 'checkbox'
  | 'select'
  | 'multi_select'
  | 'date'
  | 'datetime'
  | 'user'
  | 'url';

/**
 * Definition for a custom field on list items.
 * Describes the schema, display, and behavior of the field.
 */
export type FieldDefinition = {
  /** Unique key for storing the field value (snake_case recommended) */
  key: string;
  /** Human-readable label for the field */
  label: string;
  /** Data type of the field */
  type: FieldType;
  /** Whether this field is required when creating/editing items */
  required?: boolean;
  /** For 'select' and 'multi_select' types: available options */
  options?: FieldOption[];
  /** Default value for new items */
  defaultValue?: unknown;
  /** Display width hint (e.g., 'sm', 'md', 'lg', or pixel number) */
  width?: string | number;
  /** If true, field is stored but not shown in default views */
  hidden?: boolean;
};

/**
 * Option for select/multi_select fields.
 */
export type FieldOption = {
  /** Value stored in the database */
  value: string;
  /** Display label */
  label: string;
  /** Optional color for visual distinction */
  color?: string;
  /** Optional icon identifier */
  icon?: string;
};

// ============================================================================
// LIST CONFIGURATION
// ============================================================================

/**
 * View-specific configuration options.
 */
export type TableViewConfig = {
  /** Column keys to display (order matters) */
  visibleColumns: string[];
};

export type GroupedViewConfig = {
  /** Field key to group items by */
  groupBy: string;
};

export type WeekViewConfig = {
  /** Meal slot names (e.g., ['Breakfast', 'Lunch', 'Dinner', 'Snack']) */
  mealSlots: string[];
  /** Week start day: 0 = Sunday, 1 = Monday */
  weekStartsOn: 0 | 1;
};

/**
 * Complete configuration for a list's structure and behavior.
 * Stored as JSON in the database.
 */
export type ListConfig = {
  /** Field definitions for list items */
  fields: FieldDefinition[];
  /** View configuration */
  views: {
    /** Which views are available for this list */
    enabled: ListViewKey[];
    /** Default view when opening the list */
    defaultView: ListViewKey;
    /** Table view settings */
    table?: TableViewConfig;
    /** Grouped view settings */
    grouped?: GroupedViewConfig;
    /** Week view settings (for meal planning) */
    week?: WeekViewConfig;
  };
};

// ============================================================================
// LIST DTOs
// ============================================================================

/**
 * Data transfer object for a List entity.
 * Represents a family's list (shopping, meal plan, or custom).
 */
export type ListDTO = {
  /** Unique identifier (CUID) */
  id: string;
  /** Family this list belongs to */
  familyId: string;
  /** Display name of the list */
  name: string;
  /** Template type determining default behavior */
  templateKey: ListTemplateKey;
  /** Navigation visibility setting */
  navVisibility: ListNavVisibility;
  /** List configuration (fields, views, etc.) */
  config: ListConfig;
  /** Optional icon identifier for the list */
  icon?: string | null;
  /** Optional color for the list */
  color?: string | null;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
};

/**
 * Data transfer object for a List Item entity.
 * Represents a single item within a list.
 */
export type ListItemDTO = {
  /** Unique identifier (CUID) */
  id: string;
  /** Parent list ID */
  listId: string;
  /** Item title/name (primary display text) */
  title: string;
  /** Current status */
  status: ListItemStatus;
  /** Sort order within the list (lower = higher priority) */
  sortOrder: number;
  /** Optional due date (ISO timestamp) */
  dueAt?: string | null;
  /** Optional assignee (FamilyMember profile ID) */
  assignedToUserId?: string | null;
  /** Dynamic field values based on list config */
  fields: Record<string, unknown>;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
};

/**
 * User-specific preferences for a list.
 * Stores UI state that should persist across sessions.
 */
export type UserListPreferencesDTO = {
  /** User's profile ID */
  userId: string;
  /** List ID these preferences apply to */
  listId: string;
  /** Last selected view */
  lastViewKey?: ListViewKey | null;
  /** Sort configuration */
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  } | null;
  /** Active filter values */
  filters?: Record<string, unknown> | null;
  /** Collapsed group keys (for grouped view) */
  collapsedGroups?: string[] | null;
  /** Field key to group by (for grouped view) */
  groupBy?: string | null;
};

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Input for creating a new list.
 */
export type CreateListInput = {
  name: string;
  templateKey: ListTemplateKey;
  navVisibility?: ListNavVisibility;
  config?: Partial<ListConfig>;
  icon?: string | null;
  color?: string | null;
};

/**
 * Input for updating an existing list.
 */
export type UpdateListInput = {
  name?: string;
  navVisibility?: ListNavVisibility;
  config?: Partial<ListConfig>;
  icon?: string | null;
  color?: string | null;
};

/**
 * Input for creating a new list item.
 */
export type CreateListItemInput = {
  title: string;
  status?: ListItemStatus;
  sortOrder?: number;
  dueAt?: string | null;
  assignedToUserId?: string | null;
  fields?: Record<string, unknown>;
};

/**
 * Input for updating an existing list item.
 */
export type UpdateListItemInput = {
  title?: string;
  status?: ListItemStatus;
  sortOrder?: number;
  dueAt?: string | null;
  assignedToUserId?: string | null;
  fields?: Record<string, unknown>;
};

// ============================================================================
// DEFAULT TEMPLATE CONFIGS
// ============================================================================

/**
 * Common shopping list categories/aisles.
 */
const SHOPPING_CATEGORIES: FieldOption[] = [
  { value: 'produce', label: 'Produce', icon: 'mdi:fruit-grapes' },
  { value: 'dairy', label: 'Dairy', icon: 'mdi:cheese' },
  { value: 'meat', label: 'Meat & Seafood', icon: 'mdi:food-steak' },
  { value: 'bakery', label: 'Bakery', icon: 'mdi:bread-slice' },
  { value: 'frozen', label: 'Frozen', icon: 'mdi:snowflake' },
  { value: 'pantry', label: 'Pantry', icon: 'mdi:food-variant' },
  { value: 'beverages', label: 'Beverages', icon: 'mdi:bottle-soda' },
  { value: 'snacks', label: 'Snacks', icon: 'mdi:cookie' },
  { value: 'household', label: 'Household', icon: 'mdi:home' },
  { value: 'personal', label: 'Personal Care', icon: 'mdi:lotion' },
  { value: 'other', label: 'Other', icon: 'mdi:dots-horizontal' },
];

/**
 * Returns the default configuration for a shopping list.
 * Includes category, quantity, unit, and notes fields.
 */
export function getDefaultShoppingListConfig(): ListConfig {
  return {
    fields: [
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        required: false,
        options: SHOPPING_CATEGORIES,
        defaultValue: 'other',
      },
      {
        key: 'quantity',
        label: 'Qty',
        type: 'number',
        required: false,
        defaultValue: 1,
        width: 'sm',
      },
      {
        key: 'unit',
        label: 'Unit',
        type: 'select',
        required: false,
        options: [
          { value: 'each', label: 'each' },
          { value: 'lb', label: 'lb' },
          { value: 'oz', label: 'oz' },
          { value: 'kg', label: 'kg' },
          { value: 'g', label: 'g' },
          { value: 'gal', label: 'gal' },
          { value: 'qt', label: 'qt' },
          { value: 'pt', label: 'pt' },
          { value: 'cup', label: 'cup' },
          { value: 'l', label: 'L' },
          { value: 'ml', label: 'mL' },
          { value: 'pack', label: 'pack' },
          { value: 'bag', label: 'bag' },
          { value: 'box', label: 'box' },
          { value: 'can', label: 'can' },
          { value: 'jar', label: 'jar' },
          { value: 'bottle', label: 'bottle' },
        ],
        defaultValue: 'each',
        width: 'sm',
      },
      {
        key: 'notes',
        label: 'Notes',
        type: 'text',
        required: false,
        width: 'lg',
      },
    ],
    views: {
      enabled: ['list', 'grouped', 'table'],
      defaultView: 'grouped',
      grouped: {
        groupBy: 'category',
      },
      table: {
        visibleColumns: ['title', 'quantity', 'unit', 'category', 'notes'],
      },
    },
  };
}

/**
 * Default meal slots for meal planning.
 */
const DEFAULT_MEAL_SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

/**
 * Returns the default configuration for a meal plan list.
 * Includes meal type, recipe link, cook assignment, and prep time.
 */
export function getDefaultMealPlanConfig(): ListConfig {
  return {
    fields: [
      {
        key: 'date',
        label: 'Date',
        type: 'date',
        required: true,
      },
      {
        key: 'meal_slot',
        label: 'Meal',
        type: 'select',
        required: true,
        options: DEFAULT_MEAL_SLOTS.map((slot) => ({
          value: slot.toLowerCase(),
          label: slot,
        })),
        defaultValue: 'dinner',
      },
      {
        key: 'recipe_url',
        label: 'Recipe Link',
        type: 'url',
        required: false,
      },
      {
        key: 'cook',
        label: 'Cook',
        type: 'user',
        required: false,
      },
      {
        key: 'prep_time_mins',
        label: 'Prep Time (min)',
        type: 'number',
        required: false,
        width: 'sm',
      },
      {
        key: 'notes',
        label: 'Notes',
        type: 'text',
        required: false,
      },
    ],
    views: {
      enabled: ['week', 'list', 'table'],
      defaultView: 'week',
      week: {
        mealSlots: DEFAULT_MEAL_SLOTS,
        weekStartsOn: 1, // Monday
      },
      table: {
        visibleColumns: ['title', 'date', 'meal_slot', 'cook', 'prep_time_mins'],
      },
    },
  };
}

/**
 * Returns the default configuration for a custom list.
 * Minimal fields - user can add their own.
 */
export function getDefaultCustomListConfig(): ListConfig {
  return {
    fields: [
      {
        key: 'notes',
        label: 'Notes',
        type: 'text',
        required: false,
      },
    ],
    views: {
      enabled: ['list', 'table'],
      defaultView: 'list',
      table: {
        visibleColumns: ['title', 'notes'],
      },
    },
  };
}

/**
 * Returns the appropriate default config for a given template key.
 */
export function getDefaultListConfig(templateKey: ListTemplateKey): ListConfig {
  switch (templateKey) {
    case 'shopping':
      return getDefaultShoppingListConfig();
    case 'meal_plan':
      return getDefaultMealPlanConfig();
    case 'custom':
    default:
      return getDefaultCustomListConfig();
  }
}
