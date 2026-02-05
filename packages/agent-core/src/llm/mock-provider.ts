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
      // Detect multi-intent patterns (e.g., "X and Y", "X, also Y")
      const multiIntentPatterns = [
        /\band\b.*\b(task|todo|calendar|event|meal|cook|buy|list|shopping)\b/i,
        /\b(task|todo|calendar|event|meal|cook|buy|list|shopping)\b.*\band\b/i,
        /,\s*(also|and|plus)\b/i,
      ];
      
      const hasMultiIntent = multiIntentPatterns.some(p => p.test(lastMsg));
      
      // Determine which domains are mentioned
      const detectedDomains: Array<'tasks' | 'calendar' | 'meals' | 'lists'> = [];
      if (lastMsg.includes('task') || lastMsg.includes('todo') || lastMsg.includes('remind')) {
        detectedDomains.push('tasks');
      }
      if (lastMsg.includes('calendar') || lastMsg.includes('event') || lastMsg.includes('schedule') || lastMsg.includes('appointment')) {
        detectedDomains.push('calendar');
      }
      if (lastMsg.includes('meal') || lastMsg.includes('cook') || lastMsg.includes('recipe') || lastMsg.includes('dinner') || lastMsg.includes('lunch')) {
        detectedDomains.push('meals');
      }
      if (lastMsg.includes('buy') || lastMsg.includes('list') || lastMsg.includes('shopping') || lastMsg.includes('grocery') || lastMsg.includes('groceries')) {
        detectedDomains.push('lists');
      }
      
      // If multi-intent detected with multiple domains
      if (hasMultiIntent && detectedDomains.length > 1) {
        return {
          domain: detectedDomains[0],
          confidence: 0.85,
          reasons: ['Multi-intent detected via keyword matching'],
          isMultiIntent: true,
          multiDomains: detectedDomains,
        } as unknown as T;
      }
      
      // Single domain routing
      if (detectedDomains.length > 0) {
        return {
          domain: detectedDomains[0],
          confidence: 0.9,
          reasons: ['Keyword match'],
          isMultiIntent: false,
          multiDomains: undefined,
        } as unknown as T;
      }
      
      // Unknown domain
      return {
        domain: 'unknown',
        confidence: 0.5,
        reasons: ['No keyword match'],
        isMultiIntent: false,
        multiDomains: undefined,
      } as unknown as T;
    }
    
    throw new Error('Mock response not implemented for this schema');
  }

  private delay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, this.latencyMs));
  }
}
