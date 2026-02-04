# Stage 4: Agent Preferences (Memory)

**Status:** Implemented  
**Date:** February 2026

## Overview

This stage implements structured preferences ("memory") for AI agents. Preferences store long-term facts that agents use to personalize their behavior without requiring users to repeat information.

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Request                              │
│               "Plan meals for this week"                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MealsAgent                                  │
│  1. Load preferences via prefs.getBulk                          │
│  2. Merge message constraints with stored prefs                 │
│  3. Generate plan respecting allergies, servings, etc.          │
└─────────────────────────────────────────────────────────────────┘
```

## Data Models

### FamilyPreference

Family-wide settings accessible by all agents. Used for shared defaults like allergies, dietary restrictions, and default durations.

```prisma
model FamilyPreference {
  id              String   @id @default(cuid())
  familyId        String   @map("family_id")
  key             String   // "meals.allergies", "tasks.defaultAssignee"
  valueJson       Json     @map("value_json")
  updatedByUserId String   @map("updated_by_user_id")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([familyId, key])
  @@map("family_preferences")
}
```

### PersonPreference

Person-specific preferences within a family. Used for individual settings like personal allergies or timezone overrides.

```prisma
model PersonPreference {
  id              String   @id @default(cuid())
  familyId        String   @map("family_id")
  userId          String   @map("user_id")
  key             String   // "meals.personalAllergies"
  valueJson       Json     @map("value_json")
  updatedByUserId String   @map("updated_by_user_id")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([familyId, userId, key])
  @@map("person_preferences")
}
```

## Key Naming Convention

Keys use dot notation for namespacing:
- First segment: domain (`meals`, `tasks`, `calendar`, `general`)
- Second segment: specific preference

Examples:
- `meals.allergies`
- `tasks.defaultPriority`
- `calendar.defaultDuration`

## MCP Tools

### prefs.get

Get a single preference value.

```typescript
// Input
{
  scope: 'family' | 'person',
  key: string,            // e.g., "meals.allergies"
  userId?: string,        // Required for person scope (other than self)
}

// Output
{
  key: string,
  valueJson: any | null,  // null if not set
  exists: boolean,
  updatedAt: string | null,
  updatedByUserId: string | null,
}
```

### prefs.set

Set a preference value (requires appropriate permissions).

```typescript
// Input
{
  scope: 'family' | 'person',
  key: string,
  userId?: string,        // For person scope
  valueJson: any,         // Any JSON-serializable value
}

// Output
{
  ok: boolean,
  key: string,
  created: boolean,       // true if new, false if updated
}
```

### prefs.delete

Remove a preference (reset to default/unset).

```typescript
// Input
{
  scope: 'family' | 'person',
  key: string,
  userId?: string,
}

// Output
{
  ok: boolean,
  existed: boolean,
}
```

### prefs.list

List preferences with optional filtering.

```typescript
// Input
{
  scope: 'family' | 'person',
  userId?: string,
  keyPrefix?: string,     // e.g., "meals." for all meal prefs
}

// Output
{
  preferences: Array<{
    key: string,
    valueJson: any,
    updatedAt: string,
    updatedByUserId: string,
  }>,
  count: number,
}
```

### prefs.getBulk

Get multiple preferences in a single call (used by agents at startup).

```typescript
// Input
{
  requests: Array<{
    scope: 'family' | 'person',
    key: string,
    userId?: string,
  }>
}

// Output
{
  results: Record<string, any | null>,  // key -> value
}
```

## RBAC Permissions

### Family Preferences

| Role | Can Read | Can Write |
|------|----------|-----------|
| Owner | ✅ | ✅ |
| Admin | ✅ | ✅ |
| Member | ✅ | Non-admin keys only |
| Child | ✅ | ❌ |

**Admin-only keys:**
- `meals.allergies`
- `meals.dietaryRestrictions`
- `general.timezone`

### Person Preferences

| Actor | Target | Can Read | Can Write |
|-------|--------|----------|-----------|
| Self | Self | ✅ | ✅ |
| Admin/Owner | Child | ✅ | ✅ |
| Admin/Owner | Other Adult | ✅ | ❌ |
| Member | Other | ✅ | ❌ |

## Sample Keys and Values

### Meals Domain

| Key | Type | Example Value | Description |
|-----|------|---------------|-------------|
| `meals.allergies` | string[] | `["gluten", "nuts"]` | Family-wide allergies to always avoid |
| `meals.dietaryRestrictions` | string[] | `["vegetarian"]` | Dietary restrictions |
| `meals.defaultServings` | number | `4` | Default servings for generated meals |
| `meals.kidFriendlyDefault` | boolean | `true` | Prefer kid-friendly meals by default |
| `meals.preferredDinnerTime` | string | `"18:30"` | Preferred dinner time (HH:mm) |
| `meals.weekStartsMonday` | boolean | `true` | Week starts on Monday |
| `meals.dislikedIngredients` | string[] | `["mushrooms", "olives"]` | Ingredients to avoid |
| `meals.budgetLevel` | string | `"moderate"` | Budget preference: budget, moderate, premium |
| `meals.preferQuickMeals` | boolean | `false` | Prefer meals under 30 min |

### Tasks Domain

| Key | Type | Example Value | Description |
|-----|------|---------------|-------------|
| `tasks.defaultAssignee` | string | `"clm123..."` | Default FamilyMember ID for new tasks |
| `tasks.defaultDueTime` | string | `"17:00"` | Default time for due dates (HH:mm) |
| `tasks.defaultReminderOffset` | number | `60` | Minutes before due to remind |
| `tasks.defaultPriority` | string | `"medium"` | Default priority: low, medium, high, urgent |

### Calendar Domain

| Key | Type | Example Value | Description |
|-----|------|---------------|-------------|
| `calendar.defaultDuration` | number | `60` | Default event duration in minutes |
| `calendar.preferredTimezone` | string | `"Australia/Melbourne"` | IANA timezone |
| `calendar.namingConvention` | string | `"{child} - {activity}"` | Template for event names |
| `calendar.defaultReminder` | number | `30` | Minutes before event to remind |
| `calendar.workHoursStart` | string | `"09:00"` | Work hours start (HH:mm) |
| `calendar.workHoursEnd` | string | `"17:00"` | Work hours end (HH:mm) |

### General Domain

| Key | Type | Example Value | Description |
|-----|------|---------------|-------------|
| `general.timezone` | string | `"Australia/Sydney"` | Default timezone for family |
| `general.language` | string | `"en-AU"` | Locale code |
| `general.dateFormat` | string | `"DD/MM/YYYY"` | Date format preference |

## Agent Integration

### MealsAgent

```typescript
// At the start of handleGeneratePlan
const prefs = await loadMealsPreferences(toolExecutor);

// Merge message constraints with stored preferences
const mergedConstraints = mergeConstraintsWithPreferences(
  intent.constraints,  // From user message
  prefs               // From storage
);

// Example: If family has gluten allergy stored, and user says "vegetarian",
// the merged constraints include both
```

**Behavior:**
- Always respects stored allergies (critical for safety)
- Uses default servings if not specified
- Applies kidFriendlyDefault unless explicitly overridden
- Uses weekStartsMonday for date calculations

### TasksAgent

```typescript
// At the start of handleCreateIntent
const prefs = await loadTasksPreferences(toolExecutor);

// Apply defaults
const priority = intent.priority ?? prefs.defaultPriority ?? 'medium';
const dueTime = prefs.defaultDueTime; // Applied if date but no time

// Apply default assignee if not specified
if (!intent.assignee && prefs.defaultAssignee) {
  input.assignedTo = prefs.defaultAssignee;
}
```

**Behavior:**
- Applies default priority for new tasks
- Adds default time to due dates when only date specified
- Auto-assigns to default assignee if set

### CalendarAgent

```typescript
// At the start of handleCreateIntent
const prefs = await loadCalendarPreferences(toolExecutor);
const defaultDurationMinutes = prefs.defaultDuration ?? 60;

// Calculate end time using preference-based duration
if (!endAt && startAt && !allDay) {
  const end = new Date(start.getTime() + defaultDurationMinutes * 60 * 1000);
  endAt = end.toISOString();
}
```

**Behavior:**
- Uses preferred duration for events without explicit end time
- Could use timezone for date parsing (future)
- Could apply naming conventions (future)

## Audit Logging

All `prefs.set` and `prefs.delete` operations are logged to `AgentAuditLog`:

```json
{
  "toolName": "prefs.set",
  "input": {
    "scope": "family",
    "key": "meals.allergies",
    "valueJson": "[REDACTED]"  // Sensitive values redacted
  },
  "success": true
}
```

**Sensitive key patterns** (values redacted in logs):
- Keys containing: password, secret, token, key, credential

## Design Decisions

### What to Store

✅ **Do Store:**
- Allergies and dietary restrictions (safety-critical)
- Default values (servings, durations, priorities)
- Timezone and locale preferences
- Default assignees

❌ **Don't Store:**
- Chat transcripts or conversation history
- Temporary state or session data
- Sensitive credentials
- Large documents or files

### When to Ask vs. Assume

| Situation | Behavior |
|-----------|----------|
| Allergy missing, affects safety | Ask user |
| Default duration missing | Use 60 minutes |
| Default assignee missing | Leave unassigned |
| Timezone missing | Use Australia/Melbourne |

### Priority Order

1. **Explicit message content** - User says "vegetarian"
2. **Stored preference** - Family has allergies stored
3. **System default** - 60 min duration, medium priority

## Example Workflows

### Setting Family Allergies

```
User: "My family has gluten and nut allergies"
Agent: I'll save these dietary restrictions for your family:
       • Gluten-free
       • Nut-free
       
       These will be applied to all future meal plans. ✅

[prefs.set called with:]
{
  scope: "family",
  key: "meals.allergies",
  valueJson: ["gluten", "nuts"]
}
```

### Using Allergies in Meal Planning

```
User: "Plan meals for this week"
Agent: [loads prefs.getBulk → allergies: ["gluten", "nuts"]]
       
       📅 **Meal Plan Draft** (gluten-free, nut-free)
       
       **Monday**
       • Breakfast: Gluten-free oatmeal with berries
       • Dinner: Grilled chicken with rice and vegetables
       ...
```

### Admin Setting Child Preferences

```
Parent: "Set Hamish's personal preference for extra vegetables"
Agent: [checks RBAC: parent can set child preferences]
       
       ✅ Saved personal preference for Hamish:
       meals.personalPreferences = { "extraVegetables": true }
```

## Future Enhancements

1. **Preference Suggestions** - Agent suggests preferences based on patterns
2. **Preference Conflicts** - Detect and resolve conflicting preferences
3. **Preference Expiry** - Time-limited preferences (seasonal allergies)
4. **Preference Import/Export** - Backup and restore preferences
5. **Preference Templates** - Pre-defined preference sets for common scenarios
