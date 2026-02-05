import type { AgentRequest, AgentResponse } from './types';

import { apiClient } from 'src/lib/api-client';

// ----------------------------------------------------------------------
// AGENT API ENDPOINT
// ----------------------------------------------------------------------

const AGENT_CHAT_ENDPOINT = '/agent/chat';

// ----------------------------------------------------------------------
// API FUNCTIONS
// ----------------------------------------------------------------------

/**
 * Send a message to the AI agent.
 *
 * @param request - The agent request containing message and optional conversation context
 * @returns The agent response with text, actions, and optional confirmation info
 */
export async function sendAgentMessage(request: AgentRequest): Promise<AgentResponse> {
  return apiClient.post<AgentResponse>(AGENT_CHAT_ENDPOINT, request);
}

/**
 * Confirm a pending action.
 *
 * @param conversationId - The conversation ID for context continuity
 * @param confirmationToken - The token from the pending action
 * @param timezone - User's timezone for correct date/time formatting in response
 * @returns The agent response after executing the confirmed action
 */
export async function confirmAgentAction(
  conversationId: string,
  confirmationToken: string,
  timezone?: string
): Promise<AgentResponse> {
  return apiClient.post<AgentResponse>(AGENT_CHAT_ENDPOINT, {
    message: '', // Empty message for confirmation
    conversationId,
    confirmationToken,
    confirmed: true,
    timezone,
  });
}

/**
 * Cancel a pending action (optional - just sends a cancel message).
 *
 * @param conversationId - The conversation ID for context continuity
 * @returns The agent response acknowledging cancellation
 */
export async function cancelAgentAction(conversationId: string): Promise<AgentResponse> {
  return apiClient.post<AgentResponse>(AGENT_CHAT_ENDPOINT, {
    message: 'cancel',
    conversationId,
  });
}
