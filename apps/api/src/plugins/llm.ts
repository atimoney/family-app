import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { configureRouter, OpenAIProvider, MockLLMProvider } from '@family/agent-core';

/**
 * LLM Plugin - Configures the agent router with the appropriate LLM provider.
 *
 * If OPENAI_API_KEY is set, uses OpenAI. Otherwise, falls back to MockLLMProvider.
 */
const llmPlugin: FastifyPluginAsync = async (fastify) => {
  const { OPENAI_API_KEY, AI_MODEL, AI_MAX_TOKENS, AI_TEMPERATURE } = fastify.config;

  if (OPENAI_API_KEY) {
    const provider = new OpenAIProvider({
      apiKey: OPENAI_API_KEY,
      model: AI_MODEL,
      maxTokens: AI_MAX_TOKENS,
      temperature: AI_TEMPERATURE,
    });

    configureRouter({ llmProvider: provider });
    fastify.log.info({ model: AI_MODEL }, 'LLM configured with OpenAI provider');
  } else {
    configureRouter({ llmProvider: new MockLLMProvider() });
    fastify.log.warn('OPENAI_API_KEY not set - using MockLLMProvider (keyword-based routing only)');
  }
};

export default fp(llmPlugin, {
  name: 'llm',
  dependencies: ['env'],
});
