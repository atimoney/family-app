/**
 * Calendar types re-exported from features/calendar for consistency with Minimals pattern.
 *
 * Import from here for cleaner imports:
 * import type { CalendarEventItem, CalendarInfo } from 'src/types/calendar';
 *
 * The canonical definitions remain in features/calendar/types.ts
 */
export type {
  SyncStatus,
  CalendarInfo,
  // Sync
  SyncResponse,
  // Enums / unions
  EventAudience,
  EventCategory,
  // Reminders
  EventReminder,
  RecurrenceRule,
  ReminderMethod,
  EventAuditInfo,
  // Audit
  EventAuditEntry,
  EventEditSource,
  // Core types
  CalendarEventApi,
  CategoryMetadata,
  CalendarEventItem,
  CalendarEventsQuery,
  // Recurrence
  RecurrenceFrequency,
  CalendarEventMetadata,
  EventFamilyAssignments,
} from 'src/features/calendar/types';
