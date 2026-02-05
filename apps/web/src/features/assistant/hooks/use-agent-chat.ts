import type { ChatMessage, QuickAction, Conversation, AgentResponse } from '../types';

import { useRef, useState, useEffect, useCallback } from 'react';

import { sendAgentMessage, confirmAgentAction } from '../api';

// ----------------------------------------------------------------------
// STORAGE KEY FOR LOCALSTORAGE PERSISTENCE
// ----------------------------------------------------------------------

const STORAGE_KEY = 'family-assistant-conversation';

// ----------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function generateConversationId(): string {
  return crypto.randomUUID();
}

function createEmptyConversation(): Conversation {
  const now = new Date().toISOString();
  return {
    id: generateConversationId(),
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function loadConversation(): Conversation {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as Conversation;
    }
  } catch (error) {
    console.warn('[useAgentChat] Failed to load conversation from storage:', error);
  }
  return createEmptyConversation();
}

function saveConversation(conversation: Conversation): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversation));
  } catch (error) {
    console.warn('[useAgentChat] Failed to save conversation to storage:', error);
  }
}

function clearStoredConversation(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('[useAgentChat] Failed to clear conversation from storage:', error);
  }
}

function createUserMessage(content: string): ChatMessage {
  return {
    id: generateId(),
    role: 'user',
    content,
    timestamp: new Date().toISOString(),
    status: 'sending',
  };
}

function createAssistantMessage(response: AgentResponse): ChatMessage {
  return {
    id: generateId(),
    role: 'assistant',
    content: response.text,
    timestamp: new Date().toISOString(),
    status: 'sent',
    domain: response.domain,
    actions: response.actions,
    payload: response.payload,
    requiresConfirmation: response.requiresConfirmation,
    pendingAction: response.pendingAction,
  };
}

function createErrorMessage(error: string): ChatMessage {
  return {
    id: generateId(),
    role: 'assistant',
    content: 'Sorry, something went wrong. Please try again.',
    timestamp: new Date().toISOString(),
    status: 'error',
    error,
  };
}

// ----------------------------------------------------------------------
// HOOK RETURN TYPE
// ----------------------------------------------------------------------

export type UseAgentChatReturn = {
  /** Current conversation */
  conversation: Conversation;
  /** All messages in the conversation */
  messages: ChatMessage[];
  /** Whether we're waiting for a response */
  isLoading: boolean;
  /** Current error, if any */
  error: string | null;
  /** Send a message to the agent */
  sendMessage: (content: string) => Promise<void>;
  /** Confirm a pending action */
  confirmAction: (token: string) => Promise<void>;
  /** Cancel a pending action (dismiss without confirming) */
  cancelAction: (messageId: string) => void;
  /** Start a new conversation */
  newConversation: () => void;
  /** Clear error state */
  clearError: () => void;
  /** Handle quick action click */
  handleQuickAction: (action: QuickAction) => Promise<void>;
};

// ----------------------------------------------------------------------
// MAIN HOOK
// ----------------------------------------------------------------------

/**
 * Hook for managing AI agent chat state.
 *
 * Features:
 * - Send messages to the agent API
 * - Handle confirmation flow for pending actions
 * - Persist conversation to localStorage
 * - Optimistic updates with error recovery
 */
export function useAgentChat(): UseAgentChatReturn {
  const [conversation, setConversation] = useState<Conversation>(() => loadConversation());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref to track if we're in the middle of processing to prevent double-sends
  const processingRef = useRef(false);

  // Save to localStorage whenever conversation changes
  useEffect(() => {
    saveConversation(conversation);
  }, [conversation]);

  // Send a message to the agent
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || processingRef.current) {
        return;
      }

      processingRef.current = true;
      setIsLoading(true);
      setError(null);

      // Create optimistic user message
      const userMessage = createUserMessage(content);

      // Add user message to conversation
      setConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        updatedAt: new Date().toISOString(),
      }));

      try {
        // Send to API with browser's timezone for accurate date/time interpretation
        const response = await sendAgentMessage({
          message: content,
          conversationId: conversation.id,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });

        // Update user message status and add assistant response
        const assistantMessage = createAssistantMessage(response);

        setConversation((prev) => ({
          ...prev,
          messages: prev.messages.map((msg) =>
            msg.id === userMessage.id ? { ...msg, status: 'sent' as const } : msg
          ).concat(assistantMessage),
          updatedAt: new Date().toISOString(),
        }));
      } catch (err) {
        console.error('[useAgentChat] Send error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        // Mark user message as error and add error response
        setConversation((prev) => ({
          ...prev,
          messages: prev.messages.map((msg) =>
            msg.id === userMessage.id ? { ...msg, status: 'error' as const } : msg
          ).concat(createErrorMessage(errorMessage)),
          updatedAt: new Date().toISOString(),
        }));

        setError(errorMessage);
      } finally {
        setIsLoading(false);
        processingRef.current = false;
      }
    },
    [conversation.id]
  );

  // Confirm a pending action
  const confirmAction = useCallback(
    async (token: string) => {
      if (processingRef.current) {
        return;
      }

      processingRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        // Include timezone for correct date/time formatting in response
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const response = await confirmAgentAction(conversation.id, token, timezone);

        // Find the message with this pending action and mark it as confirmed
        // Then add the new response
        const assistantMessage = createAssistantMessage(response);

        setConversation((prev) => ({
          ...prev,
          messages: prev.messages.map((msg) =>
            msg.pendingAction?.token === token
              ? { ...msg, requiresConfirmation: false, pendingAction: undefined }
              : msg
          ).concat(assistantMessage),
          updatedAt: new Date().toISOString(),
        }));
      } catch (err) {
        console.error('[useAgentChat] Confirm error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to confirm action';
        setError(errorMessage);

        // Add error message to conversation
        setConversation((prev) => ({
          ...prev,
          messages: [...prev.messages, createErrorMessage(errorMessage)],
          updatedAt: new Date().toISOString(),
        }));
      } finally {
        setIsLoading(false);
        processingRef.current = false;
      }
    },
    [conversation.id]
  );

  // Cancel a pending action (just dismiss, don't send to backend)
  const cancelAction = useCallback((messageId: string) => {
    setConversation((prev) => ({
      ...prev,
      messages: prev.messages.map((msg) =>
        msg.id === messageId
          ? { ...msg, requiresConfirmation: false, pendingAction: undefined }
          : msg
      ),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // Start a new conversation
  const newConversation = useCallback(() => {
    clearStoredConversation();
    setConversation(createEmptyConversation());
    setError(null);
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Handle quick action click
  const handleQuickAction = useCallback(
    async (action: QuickAction) => {
      await sendMessage(action.prompt);
    },
    [sendMessage]
  );

  return {
    conversation,
    messages: conversation.messages,
    isLoading,
    error,
    sendMessage,
    confirmAction,
    cancelAction,
    newConversation,
    clearError,
    handleQuickAction,
  };
}
