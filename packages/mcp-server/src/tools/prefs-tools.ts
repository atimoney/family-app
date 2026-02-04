/**
 * MCP tool definitions for preferences (agent memory).
 *
 * These tools allow agents to read and write structured preferences
 * for families and individual people.
 */

import { defineTool } from '../registry.js';
import type { ToolContext, ToolResult } from '../types.js';
import {
  prefsGetInputSchema,
  prefsGetOutputSchema,
  prefsSetInputSchema,
  prefsSetOutputSchema,
  prefsDeleteInputSchema,
  prefsDeleteOutputSchema,
  prefsListInputSchema,
  prefsListOutputSchema,
  prefsGetBulkInputSchema,
  prefsGetBulkOutputSchema,
  type PrefsGetInput,
  type PrefsGetOutput,
  type PrefsSetInput,
  type PrefsSetOutput,
  type PrefsDeleteInput,
  type PrefsDeleteOutput,
  type PrefsListInput,
  type PrefsListOutput,
  type PrefsGetBulkInput,
  type PrefsGetBulkOutput,
} from './prefs-schemas.js';

// ----------------------------------------------------------------------
// PREFS TOOL HANDLER TYPE
// ----------------------------------------------------------------------

/**
 * Handler function for preference tools.
 * Injected by the API layer with Prisma access.
 */
export type PrefsToolHandler<TInput, TOutput> = (
  input: TInput,
  context: ToolContext
) => Promise<ToolResult<TOutput>>;

/**
 * Registry of preference tool handlers.
 * These are injected by the API layer.
 */
export const prefsToolHandlers: {
  get?: PrefsToolHandler<PrefsGetInput, PrefsGetOutput>;
  set?: PrefsToolHandler<PrefsSetInput, PrefsSetOutput>;
  delete?: PrefsToolHandler<PrefsDeleteInput, PrefsDeleteOutput>;
  list?: PrefsToolHandler<PrefsListInput, PrefsListOutput>;
  getBulk?: PrefsToolHandler<PrefsGetBulkInput, PrefsGetBulkOutput>;
} = {};

/**
 * Register preference tool handlers (called by API layer).
 */
export function registerPrefsToolHandlers(handlers: {
  get: PrefsToolHandler<PrefsGetInput, PrefsGetOutput>;
  set: PrefsToolHandler<PrefsSetInput, PrefsSetOutput>;
  delete: PrefsToolHandler<PrefsDeleteInput, PrefsDeleteOutput>;
  list: PrefsToolHandler<PrefsListInput, PrefsListOutput>;
  getBulk: PrefsToolHandler<PrefsGetBulkInput, PrefsGetBulkOutput>;
}): void {
  prefsToolHandlers.get = handlers.get;
  prefsToolHandlers.set = handlers.set;
  prefsToolHandlers.delete = handlers.delete;
  prefsToolHandlers.list = handlers.list;
  prefsToolHandlers.getBulk = handlers.getBulk;
}

// ----------------------------------------------------------------------
// TOOL DEFINITIONS
// ----------------------------------------------------------------------

/**
 * Get a single preference value.
 */
export const prefsGetTool = defineTool({
  name: 'prefs.get',
  description:
    'Get a preference value by key. Use scope "family" for family-wide settings or "person" for individual preferences. Returns null if not set.',
  inputSchema: prefsGetInputSchema,
  outputSchema: prefsGetOutputSchema,
  execute: async (input, context) => {
    if (!prefsToolHandlers.get) {
      return { success: false, error: 'Prefs get handler not registered' };
    }
    return prefsToolHandlers.get(input, context);
  },
});

/**
 * Set a preference value.
 */
export const prefsSetTool = defineTool({
  name: 'prefs.set',
  description:
    'Set a preference value. Use scope "family" for family-wide settings (requires admin/parent role) or "person" for individual preferences (self or parent setting for child).',
  inputSchema: prefsSetInputSchema,
  outputSchema: prefsSetOutputSchema,
  execute: async (input, context) => {
    if (!prefsToolHandlers.set) {
      return { success: false, error: 'Prefs set handler not registered' };
    }
    return prefsToolHandlers.set(input, context);
  },
});

/**
 * Delete a preference.
 */
export const prefsDeleteTool = defineTool({
  name: 'prefs.delete',
  description: 'Delete a preference, resetting it to the default/unset state.',
  inputSchema: prefsDeleteInputSchema,
  outputSchema: prefsDeleteOutputSchema,
  execute: async (input, context) => {
    if (!prefsToolHandlers.delete) {
      return { success: false, error: 'Prefs delete handler not registered' };
    }
    return prefsToolHandlers.delete(input, context);
  },
});

/**
 * List preferences with optional filtering.
 */
export const prefsListTool = defineTool({
  name: 'prefs.list',
  description:
    'List all preferences for a family or person. Optionally filter by key prefix (e.g., "meals." for all meal preferences).',
  inputSchema: prefsListInputSchema,
  outputSchema: prefsListOutputSchema,
  execute: async (input, context) => {
    if (!prefsToolHandlers.list) {
      return { success: false, error: 'Prefs list handler not registered' };
    }
    return prefsToolHandlers.list(input, context);
  },
});

/**
 * Get multiple preferences in a single call.
 * Useful for agent initialization to load all relevant preferences.
 */
export const prefsGetBulkTool = defineTool({
  name: 'prefs.getBulk',
  description:
    'Get multiple preferences in a single call. Useful for loading all relevant preferences when an agent starts. Returns a map of key -> value (null if not found).',
  inputSchema: prefsGetBulkInputSchema,
  outputSchema: prefsGetBulkOutputSchema,
  execute: async (input, context) => {
    if (!prefsToolHandlers.getBulk) {
      return { success: false, error: 'Prefs getBulk handler not registered' };
    }
    return prefsToolHandlers.getBulk(input, context);
  },
});
