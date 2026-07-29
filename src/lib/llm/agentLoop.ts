import { streamText, stepCountIs, type ModelMessage } from 'ai';
import { tools } from '../tools';
import { resolveModel } from './providers';
import { Settings } from '../storage/schema';
import { ChatMessage } from './types';

export type AgentEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; toolCallId: string; name: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; name: string; result: unknown }
  | { type: 'tool-error'; toolCallId: string; name: string; error: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

const SYSTEM_PROMPT = `You are cdp-copilot, a browser copilot with tools to read and automate the current Chrome tab
via the Chrome DevTools Protocol. Always call take_snapshot before clicking/filling elements you haven't
just seen, since uids only stay valid until the next snapshot. Prefer fill_form over multiple individual
fill calls. If a tool call fails because a uid is stale or an element isn't visible, take a fresh snapshot
and retry rather than guessing.`;

const MAX_STEPS = 20;

export async function* runAgentTurn(
  settings: Settings,
  history: ChatMessage[],
  userMessage: string,
): AsyncGenerator<AgentEvent> {
  const messages: ModelMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content }) as ModelMessage),
    { role: 'user', content: userMessage },
  ];

  try {
    const model = resolveModel(settings);
    const result = streamText({
      model,
      messages,
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
    });

    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          yield { type: 'text-delta', text: part.text };
          break;
        case 'tool-call':
          yield { type: 'tool-call', toolCallId: part.toolCallId, name: part.toolName, args: part.input };
          break;
        case 'tool-result':
          yield { type: 'tool-result', toolCallId: part.toolCallId, name: part.toolName, result: part.output };
          break;
        case 'tool-error':
          yield {
            type: 'tool-error',
            toolCallId: part.toolCallId,
            name: part.toolName,
            error: part.error instanceof Error ? part.error.message : String(part.error),
          };
          break;
        case 'error':
          yield { type: 'error', message: part.error instanceof Error ? part.error.message : String(part.error) };
          break;
        default:
          break;
      }
    }
    yield { type: 'done' };
  } catch (err) {
    yield { type: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}
