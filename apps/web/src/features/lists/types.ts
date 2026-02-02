// Re-export shared types for convenience
export type {
  ListDTO,
  FieldType,
  ListConfig,
  FieldOption,
  ListItemDTO,
  ListViewKey,
  ListItemStatus,
  CreateListInput,
  FieldDefinition,
  ListTemplateKey,
  UpdateListInput,
  ListNavVisibility,
  CreateListItemInput,
  UpdateListItemInput,
  UserListPreferencesDTO,
} from '@family/shared';

// ----------------------------------------------------------------------
// QUERY TYPES
// ----------------------------------------------------------------------

export type ListsQuery = {
  navVisibility?: 'pinned' | 'visible' | 'hidden';
  templateKey?: 'shopping' | 'meal_plan' | 'custom';
};

export type ListItemsQuery = {
  status?: 'open' | 'done' | 'archived' | ('open' | 'done' | 'archived')[];
  includeArchived?: boolean;
};

// ----------------------------------------------------------------------
// PREFERENCES INPUT TYPE
// ----------------------------------------------------------------------

export type UserListPreferencesInput = {
  lastViewKey?: 'list' | 'table' | 'grouped' | 'week' | null;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  } | null;
  filters?: Record<string, unknown> | null;
  collapsedGroups?: string[] | null;
  groupBy?: string | null;
};

// ----------------------------------------------------------------------
// EXTENDED RESPONSE TYPES
// ----------------------------------------------------------------------

export type ListWithItems = ListDTO & {
  items?: ListItemDTO[];
  itemCount?: number;
};

// Import for type augmentation
import type { ListDTO, ListItemDTO } from '@family/shared';
