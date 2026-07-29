import { DebuggerSession } from '../debugger-bridge/DebuggerSession';
import { resolveElement } from '../snapshot/resolveElement';
import { parseKeyCombo, KeyDescriptor } from './keyTable';

async function dispatchKey(
  session: DebuggerSession,
  type: 'keyDown' | 'keyUp' | 'rawKeyDown' | 'char',
  descriptor: KeyDescriptor,
  modifiers = 0,
): Promise<void> {
  await session.send('Input.dispatchKeyEvent', {
    type,
    key: descriptor.key,
    code: descriptor.code,
    windowsVirtualKeyCode: descriptor.windowsVirtualKeyCode,
    nativeVirtualKeyCode: descriptor.windowsVirtualKeyCode,
    text: type === 'char' ? descriptor.text ?? descriptor.key : undefined,
    unmodifiedText: type === 'char' ? descriptor.text ?? descriptor.key : undefined,
    modifiers,
  });
}

export async function pressKeyCombo(session: DebuggerSession, combo: string): Promise<void> {
  const { descriptor, modifiers } = parseKeyCombo(combo);
  await dispatchKey(session, 'rawKeyDown', descriptor, modifiers);
  if (descriptor.text) await dispatchKey(session, 'char', descriptor, modifiers);
  await dispatchKey(session, 'keyUp', descriptor, modifiers);
}

async function selectAll(session: DebuggerSession): Promise<void> {
  const isMac = navigator.platform.toLowerCase().includes('mac');
  await pressKeyCombo(session, isMac ? 'Meta+a' : 'Control+a');
}

async function moveAndClick(
  session: DebuggerSession,
  center: { x: number; y: number },
  clickCount: 1 | 2,
): Promise<void> {
  await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: center.x, y: center.y });
  await session.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: center.x,
    y: center.y,
    button: 'left',
    clickCount,
  });
  await session.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: center.x,
    y: center.y,
    button: 'left',
    clickCount,
  });
}

export async function clickUid(session: DebuggerSession, uid: string, dblClick = false): Promise<void> {
  const { center } = await resolveElement(session, uid);
  await moveAndClick(session, center, dblClick ? 2 : 1);
}

export async function hoverUid(session: DebuggerSession, uid: string): Promise<void> {
  const { center } = await resolveElement(session, uid);
  await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: center.x, y: center.y });
}

/** "Set the value" semantics: focus, clear existing content, insert new text
 * in one shot. (Plain Input.insertText after a focus click would append to
 * existing content rather than replace it — must select-all first.) */
export async function fillUid(session: DebuggerSession, uid: string, value: string): Promise<void> {
  const { center } = await resolveElement(session, uid);
  await moveAndClick(session, center, 1);
  await selectAll(session);
  await session.send('Input.insertText', { text: value });
}

/** Real per-character typing into whatever is already focused — distinct
 * from `fill`'s "set value directly" semantics. */
export async function typeText(session: DebuggerSession, text: string, submitKey?: string): Promise<void> {
  for (const ch of text) {
    const descriptor: KeyDescriptor = {
      key: ch,
      code: /[a-zA-Z0-9]/.test(ch) ? `Key${ch.toUpperCase()}` : ch,
      windowsVirtualKeyCode: ch.toUpperCase().charCodeAt(0),
      text: ch,
    };
    await dispatchKey(session, 'keyDown', descriptor);
    await dispatchKey(session, 'char', descriptor);
    await dispatchKey(session, 'keyUp', descriptor);
  }
  if (submitKey) await pressKeyCombo(session, submitKey);
}
