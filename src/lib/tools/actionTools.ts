import { tool } from 'ai';
import { z } from 'zod';
import { ensureSession } from './context';
import { clickUid, hoverUid, fillUid, typeText as typeTextImpl, pressKeyCombo } from '../input/dispatchInput';

export const click = tool({
  description: 'Clicks on the provided element.',
  inputSchema: z.object({
    uid: z.string().describe('The uid of an element from the last take_snapshot call'),
    dblClick: z.boolean().optional().describe('Set to true for double clicks. Default false.'),
  }),
  execute: async ({ uid, dblClick }) => {
    const session = await ensureSession();
    await clickUid(session, uid, dblClick ?? false);
    return { ok: true };
  },
});

export const hover = tool({
  description: 'Hovers over the provided element.',
  inputSchema: z.object({
    uid: z.string().describe('The uid of an element from the last take_snapshot call'),
  }),
  execute: async ({ uid }) => {
    const session = await ensureSession();
    await hoverUid(session, uid);
    return { ok: true };
  },
});

export const fill = tool({
  description:
    'Sets the value of an input, textarea, or contenteditable element, replacing any existing content.',
  inputSchema: z.object({
    uid: z.string().describe('The uid of an element from the last take_snapshot call'),
    value: z.string().describe('The value to set'),
  }),
  execute: async ({ uid, value }) => {
    const session = await ensureSession();
    await fillUid(session, uid, value);
    return { ok: true };
  },
});

export const fill_form = tool({
  description: 'Fills out multiple form elements at once. Prefer this over multiple individual fill calls.',
  inputSchema: z.object({
    elements: z.array(z.object({ uid: z.string(), value: z.string() })).min(1),
  }),
  execute: async ({ elements }) => {
    const session = await ensureSession();
    for (const el of elements) {
      await fillUid(session, el.uid, el.value);
    }
    return { ok: true, count: elements.length };
  },
});

export const type_text = tool({
  description:
    'Types text via real keyboard events into whatever element is currently focused. Use fill() instead ' +
    'when you just need to set a field value; use this for search-as-you-type / autocomplete widgets.',
  inputSchema: z.object({
    text: z.string(),
    submitKey: z.string().optional().describe('Optional key to press after typing, e.g. "Enter"'),
  }),
  execute: async ({ text, submitKey }) => {
    const session = await ensureSession();
    await typeTextImpl(session, text, submitKey);
    return { ok: true };
  },
});

export const press_key = tool({
  description: 'Presses a key or key combination, e.g. "Enter", "Control+A", "Escape".',
  inputSchema: z.object({
    key: z.string(),
  }),
  execute: async ({ key }) => {
    const session = await ensureSession();
    await pressKeyCombo(session, key);
    return { ok: true };
  },
});
