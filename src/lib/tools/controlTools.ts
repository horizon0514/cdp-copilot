import { tool } from 'ai';
import { z } from 'zod';

/**
 * A no-op signal tool: the loop stops when the model calls it (see the
 * hasToolCall stop condition in agentLoop). It exists so a turn ends when the
 * goal is met instead of grinding to the step limit, and so the model has to
 * make "I'm done" an explicit, inspectable decision rather than trailing off.
 */
export const task_complete = tool({
  description:
    'Call this ONLY when the task goal is fully met — check it against the success criterion in your ' +
    'task ledger (e.g. the target count of findings). Calling it ends the task. Do not call it to give ' +
    'up or when blocked; instead explain the blocker in text and stop. Do not keep working after calling it.',
  inputSchema: z.object({
    summary: z
      .string()
      .describe('A short final summary of what was accomplished and where the results are (the ledger).'),
  }),
  execute: async ({ summary }) => ({ completed: true, summary }),
});
