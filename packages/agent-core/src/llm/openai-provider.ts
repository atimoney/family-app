import OpenAI from 'openai';
import { z } from 'zod';
import type { LLMProvider, LLMMessage, LLMCompletionOptions } from './types.js';

export type OpenAIProviderConfig = {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
};

/**
 * OpenAI LLM Provider implementation.
 * Uses the OpenAI API for completions.
 */
export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(config: OpenAIProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
    this.model = config.model ?? 'gpt-4o';
    this.defaultMaxTokens = config.maxTokens ?? 1024;
    this.defaultTemperature = config.temperature ?? 0.7;
  }

  /**
   * Complete a conversation and return plain text.
   */
  async complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
      temperature: options?.temperature ?? this.defaultTemperature,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned empty response');
    }

    return content;
  }

  /**
   * Complete a conversation and return structured JSON validated against a schema.
   * Uses OpenAI's JSON mode for reliable structured output.
   */
  async completeJson<T>(
    messages: LLMMessage[],
    schema: z.ZodType<T>,
    options?: LLMCompletionOptions
  ): Promise<T> {
    // Add instruction to return JSON
    const systemMessage = messages.find((m) => m.role === 'system');
    const jsonInstruction = `\n\nYou MUST respond with valid JSON only. No markdown, no explanations, just the JSON object.`;

    const messagesWithJsonHint: LLMMessage[] = systemMessage
      ? messages.map((m) =>
          m.role === 'system' ? { ...m, content: m.content + jsonInstruction } : m
        )
      : [{ role: 'system', content: jsonInstruction }, ...messages];

    console.log('[OpenAI] completeJson messages:', JSON.stringify(messagesWithJsonHint, null, 2));

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messagesWithJsonHint.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
      temperature: options?.temperature ?? this.defaultTemperature,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    console.log('[OpenAI] completeJson response:', content);
    if (!content) {
      throw new Error('OpenAI returned empty response');
    }

    // Parse and validate against schema
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new Error(`OpenAI returned invalid JSON: ${content}`);
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `OpenAI response failed schema validation: ${result.error.message}\nResponse: ${content}`
      );
    }

    return result.data;
  }
}
