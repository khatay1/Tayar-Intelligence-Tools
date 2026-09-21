/** Only the latest request in a mounted view may update its state. */
export function createLatestAsyncRequest<T>(commit: (value: T) => void, fail: (error: unknown) => void) {
  let sequence = 0;
  return {
    invalidate() { sequence += 1; },
    async run(request: () => PromiseLike<T>) {
      const ticket = ++sequence;
      try {
        const value = await request();
        if (ticket === sequence) commit(value);
      } catch (error) {
        if (ticket === sequence) fail(error);
      }
    },
  };
}
