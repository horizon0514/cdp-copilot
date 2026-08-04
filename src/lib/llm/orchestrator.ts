import type { ModelMessage } from 'ai';
import { applyLedgerMutations, getActiveLedger } from '../ledger/activeLedger';
import {
  CONTROL_TASK_TOOL,
  taskControlSchema,
  type TaskControlAction,
} from '../tools/controlTools';
import type { AgentEvent, TurnResponseMessage } from './agentLoop';

export type AgentMode = 'root' | 'episode';

export type AgentRunner = (
  messages: ModelMessage[],
  mode: AgentMode,
) => AsyncGenerator<AgentEvent>;

const DEFAULT_MAX_EPISODES = 8;

/** Read the last valid control action from one inner-loop response. */
export function controlActionFrom(messages: TurnResponseMessage[]): TaskControlAction | null {
  for (const message of [...messages].reverse()) {
    if (message.role !== 'assistant' || !Array.isArray(message.content)) continue;
    for (const part of [...message.content].reverse()) {
      if (part.type !== 'tool-call' || part.toolName !== CONTROL_TASK_TOOL) continue;
      const parsed = taskControlSchema.safeParse(part.input);
      if (parsed.success) return parsed.data;
    }
  }
  return null;
}

function episodeReportMessage(
  objective: string,
  report: Extract<TaskControlAction, { type: 'finish_episode' }>,
): ModelMessage {
  return {
    role: 'user',
    content:
      `Episode report\nObjective: ${objective}\nStatus: ${report.status}\n` +
      `Summary: ${report.summary}\nHandoff: ${report.handoffNote}\n\n` +
      'Reassess the durable ledger. If the whole goal is now met, complete it; otherwise start the next bounded episode.',
  };
}

function fallbackReport(done: Extract<AgentEvent, { type: 'done' }>): Extract<
  TaskControlAction,
  { type: 'finish_episode' }
> {
  return {
    type: 'finish_episode',
    status: done.stop.hitStepLimit ? 'partial' : 'blocked',
    summary: done.stop.hitStepLimit
      ? 'The episode reached its step limit without a structured report.'
      : 'The episode ended without a structured report.',
    handoffNote: 'Reassess the approach before dispatching another episode.',
  };
}

/**
 * Root/episode trampoline. Root history contains only the original conversation
 * and compact episode reports; browser traces stay inside fresh episode calls,
 * while durable results cross the boundary through the task ledger.
 */
export async function* orchestrateAgentEvents(
  initialMessages: ModelMessage[],
  run: AgentRunner,
  maxEpisodes = DEFAULT_MAX_EPISODES,
): AsyncGenerator<AgentEvent> {
  let rootMessages = initialMessages;
  let episodes = 0;

  while (true) {
    let rootDone: Extract<AgentEvent, { type: 'done' }> | null = null;
    let rootProducedText = false;
    for await (const event of run(rootMessages, 'root')) {
      if (event.type === 'done') rootDone = event;
      else {
        if (event.type === 'text-delta' && event.text.length > 0) rootProducedText = true;
        yield event;
      }
    }
    if (!rootDone) return;
    if (rootDone.stop.aborted) {
      yield rootDone;
      return;
    }

    const action = controlActionFrom(rootDone.responseMessages);
    if (action?.type !== 'start_episode') {
      if (action?.type === 'complete' && !rootProducedText) {
        yield { type: 'text-delta', text: action.summary };
      }
      yield rootDone;
      return;
    }
    if (episodes >= maxEpisodes) {
      yield {
        type: 'error',
        message: `Episode limit reached (${maxEpisodes}) before the task completed.`,
      };
      yield rootDone;
      return;
    }
    episodes += 1;

    let episodeDone: Extract<AgentEvent, { type: 'done' }> | null = null;
    const episodeMessages: ModelMessage[] = [{ role: 'user', content: action.objective }];
    for await (const event of run(episodeMessages, 'episode')) {
      if (event.type === 'done') episodeDone = event;
      else yield event;
    }
    if (!episodeDone) return;
    if (episodeDone.stop.aborted) {
      yield episodeDone;
      return;
    }

    const episodeAction = controlActionFrom(episodeDone.responseMessages);
    const report = episodeAction?.type === 'finish_episode'
      ? episodeAction
      : fallbackReport(episodeDone);
    if (getActiveLedger()) {
      await applyLedgerMutations([
        {
          type: 'add_note',
          text: `[Episode ${report.status}] ${report.summary} Next: ${report.handoffNote}`,
        },
      ]);
    }

    rootMessages = [
      ...rootMessages,
      ...rootDone.responseMessages,
      episodeReportMessage(action.objective, report),
    ];
  }
}
