import { z } from 'zod';
import type { ToolDefinition, ToolContext, ToolResult, ToolLogger } from './types.js';

// ----------------------------------------------------------------------
// TOOL REGISTRY
// ----------------------------------------------------------------------

/**
 * Registry for MCP tools.
 * Tools are registered with typed definitions and can be invoked by name.
 */
class ToolRegistry {
  private tools: Map<string, ToolDefinition<unknown, unknown>> = new Map();

  /**
   * Register a tool with the registry.
   */
  register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool as ToolDefinition<unknown, unknown>);
  }

  /**
   * Get a tool by name.
   */
  get(name: string): ToolDefinition<unknown, unknown> | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool is registered.
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all registered tool names.
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get all tool definitions (for listing/documentation).
   */
  getAllTools(): Array<{ name: string; description: string }> {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  }

  /**
   * Invoke a tool by name with input and context.
   */
  async invoke(
    toolName: string,
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    context.logger.info(
      {
        requestId: context.requestId,
        toolName,
        input,
      },
      'Tool invocation started'
    );

    const tool = this.tools.get(toolName);

    if (!tool) {
      context.logger.warn(
        { requestId: context.requestId, toolName },
        'Tool not found'
      );
      return {
        success: false,
        error: `Tool "${toolName}" not found`,
        executionMs: Date.now() - startTime,
      };
    }

    // Validate input
    const inputValidation = tool.inputSchema.safeParse(input);
    if (!inputValidation.success) {
      context.logger.warn(
        {
          requestId: context.requestId,
          toolName,
          errors: inputValidation.error.flatten(),
        },
        'Tool input validation failed'
      );
      return {
        success: false,
        error: `Input validation failed: ${inputValidation.error.message}`,
        executionMs: Date.now() - startTime,
      };
    }

    // Execute the tool
    try {
      const result = await tool.execute(inputValidation.data, context);
      const executionMs = Date.now() - startTime;

      context.logger.info(
        {
          requestId: context.requestId,
          toolName,
          success: result.success,
          executionMs,
        },
        'Tool invocation completed'
      );

      return {
        ...result,
        executionMs,
      };
    } catch (error) {
      const executionMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      context.logger.error(
        {
          requestId: context.requestId,
          toolName,
          error: errorMessage,
          executionMs,
        },
        'Tool invocation failed'
      );

      return {
        success: false,
        error: errorMessage,
        executionMs,
      };
    }
  }
}

// ----------------------------------------------------------------------
// GLOBAL REGISTRY INSTANCE
// ----------------------------------------------------------------------

export const toolRegistry = new ToolRegistry();

// ----------------------------------------------------------------------
// HELPER TO CREATE TYPE-SAFE TOOL DEFINITIONS
// ----------------------------------------------------------------------

/**
 * Helper to create a typed tool definition.
 * Ensures type safety between input schema, output schema, and execute function.
 */
export function defineTool<TInput, TOutput>(
  tool: ToolDefinition<TInput, TOutput>
): ToolDefinition<TInput, TOutput> {
  return tool;
}

// ----------------------------------------------------------------------
// BUILT-IN TOOLS
// ----------------------------------------------------------------------

/**
 * system.ping - Health check tool
 */
export const systemPingTool = defineTool({
  name: 'system.ping',
  description: 'Health check tool that returns server time and status',
  inputSchema: z.object({
    echo: z.string().optional(),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    time: z.string(),
    echo: z.string().optional(),
  }),
  execute: async (input, context) => {
    context.logger.debug(
      { requestId: context.requestId, echo: input.echo },
      'system.ping executed'
    );
    return {
      success: true,
      data: {
        ok: true,
        time: new Date().toISOString(),
        echo: input.echo,
      },
    };
  },
});

/**
 * system.listTools - List all registered tools
 */
export const systemListToolsTool = defineTool({
  name: 'system.listTools',
  description: 'List all registered tools with their descriptions',
  inputSchema: z.object({}),
  outputSchema: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
    })
  ),
  execute: async (_input, context) => {
    context.logger.debug({ requestId: context.requestId }, 'system.listTools executed');
    return {
      success: true,
      data: toolRegistry.getAllTools(),
    };
  },
});

// ----------------------------------------------------------------------
// REGISTER BUILT-IN TOOLS
// ----------------------------------------------------------------------

toolRegistry.register(systemPingTool);
toolRegistry.register(systemListToolsTool);
