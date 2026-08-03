import { describe, expect, it } from 'vitest';
import { createTurnSequencer } from './turnSequencer';

/** A turn that runs until aborted, recording the order things happened in. */
function slowTurn(log: string[], name: string, onSettle?: () => void) {
  return (signal: AbortSignal) =>
    new Promise<void>((resolve) => {
      log.push(`${name}:start`);
      if (signal.aborted) {
        log.push(`${name}:commit`);
        onSettle?.();
        resolve();
        return;
      }
      signal.addEventListener('abort', () => {
        // Unwinding is async in the real turn (commit, cleanup, persist).
        setTimeout(() => {
          log.push(`${name}:commit`);
          onSettle?.();
          resolve();
        }, 5);
      });
    });
}

describe('createTurnSequencer', () => {
  it('lets the outgoing turn commit before the incoming one starts', async () => {
    const log: string[] = [];
    const sequencer = createTurnSequencer();

    const first = sequencer.takeOver(slowTurn(log, 'first'));
    const second = sequencer.takeOver(slowTurn(log, 'second'));

    // The second turn ends the first, so only it needs stopping to finish.
    setTimeout(() => sequencer.abort(), 20);
    await Promise.all([first, second]);

    // Reading history any earlier than 'first:commit' would miss the aborted turn.
    expect(log).toEqual(['first:start', 'first:commit', 'second:start', 'second:commit']);
  });

  it('reports running state and clears it once the turn settles', async () => {
    const log: string[] = [];
    const sequencer = createTurnSequencer();
    expect(sequencer.isRunning()).toBe(false);

    const turn = sequencer.takeOver(slowTurn(log, 'only'));
    expect(sequencer.isRunning()).toBe(true);

    sequencer.abort();
    await turn;
    expect(sequencer.isRunning()).toBe(false);
  });

  it('starts the next turn even when the one it replaced rejected', async () => {
    const log: string[] = [];
    const sequencer = createTurnSequencer();

    const failing = sequencer.takeOver(async () => {
      log.push('failing:start');
      throw new Error('provider exploded');
    });
    await expect(failing).rejects.toThrow('provider exploded');

    await sequencer.takeOver(async () => {
      log.push('next:start');
    });
    expect(log).toEqual(['failing:start', 'next:start']);
  });

  it('does nothing on abort when no turn is running', () => {
    expect(() => createTurnSequencer().abort()).not.toThrow();
  });
});
