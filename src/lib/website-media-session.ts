// Serialize cookie writes so a delayed sign-in cannot undo a later logout.
export function createWebsiteMediaSession(send: typeof fetch) {
  let pending = Promise.resolve();
  let revision = 0;
  return {
    sync(token: string | null): Promise<void> {
      const current = ++revision;
      pending = pending.catch(() => {}).then(async () => {
        if (current !== revision) return;
        await send('/api/website-media', {
          method: token ? 'POST' : 'DELETE', credentials: 'same-origin', cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: AbortSignal.timeout(10000),
        });
      }).catch(() => { /* A media outage must not prevent account access. */ });
      return pending;
    },
  };
}
export const websiteMediaSession = createWebsiteMediaSession((...args) => fetch(...args));
