export type { Settings as ProviderConfig } from '../storage/schema';

/**
 * Conversation turns only. The system prompt is passed separately via
 * streamText's `instructions` option, so 'system' is deliberately not a
 * valid role here.
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
