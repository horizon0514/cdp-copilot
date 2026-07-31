import type { StopInfo } from '../../lib/llm/agentLoop';

export interface DisplayToolCall {
  id: string;
  name: string;
  args: unknown;
  status: 'running' | 'done' | 'error' | 'aborted';
  result?: unknown;
  error?: string;
}

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  toolCalls: DisplayToolCall[];
  error?: string;
  stop?: StopInfo;
}
