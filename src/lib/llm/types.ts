export type { Settings as ProviderConfig } from '../storage/schema';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
