import { tool } from 'ai';
import { z } from 'zod';

export const CONTROL_TASK_TOOL = 'control_task';

export const taskControlSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('complete'),
    summary: z.string().describe('Concise final result for the user'),
  }),
  z.object({
    type: z.literal('start_episode'),
    objective: z.string().describe('One bounded sub-task for a fresh-context episode'),
    rationale: z.string().describe('Why isolating this sub-task advances the overall goal'),
  }),
  z.object({
    type: z.literal('finish_episode'),
    status: z.enum(['done', 'partial', 'blocked']),
    summary: z.string().describe('What this episode accomplished'),
    handoffNote: z.string().describe('What the root planner should do next'),
  }),
]);

export type TaskControlAction = z.infer<typeof taskControlSchema>;

/**
 * One typed control-flow boundary for both direct turns and orchestrated
 * episodes. The outer loop interprets the action; execution only acknowledges
 * it so the tool call/result pair remains valid provider history.
 */
export const control_task = tool({
  description:
    'Controls task execution through one typed action. Use complete only when the whole user goal passes ' +
    'its success criteria. Use start_episode when a bounded sub-task should run in a fresh context. Inside ' +
    'an episode, use finish_episode with done, partial, or blocked plus a handoff note. For collection tasks, ' +
    'audit evidence and remove invalid findings before completing; quantity never compensates for quality.',
  inputSchema: taskControlSchema,
  execute: async (action) => ({ accepted: true, ...action }),
});
