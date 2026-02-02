# Features Architecture

This document explains the architectural decisions made for the `features/` folder structure in `family-app`, and how it relates to the Minimals template conventions.

## Background

The Minimals template uses the following structure for feature code:

```
actions/       → Data fetching hooks (SWR-based) + mutations
types/         → Type definitions
sections/      → UI components + view-specific hooks
```

## Our Pattern: Feature Modules

`family-app` uses a **feature-based module structure** that co-locates related code:

```
features/
  calendar/
    api.ts           → API client functions
    types.ts         → Domain types
    hooks/           → Data hooks (useCalendarEvents, etc.)
  tasks/
    api.ts
    types.ts
    hooks/
  family/
    api.ts
    hooks/
    index.ts         → Barrel exports
  lists/
    ...
  integrations/
    ...
```

### Why This Pattern?

1. **Co-location**: API, types, and data hooks for a feature live together, making it easier to understand and modify a complete feature.

2. **Clear Boundaries**: Each feature is a self-contained module with explicit exports via `index.ts`.

3. **Growing Complexity**: Family-app has domain-specific features (calendar sync, task templates, list management) that benefit from grouping related code.

4. **Backend Alignment**: The `features/` structure mirrors the API's domain organization, making it easier to trace frontend ↔ backend code.

### Trade-offs

- **Diverges from Minimals**: The `actions/` convention is not used. If adopting more Minimals sections in the future, be aware of this difference.

- **Type Fragmentation**: Some types live in `features/*/types.ts` while shared/API contract types live in `@family/shared`. UI-only types should eventually move to `src/types/`.

## Conventions

### Importing from Features

Use barrel imports for cleaner code:

```typescript
// ✅ Good - use barrel import
import { useCalendarEvents, CalendarEventItem } from 'src/features/calendar';

// ❌ Avoid - deep imports
import { useCalendarEvents } from 'src/features/calendar/hooks/use-calendar-events';
```

### Where Code Lives

| Code Type | Location |
|-----------|----------|
| API client functions | `features/{feature}/api.ts` |
| Domain/API types | `@family/shared` or `features/{feature}/types.ts` |
| Data fetching hooks | `features/{feature}/hooks/` |
| UI-only types | `src/types/` (preferred) |
| View components | `sections/{feature}/view/` |
| View-specific hooks | `sections/{feature}/hooks/` |
| Shared UI hooks | `features/family/hooks/` (e.g., `useMemberLookup`) |

### Shared Utilities

Common utilities used across features:

- `src/lib/auth-helpers.ts` - Auth header helpers (`getAuthHeaders`, `tryGetAuthHeaders`)
- `src/lib/api-client.ts` - HTTP client wrapper
- `src/features/family/hooks/use-member-lookup.ts` - Family member lookup hook

## Future Considerations

If the app grows significantly, consider:

1. **Adopting SWR**: Replace manual `useState`/`useEffect` patterns with SWR for better caching and automatic revalidation.

2. **Centralizing Types**: Move all UI-specific types from `features/*/types.ts` to `src/types/`.

3. **Feature Extraction**: If a feature becomes large enough, it could become its own package in the monorepo.
