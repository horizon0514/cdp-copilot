/**
 * Runs one agent turn at a time, where starting a new one means taking over
 * from whatever is running.
 *
 * The ordering is the whole point and it isn't obvious: the incoming turn has
 * to wait for the outgoing one to finish unwinding, because that's when the
 * aborted turn commits what it managed to do. Start the new turn any earlier
 * and it reads a history missing everything the user just watched happen.
 */
export interface TurnSequencer {
  /** Aborts the live turn, waits for it to settle, then runs `turn`. */
  takeOver(turn: (signal: AbortSignal) => Promise<void>): Promise<void>;
  /** Stops the live turn without starting another. */
  abort(): void;
  isRunning(): boolean;
}

export function createTurnSequencer(): TurnSequencer {
  let live: { controller: AbortController; settled: Promise<void> } | null = null;

  return {
    async takeOver(turn) {
      if (live) {
        live.controller.abort();
        // A turn is expected to handle its own failures; swallowing here only
        // stops a rejected predecessor from cancelling its successor.
        await live.settled.catch(() => {});
      }

      const controller = new AbortController();
      const settled = turn(controller.signal);
      live = { controller, settled };
      try {
        await settled;
      } finally {
        // A later takeOver may already have replaced it — don't clear theirs.
        if (live?.controller === controller) live = null;
      }
    },

    abort() {
      live?.controller.abort();
    },

    isRunning() {
      return live !== null;
    },
  };
}
