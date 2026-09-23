export type CVSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface CVAutosaveController {
  schedule(save: () => Promise<void>): void;
  flush(): Promise<void>;
  cancel(): void;
}

export function createCVAutosaveController(delayMs = 1200): CVAutosaveController {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: (() => Promise<void>) | null = null;
  let inFlight: Promise<void> | null = null;

  const runPending = async (): Promise<void> => {
    if (inFlight) {
      await inFlight;
      if (pending) await runPending();
      return;
    }
    if (!pending) return;
    const save = pending;
    pending = null;
    const task = Promise.resolve().then(save);
    inFlight = task;
    try {
      await task;
    } finally {
      if (inFlight === task) inFlight = null;
    }
    if (pending) await runPending();
  };

  return {
    schedule(save) {
      pending = save;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void runPending().catch(() => undefined);
      }, delayMs);
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await runPending();
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}
