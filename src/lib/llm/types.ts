export type { Settings as ProviderConfig } from '../storage/schema';

/**
 * @deprecated Prefer ModelMessage[] from the `ai` package. Kept only so older
 * call sites / docs that mention ChatMessage still typecheck during the
 * history-fidelity migration.
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
