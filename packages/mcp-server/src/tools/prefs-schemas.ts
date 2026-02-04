/**
 * Zod schemas for preference (memory) MCP tools.
 *
 * Preferences store structured facts used by agents:
 * - Family-wide defaults (allergies, servings, durations)
 * - Person-specific preferences (personal allergies, timezone)
 *
 * Key naming convention: <domain>.<key>
 * Examples:
 *   - meals.allergies
 *   - meals.defaultServings
 *   - tasks.defaultAssignee
 *   - calendar.defaultDuration
 */

import { z } from 'zod';

// ============================================================================
// SCOPE ENUM
// ============================================================================

/**
 * Preference scope - determines where the preference is stored.
 * - 'family': Applies to the entire family (FamilyPreference table)
 * - 'person': Applies to a specific person (PersonPreference table)
 */
export const prefScopeSchema = z.enum(['family', 'person']);
export type PrefScope = z.infer<typeof prefScopeSchema>;

// ============================================================================
// PREFERENCE KEY PATTERNS
// ============================================================================

/**
 * Well-known preference keys by domain.
 * Using dot notation for namespacing.
 */
export const PREF_KEYS = {
  // Meals domain
  MEALS: {
    ALLERGIES: 'meals.allergies', // string[] - allergies to avoid
    DIETARY_RESTRICTIONS: 'meals.dietaryRestrictions', // string[] - vegetarian, vegan, etc.
    DEFAULT_SERVINGS: 'meals.defaultServings', // number - default servings for meals
    KID_FRIENDLY_DEFAULT: 'meals.kidFriendlyDefault', // boolean - prefer kid-friendly meals
    PREFERRED_DINNER_TIME: 'meals.preferredDinnerTime', // string - HH:mm format
    WEEK_STARTS_MONDAY: 'meals.weekStartsMonday', // boolean - week starts on Monday
    DISLIKED_INGREDIENTS: 'meals.dislikedIngredients', // string[] - ingredients to avoid
    BUDGET_LEVEL: 'meals.budgetLevel', // 'budget' | 'moderate' | 'premium'
    PREFER_QUICK_MEALS: 'meals.preferQuickMeals', // boolean - prefer meals under 30 min
  },
  // Tasks domain
  TASKS: {
    DEFAULT_ASSIGNEE: 'tasks.defaultAssignee', // string - FamilyMember ID
    DEFAULT_DUE_TIME: 'tasks.defaultDueTime', // string - HH:mm format
    DEFAULT_REMINDER_OFFSET: 'tasks.defaultReminderOffset', // number - minutes before due
    DEFAULT_PRIORITY: 'tasks.defaultPriority', // 'low' | 'medium' | 'high' | 'urgent'
  },
  // Calendar domain
  CALENDAR: {
    DEFAULT_DURATION: 'calendar.defaultDuration', // number - minutes
    PREFERRED_TIMEZONE: 'calendar.preferredTimezone', // string - IANA timezone
    NAMING_CONVENTION: 'calendar.namingConvention', // string - template for event names
    DEFAULT_REMINDER: 'calendar.defaultReminder', // number - minutes before event
    WORK_HOURS_START: 'calendar.workHoursStart', // string - HH:mm format
    WORK_HOURS_END: 'calendar.workHoursEnd', // string - HH:mm format
  },
  // General/System
  GENERAL: {
    TIMEZONE: 'general.timezone', // string - IANA timezone (person-level override)
    LANGUAGE: 'general.language', // string - locale code
    DATE_FORMAT: 'general.dateFormat', // string - date format preference
  },
} as const;

// ============================================================================
// PREFS.GET SCHEMAS
// ============================================================================

/**
 * Input schema for prefs.get tool.
 */
export const prefsGetInputSchema = z.object({
  /** Scope of the preference */
  scope: prefScopeSchema,
  /** The preference key (dot notation, e.g., 'meals.allergies') */
  key: z.string().min(1).max(100),
  /** For person scope: the user ID (Profile ID) to get preferences for */
  userId: z.string().optional(),
});

export type PrefsGetInput = z.infer<typeof prefsGetInputSchema>;

/**
 * Output schema for prefs.get tool.
 */
export const prefsGetOutputSchema = z.object({
  /** The preference key */
  key: z.string(),
  /** The preference value (null if not set) */
  valueJson: z.unknown().nullable(),
  /** Whether the preference exists */
  exists: z.boolean(),
  /** When the preference was last updated (ISO string) */
  updatedAt: z.string().nullable(),
  /** Who last updated the preference (Profile ID) */
  updatedByUserId: z.string().nullable(),
});

export type PrefsGetOutput = z.infer<typeof prefsGetOutputSchema>;

// ============================================================================
// PREFS.SET SCHEMAS
// ============================================================================

/**
 * Input schema for prefs.set tool.
 */
export const prefsSetInputSchema = z.object({
  /** Scope of the preference */
  scope: prefScopeSchema,
  /** The preference key (dot notation, e.g., 'meals.allergies') */
  key: z.string().min(1).max(100),
  /** For person scope: the user ID (Profile ID) to set preferences for */
  userId: z.string().optional(),
  /** The value to set (any JSON-serializable value) */
  valueJson: z.unknown(),
});

export type PrefsSetInput = z.infer<typeof prefsSetInputSchema>;

/**
 * Output schema for prefs.set tool.
 */
export const prefsSetOutputSchema = z.object({
  /** Whether the operation succeeded */
  ok: z.boolean(),
  /** The preference key that was set */
  key: z.string(),
  /** Whether this was a new preference or an update */
  created: z.boolean(),
});

export type PrefsSetOutput = z.infer<typeof prefsSetOutputSchema>;

// ============================================================================
// PREFS.DELETE SCHEMAS
// ============================================================================

/**
 * Input schema for prefs.delete tool.
 */
export const prefsDeleteInputSchema = z.object({
  /** Scope of the preference */
  scope: prefScopeSchema,
  /** The preference key (dot notation, e.g., 'meals.allergies') */
  key: z.string().min(1).max(100),
  /** For person scope: the user ID (Profile ID) to delete preferences for */
  userId: z.string().optional(),
});

export type PrefsDeleteInput = z.infer<typeof prefsDeleteInputSchema>;

/**
 * Output schema for prefs.delete tool.
 */
export const prefsDeleteOutputSchema = z.object({
  /** Whether the operation succeeded */
  ok: z.boolean(),
  /** Whether the preference existed before deletion */
  existed: z.boolean(),
});

export type PrefsDeleteOutput = z.infer<typeof prefsDeleteOutputSchema>;

// ============================================================================
// PREFS.LIST SCHEMAS
// ============================================================================

/**
 * Input schema for prefs.list tool.
 */
export const prefsListInputSchema = z.object({
  /** Scope of preferences to list */
  scope: prefScopeSchema,
  /** For person scope: the user ID (Profile ID) to list preferences for */
  userId: z.string().optional(),
  /** Optional key prefix to filter by (e.g., 'meals.' for all meal prefs) */
  keyPrefix: z.string().optional(),
});

export type PrefsListInput = z.infer<typeof prefsListInputSchema>;

/**
 * A single preference item in the list output.
 */
export const prefItemSchema = z.object({
  key: z.string(),
  valueJson: z.unknown(),
  updatedAt: z.string(),
  updatedByUserId: z.string(),
});

export type PrefItem = z.infer<typeof prefItemSchema>;

/**
 * Output schema for prefs.list tool.
 */
export const prefsListOutputSchema = z.object({
  /** Array of preferences matching the criteria */
  preferences: z.array(prefItemSchema),
  /** Total count of preferences */
  count: z.number(),
});

export type PrefsListOutput = z.infer<typeof prefsListOutputSchema>;

// ============================================================================
// BULK GET SCHEMAS (for agent initialization)
// ============================================================================

/**
 * Input schema for prefs.getBulk tool.
 * Retrieves multiple preferences in a single call.
 */
export const prefsGetBulkInputSchema = z.object({
  /** Array of preference requests */
  requests: z.array(
    z.object({
      scope: prefScopeSchema,
      key: z.string(),
      userId: z.string().optional(),
    })
  ),
});

export type PrefsGetBulkInput = z.infer<typeof prefsGetBulkInputSchema>;

/**
 * Output schema for prefs.getBulk tool.
 */
export const prefsGetBulkOutputSchema = z.object({
  /** Map of key -> value (null if not found) */
  results: z.record(z.unknown().nullable()),
});

export type PrefsGetBulkOutput = z.infer<typeof prefsGetBulkOutputSchema>;
