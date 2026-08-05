import { tool } from 'ai';
import { z } from 'zod';

export const CONTROL_TASK_TOOL = 'control_task';

/**
 * Providers like DeepSeek reject top-level `anyOf` tool schemas
 * ("type: object" required). Keep a single object shape for the wire format
 * and narrow to the typed action after parse.
 */
const taskControlObjectSchema = z.object({
  type: z
    .enum(['complete', 'start_episode', 'finish_episode'])
    .describe('Which control action to take'),
  summary: z
    .string()
    .optional()
    .describe('For complete / finish_episode: concise result or episode summary'),
  objective: z
    .string()
    .optional()
    .describe('For start_episode: one bounded sub-task for a fresh-context episode'),
  rationale: z
    .string()
    .optional()
    .describe('For start_episode: why isolating this sub-task advances the overall goal'),
  status: z
    .enum(['done', 'partial', 'blocked'])
    .optional()
    .describe('For finish_episode: whether the episode finished, partially finished, or blocked'),
  handoffNote: z
    .string()
    .optional()
    .describe('For finish_episode: what the root planner should do next'),
});

export type TaskControlAction =
  | { type: 'complete'; summary: string }
  | { type: 'start_episode'; objective: string; rationale: string }
  | {
      type: 'finish_episode';
      status: 'done' | 'partial' | 'blocked';
      summary: string;
      handoffNote: string;
    };

function requireString(
  value: string | undefined,
  path: string,
  ctx: z.RefinementCtx,
): value is string {
  if (value != null && value.length > 0) return true;
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: `${path} is required` });
  return false;
}

export const taskControlSchema = taskControlObjectSchema
  .superRefine((value, ctx) => {
    if (value.type === 'complete') {
      requireString(value.summary, 'summary', ctx);
      return;
    }
    if (value.type === 'start_episode') {
      requireString(value.objective, 'objective', ctx);
      requireString(value.rationale, 'rationale', ctx);
      return;
    }
    if (!value.status) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message: 'status is required',
      });
    }
    requireString(value.summary, 'summary', ctx);
    requireString(value.handoffNote, 'handoffNote', ctx);
  })
  .transform((value): TaskControlAction => {
    if (value.type === 'complete') {
      return { type: 'complete', summary: value.summary! };
    }
    if (value.type === 'start_episode') {
      return { type: 'start_episode', objective: value.objective!, rationale: value.rationale! };
    }
    return {
      type: 'finish_episode',
      status: value.status!,
      summary: value.summary!,
      handoffNote: value.handoffNote!,
    };
  });

/**
 * One typed control-flow boundary for both direct turns and orchestrated
 * episodes. The outer loop interprets the action; execution only acknowledges
 * it so the tool call/result pair remains valid provider history.
 */
export const control_task = tool({
  description:
    'Controls task execution through one typed action. Use complete only when the whole user goal passes ' +
    'its success criteria. Use start_episode when a bounded sub-task should run in a fresh context. Inside ' +
    'an episode, use finish_episode with done, partial, or blocked plus a handoff note. Before completing, ' +
    'drop findings that no longer meet the goal; quantity never compensates for quality.',
  inputSchema: taskControlObjectSchema,
  execute: async (raw) => {
    const action = taskControlSchema.parse(raw);
    return { accepted: true, ...action };
  },
});
