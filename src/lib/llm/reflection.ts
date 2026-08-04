import type { ModelMessage } from 'ai';

/**
 * The loop has no natural moment to step back and ask "is this working?", so a
 * model that picks a bad approach — a clumsy search query, the wrong page —
 * tends to repeat variations of it until the step limit. Reflection injects
 * that missing checkpoint into the instructions: a periodic nudge, and a
 * sharper prompt when it detects the model spinning on the same action.
 */

/** How often to inject the gentle checkpoint. */
export const REFLECT_INTERVAL = 12;
/** How many recent tool calls to examine for a stall. */
const STALL_WINDOW = 6;
/** How many identical calls within that window counts as spinning. */
const STALL_REPEATS = 3;

const CHECKPOINT =
  'Checkpoint — reflect before continuing: look at your task ledger and judge whether the last several ' +
  'steps actually advanced the goal and whether saved findings still meet the original acceptance criteria ' +
  'with direct evidence rather than inference. Remove weak findings. If progress has stalled, change strategy ' +
  'rather than repeating variations of the same action, and record any dead end through update_task_ledger.';

const STALL =
  'You appear to be repeating the same action without new progress. Stop and rethink: the current approach ' +
  'is not working. Try a materially different tactic — a different search query or source, a different tool, ' +
  'or re-reading what you already have — and record the dead end in the task ledger so you don’t loop back to it.';

interface ToolCallSig {
  name: string;
  input: string;
}

/** Pull tool-call signatures (name + serialized input) in order from history. */
function toolCallSignatures(messages: ModelMessage[]): ToolCallSig[] {
  const sigs: ToolCallSig[] = [];
  for (const message of messages) {
    if (message.role !== 'assistant' || !Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (part.type === 'tool-call') {
        sigs.push({ name: part.toolName, input: JSON.stringify(part.input ?? {}) });
      }
    }
  }
  return sigs;
}

/**
 * True when the recent window contains STALL_REPEATS calls that are byte-for-byte
 * identical (same tool, same input) — the clearest machine-detectable sign of a
 * model looping. Reading the page twice is fine; issuing the exact same call
 * three times in six is not.
 */
export function isStalling(messages: ModelMessage[]): boolean {
  const recent = toolCallSignatures(messages).slice(-STALL_WINDOW);
  const counts = new Map<string, number>();
  for (const sig of recent) {
    const key = `${sig.name}:${sig.input}`;
    const next = (counts.get(key) ?? 0) + 1;
    if (next >= STALL_REPEATS) return true;
    counts.set(key, next);
  }
  return false;
}

/**
 * The reflection note for this step, or null when none is due. `history` should
 * be the accumulated response messages (unaffected by context compaction) so
 * stall detection sees the real action sequence.
 */
export function reflectionNote(stepNumber: number, history: ModelMessage[]): string | null {
  if (isStalling(history)) return STALL;
  // stepNumber is 0-based; fire at 12, 24, … but never on the first step.
  if (stepNumber > 0 && stepNumber % REFLECT_INTERVAL === 0) return CHECKPOINT;
  return null;
}
