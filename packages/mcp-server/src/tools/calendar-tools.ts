import { defineTool } from '../registry.js';
import type { ToolContext, ToolResult } from '../types.js';
import {
  calendarSearchInputSchema,
  calendarSearchOutputSchema,
  calendarCreateInputSchema,
  calendarCreateOutputSchema,
  calendarUpdateInputSchema,
  calendarUpdateOutputSchema,
  type CalendarSearchInput,
  type CalendarSearchOutput,
  type CalendarCreateInput,
  type CalendarCreateOutput,
  type CalendarUpdateInput,
  type CalendarUpdateOutput,
} from './calendar-schemas.js';

// ----------------------------------------------------------------------
// CALENDAR TOOL HANDLER TYPE
// ----------------------------------------------------------------------

/**
 * Handler function for calendar tools.
 * Injected by the API layer with Prisma access.
 */
export type CalendarToolHandler<TInput, TOutput> = (
  input: TInput,
  context: ToolContext
) => Promise<ToolResult<TOutput>>;

/**
 * Registry of calendar tool handlers.
 * These are injected by the API layer.
 */
export const calendarToolHandlers: {
  search?: CalendarToolHandler<CalendarSearchInput, CalendarSearchOutput>;
  create?: CalendarToolHandler<CalendarCreateInput, CalendarCreateOutput>;
  update?: CalendarToolHandler<CalendarUpdateInput, CalendarUpdateOutput>;
} = {};

/**
 * Register calendar tool handlers (called by API layer).
 */
export function registerCalendarToolHandlers(handlers: {
  search: CalendarToolHandler<CalendarSearchInput, CalendarSearchOutput>;
  create: CalendarToolHandler<CalendarCreateInput, CalendarCreateOutput>;
  update: CalendarToolHandler<CalendarUpdateInput, CalendarUpdateOutput>;
}): void {
  calendarToolHandlers.search = handlers.search;
  calendarToolHandlers.create = handlers.create;
  calendarToolHandlers.update = handlers.update;
}

// ----------------------------------------------------------------------
// TOOL DEFINITIONS
// ----------------------------------------------------------------------

/**
 * calendar.search - Search for calendar events
 */
export const calendarSearchTool = defineTool({
  name: 'calendar.search',
  description: 'Search for calendar events by query, date range, or attendee',
  inputSchema: calendarSearchInputSchema,
  outputSchema: calendarSearchOutputSchema,
  execute: async (input, context) => {
    if (!calendarToolHandlers.search) {
      return { success: false, error: 'Calendar search handler not registered' };
    }
    // Apply defaults
    const parsedInput: CalendarSearchInput = {
      ...input,
      limit: input.limit ?? 20,
    };
    return calendarToolHandlers.search(parsedInput, context);
  },
});

/**
 * calendar.create - Create a new calendar event
 */
export const calendarCreateTool = defineTool({
  name: 'calendar.create',
  description: 'Create a new calendar event with title, time, and optional attendees',
  inputSchema: calendarCreateInputSchema,
  outputSchema: calendarCreateOutputSchema,
  execute: async (input, context) => {
    if (!calendarToolHandlers.create) {
      return { success: false, error: 'Calendar create handler not registered' };
    }
    // Apply defaults
    const parsedInput: CalendarCreateInput = {
      ...input,
      allDay: input.allDay ?? false,
    };
    return calendarToolHandlers.create(parsedInput, context);
  },
});

/**
 * calendar.update - Update an existing calendar event
 */
export const calendarUpdateTool = defineTool({
  name: 'calendar.update',
  description: 'Update an existing calendar event (title, time, location, notes)',
  inputSchema: calendarUpdateInputSchema,
  outputSchema: calendarUpdateOutputSchema,
  execute: async (input, context) => {
    if (!calendarToolHandlers.update) {
      return { success: false, error: 'Calendar update handler not registered' };
    }
    return calendarToolHandlers.update(input, context);
  },
});
