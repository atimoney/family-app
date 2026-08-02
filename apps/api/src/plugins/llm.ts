import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import Anthropic from '@anthropic-ai/sdk';

declare module 'fastify' {
  interface FastifyInstance {
    /** Anthropic client for the family assistant, or null when no API key is configured. */
    anthropic: Anthropic | null;
  }
}

/**
 * LLM Plugin - provides the Anthropic client used by the assistant.
 *
 * If ANTHROPIC_API_KEY is not set the assistant endpoints stay up but reply
 * with a "not configured" message instead of calling the model.
 */
const llmPlugin: FastifyPluginAsync = async (fastify) => {
  const { ANTHROPIC_API_KEY, AI_MODEL } = fastify.config;

  if (ANTHROPIC_API_KEY) {
    fastify.decorate('anthropic', new Anthropic({ apiKey: ANTHROPIC_API_KEY }));
    fastify.log.info({ model: AI_MODEL }, 'Assistant configured with Anthropic provider');
  } else {
    fastify.decorate('anthropic', null);
    fastify.log.warn('ANTHROPIC_API_KEY not set - AI assistant is disabled');
  }
};

export default fp(llmPlugin, {
  name: 'llm',
  dependencies: ['env'],
});
