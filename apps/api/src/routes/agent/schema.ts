import { z } from 'zod';
import { agentRequestSchema, pendingActionInfoSchema } from '@family/agent-core';
import { toolInvokeRequestSchema } from '@family/mcp-server';

// ----------------------------------------------------------------------
// AGENT CHAT SCHEMAS
// ----------------------------------------------------------------------

export const chatRequestSchema = agentRequestSchema;

export const chatResponseSchema = z.object({
  text: z.string(),
  actions: z.array(
    z.object({
      tool: z.string(),
      input: z.record(z.unknown()),
      result: z.object({
        success: z.boolean(),
        data: z.unknown().optional(),
        error: z.string().optional(),
        executionMs: z.number().optional(),
      }),
    })
  ),
  payload: z.record(z.unknown()).optional(),
  domain: z.enum(['tasks', 'calendar', 'meals', 'lists', 'unknown']),
  conversationId: z.string(),
  requestId: z.string(),
  requiresConfirmation: z.boolean().optional(),
  pendingAction: pendingActionInfoSchema.optional(),
});

// ----------------------------------------------------------------------
// MCP INVOKE SCHEMAS
// ----------------------------------------------------------------------

export const mcpInvokeRequestSchema = toolInvokeRequestSchema;

export const mcpInvokeResponseSchema = z.object({
  toolName: z.string(),
  requestId: z.string(),
  result: z.object({
    success: z.boolean(),
    data: z.unknown().optional(),
    error: z.string().optional(),
    executionMs: z.number().optional(),
  }),
});

// ----------------------------------------------------------------------
// MCP LIST TOOLS SCHEMA
// ----------------------------------------------------------------------

export const mcpListToolsResponseSchema = z.object({
  tools: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
    })
  ),
});
