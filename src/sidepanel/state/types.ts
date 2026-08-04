import type { StopInfo } from '../../lib/llm/agentLoop';

export interface DisplayToolCall {
  id: string;
  name: string;
  args: unknown;
  status: 'running' | 'done' | 'error' | 'aborted';
  result?: unknown;
  error?: string;
}

/** Ordered transcript pieces so tools and text stay interleaved. */
export type DisplayPart =
  | { type: 'text'; text: string }
  | { type: 'tool'; id: string };

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  toolCalls: DisplayToolCall[];
  /** Chronological text/tool order. Absent on legacy persisted threads. */
  parts?: DisplayPart[];
  error?: string;
  stop?: StopInfo;
}
