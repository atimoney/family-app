import { z } from 'zod';

export type LLMMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type LLMCompletionOptions = {
  temperature?: number;
  jsonMode?: boolean;
  maxTokens?: number;
};

export interface LLMProvider {
  complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<string>;
  completeJson<T>(messages: LLMMessage[], schema: z.ZodType<T>, options?: LLMCompletionOptions): Promise<T>;
}
