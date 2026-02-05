import { z } from 'zod';
import type { LLMProvider, LLMMessage, LLMCompletionOptions } from './types.js';

export class MockLLMProvider implements LLMProvider {
  constructor(private latencyMs: number = 200) {}

  async complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<string> {
    await this.delay();
    return "I am a mock LLM. I haven't been implemented yet.";
  }

  async completeJson<T>(messages: LLMMessage[], schema: z.ZodType<T>, options?: LLMCompletionOptions): Promise<T> {
    await this.delay();
    
    // Simple heuristic-based mocking for happy path testing
    // In production, this would call OpenAI/Anthropic
    const lastMsg = messages[messages.length - 1].content.toLowerCase();
    
    // Very basic mocking logic for demonstration
    // This allows the "router" to work without a real LLM for simple cases
    if (schema.description === 'Intent Routing') {
       if (lastMsg.includes('task') || lastMsg.includes('todo')) return { domain: 'tasks', confidence: 0.9, reasons: ['keyword match'] } as unknown as T;
       if (lastMsg.includes('calendar') || lastMsg.includes('event')) return { domain: 'calendar', confidence: 0.9, reasons: ['keyword match'] } as unknown as T;
       if (lastMsg.includes('meal') || lastMsg.includes('cook')) return { domain: 'meals', confidence: 0.9, reasons: ['keyword match'] } as unknown as T;
       if (lastMsg.includes('buy') || lastMsg.includes('list')) return { domain: 'lists', confidence: 0.9, reasons: ['keyword match'] } as unknown as T;
       return { domain: 'unknown', confidence: 0.5, reasons: ['no key match'] } as unknown as T;
    }
    
    throw new Error('Mock response not implemented for this schema');
  }

  private delay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, this.latencyMs));
  }
}
