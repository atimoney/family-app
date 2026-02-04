# Stage 3: Meal Planning Agent & Shopping List Tools

This document describes the meal planning and shopping list agent implementation for the family-app AI assistant.

## Overview

Stage 3 introduces the MealsAgent, which handles natural language requests for family meal planning and shopping lists. The agent can:

- **Generate** weekly meal plan drafts based on constraints
- **Save** meal plans to the family's list
- **View** existing meal plans
- **Add** items to the shopping list
- **View** the shopping list

## Architecture

```
User Message
     │
     ▼
┌─────────────┐
│ Orchestrator │ ◀── Multi-intent detection
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│  Intent Router   │ ◀── meals/shopping domain patterns
└────────┬─────────┘
         │
         ▼
┌─────────────────┐     ┌────────────────────────┐
│  MealsAgent     │────▶│ MCP Tools              │
│                 │     │ - meals.generatePlan   │
│ Intent parsing  │     │ - meals.savePlan       │
│ Confirmation    │     │ - meals.getPlan        │
│                 │     │ - shopping.addItems    │
│                 │     │ - shopping.getItems    │
│                 │     │ - shopping.getPrimaryList│
│                 │     │ - shopping.checkItems  │
└─────────────────┘     └────────┬───────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ Prisma Handlers │
                        │ (List/ListItem) │
                        └─────────────────┘
```

## Data Model

### Using Generic Lists

Meal plans and shopping lists use the **generic List/ListItem** model, not bespoke tables. This provides:

- Consistent UI components across list types
- Flexible field configuration via JSON
- Multiple view modes (week, list, table, grouped)

### Meal Plan List

A meal plan is stored as a `List` with:

```prisma
List {
  templateKey: "meal_plan"
  name: "Meal Plan: Feb 3 - Feb 9"   // Auto-generated from week
  config: { fields, views }          // Week view enabled
}

ListItem {
  title: "Spaghetti Bolognese"       // Meal name
  status: "open" | "done"            // Prepared or not
  fields: {
    date: "2026-02-09"               // YYYY-MM-DD (local date)
    mealType: "dinner"               // breakfast|lunch|dinner|snack
    servings: 4                      // Number of servings
    notes: "Recipe notes..."
    recipeRef: "https://..."         // External recipe URL
  }
}
```

### Shopping List

A shopping list is stored as a `List` with:

```prisma
List {
  templateKey: "shopping"
  name: "Shopping List"
  navVisibility: "pinned"            // Pinned by default
  config: { fields, views }          // Grouped view by category
}

ListItem {
  title: "Eggs"                      // Item name
  status: "open" | "done"            // Not purchased | Purchased
  fields: {
    qty: "1"                         // Quantity
    unit: "dozen"                    // Unit
    category: "dairy"                // For grouping
    source: "agent"                  // Origin (agent, manual)
    sourceItemId: "..."              // Optional link to meal plan item
  }
}
```

## MCP Tools

### `meals.generatePlan`

Generate a weekly meal plan draft based on constraints. This is a **read-only** operation that produces a draft requiring confirmation.

**Input:**
```typescript
{
  weekStartDate: "2026-02-09",       // YYYY-MM-DD (Monday)
  constraints?: {
    lowCarb?: boolean,
    kidFriendly?: boolean,
    vegetarian?: boolean,
    allergies?: string[]
  },
  preferences?: object,              // Future: dietary preferences
  scheduleHints?: Array<{            // Future: calendar conflicts
    startAt: string,
    endAt: string,
    title: string
  }>
}
```

**Output:**
```typescript
{
  mealPlanDraft: {
    weekStartDate: "2026-02-09",
    items: [
      {
        date: "2026-02-09",
        mealType: "breakfast",
        title: "Scrambled Eggs on Toast",
        servings: 4,
        notes?: string,
        recipeRef?: string
      },
      // ... more meals
    ]
  },
  shoppingDelta: [
    { name: "Eggs", qty: "1", unit: "dozen", category: "dairy" },
    // ... more items
  ]
}
```

### `meals.savePlan`

Save a meal plan to the family's list. Creates a new MEAL_PLAN list or updates an existing one.

**Input:**
```typescript
{
  familyId?: string,                 // Uses context if omitted
  listId?: string,                   // Update existing list
  weekStartDate: "2026-02-09",
  items: [
    { date, mealType, title, servings?, notes?, recipeRef? }
  ]
}
```

**Output:**
```typescript
{
  list: { id: "...", type: "meal_plan", name: "Meal Plan: Feb 9 - Feb 15" },
  createdItemsCount: 18,
  updatedItemsCount: 3
}
```

Items are matched by `date + mealType` for upsert behavior.

### `meals.getPlan`

Retrieve an existing meal plan.

**Input:**
```typescript
{
  listId?: string,                   // Find by list ID
  weekStartDate?: string             // Or find by week
}
```

**Output:**
```typescript
{
  list: { id, name } | null,
  items: [
    { id, date, mealType, title, servings?, notes?, recipeRef? }
  ]
}
```

### `shopping.addItems`

Add items to a shopping list.

**Input:**
```typescript
{
  listId?: string,                   // Uses primary list if omitted
  items: [
    { name: "Eggs", qty?: "1", unit?: "dozen", category?: "dairy" }
  ]
}
```

**Output:**
```typescript
{
  addedCount: 5,
  items: [
    { id, name, qty?, unit?, category?, checked: false }
  ]
}
```

### `shopping.getPrimaryList`

Get the family's primary shopping list.

**Input:**
```typescript
{
  familyId?: string                  // Uses context if omitted
}
```

**Output:**
```typescript
{
  list: { id, name } | null
}
```

### `shopping.getItems`

Get items from a shopping list.

**Input:**
```typescript
{
  listId?: string,                   // Uses primary list if omitted
  checked?: boolean,                 // Filter by status
  limit?: number                     // Max items (default 100)
}
```

**Output:**
```typescript
{
  list: { id, name },
  items: [
    { id, name, qty?, unit?, category?, checked }
  ],
  total: number
}
```

### `shopping.checkItems`

Mark items as checked/purchased.

**Input:**
```typescript
{
  itemIds: string[],
  checked: boolean                   // true = purchased
}
```

**Output:**
```typescript
{
  updatedCount: number
}
```

## Agent Interaction Examples

### Example 1: Generate a Meal Plan

**User:** "Plan our meals for next week"

**Agent Response:**
```
📅 **Meal Plan Draft**

**Monday, Feb 10**
  • **Breakfast:** Scrambled Eggs on Toast
  • **Lunch:** Chicken Caesar Salad
  • **Dinner:** Spaghetti Bolognese

**Tuesday, Feb 11**
  • **Breakfast:** Overnight Oats with Berries
  ...

🛒 **Shopping List Preview**
• Eggs (1 dozen)
• Bread (1 loaf)
• Chicken breast (500g)
• Pasta (500g)
...and 8 more items

---
**Would you like me to save this meal plan and add the shopping items to your list?**
Reply "yes" to confirm, or "no" to cancel.
```

### Example 2: Confirm and Save

**User:** "yes"

**Agent Response:**
```
✅ **Meal plan saved!**

• **List:** Meal Plan: Feb 10 - Feb 16
• **Meals created:** 21
• **Meals updated:** 0

Your meal plan for the week of 2026-02-10 is now ready!
```

### Example 3: Add Shopping Items

**User:** "add milk, bread, and 2 dozen eggs to the shopping list"

**Agent Response:**
```
✅ Added 3 item(s) to your shopping list:
• milk
• bread
• eggs (2 dozen)
```

### Example 4: View Shopping List

**User:** "show the shopping list"

**Agent Response:**
```
🛒 **Shopping List** (12 items)

**Dairy**
⬜ Eggs (1 dozen)
⬜ Milk (2 L)
⬜ Cheese (200 g)

**Produce**
⬜ Garlic (1 head)
⬜ Onions (1 kg)
⬜ Tomatoes (500 g)

**Pantry**
⬜ Pasta (500 g)
⬜ Rice (1 kg)
⬜ Olive oil (1 bottle)
...
```

### Example 5: Week Boundary Clarification

**User (on Friday):** "plan meals for the week"

**Agent Response:**
```
Would you like me to plan meals for **this week** or **next week**?
(It's currently near the weekend, so I want to make sure I plan the right week.)
```

### Example 6: Constraints

**User:** "generate a kid-friendly, low-carb meal plan for next week"

The agent extracts constraints and generates a plan considering:
- Kid-friendly options
- Low-carb alternatives

## Confirmation Flow

### When Confirmation is Required

| Operation | Requires Confirmation |
|-----------|----------------------|
| Generate plan | No (read-only) |
| Save plan | Yes (always, contains multiple items) |
| Get plan | No (read-only) |
| Add shopping items (high confidence) | No |
| Add shopping items (low confidence) | Yes |
| Get shopping list | No (read-only) |
| Check items | No (simple toggle) |

### Confirmation Token Flow

1. Agent generates draft and creates pending action
2. Returns `requiresConfirmation: true` with `pendingAction.token`
3. User confirms with `confirmationToken` + `confirmed: true`
4. Agent consumes token and executes saved action

## Audit Logging

All tool invocations are logged to `AgentAuditLog`:

```prisma
AgentAuditLog {
  requestId: "abc-123"
  userId: "user-id"
  familyId: "family-id"
  toolName: "meals.savePlan"
  input: { weekStartDate: "2026-02-09", ... }
  output: { list: {...}, createdItemsCount: 21 }
  success: true
  executionMs: 145
}
```

## Future Enhancements

1. **AI-powered generation**: Replace simple meal suggestions with LLM-based generation considering:
   - Past meal history (avoid repetition)
   - Seasonal ingredients
   - Family preferences
   - Recipe complexity

2. **Calendar integration**: Use `scheduleHints` to avoid prep during busy times

3. **Recipe parsing**: Extract shopping items from actual recipes

4. **Smart shopping**: Aggregate quantities, suggest store layout ordering

5. **Meal rating**: Track which meals the family enjoyed for future recommendations
