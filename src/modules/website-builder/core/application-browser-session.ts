import type { SupabaseClient } from '@supabase/supabase-js';
import { assertApplicationOriginScope } from './application-origin';

export interface ApplicationBrowserSessionOptions {
  projectId: string;
  ownerId: string;
  applicationOrigin: string;
  platformOrigin: string;
}

/** Opt-in on a deployed isolated origin. Cross-tab Web Locks serialize cookie
 * responses; each queued task reads the latest persisted session under the lock.
 * Refresh tokens never leave the dedicated Auth client for the bridge endpoint.
 */
export function createApplicationBrowserSessionBridge(client: Pick<SupabaseClient, 'auth'>, options: ApplicationBrowserSessionOptions) {
  const { projectId, ownerId, applicationOrigin, platformOrigin } = options;
  assertApplicationOriginScope(applicationOrigin, projectId, platformOrigin);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId)
    || typeof window === 'undefined' || window.location.origin !== applicationOrigin || !navigator.locks) {
    throw new Error('Application session synchronization requires its isolated browser origin.');
  }
  const endpoint = `${applicationOrigin}/api/application-session?ownerId=${ownerId}&projectId=${projectId}`;
  const locks = navigator.locks;
  let disposed = false;
  let scheduled: ReturnType<typeof setTimeout> | undefined;
  let lastError = false;
  const controllers = new Set<AbortController>();
  const unavailable = () => new Error('Application session synchronization is unavailable.');
  async function synchronize(): Promise<void> {
    if (disposed) throw unavailable();
    if (scheduled !== undefined) { clearTimeout(scheduled); scheduled = undefined; }
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      await locks.request(`tayar-app-navigation:${projectId}`, { mode: 'exclusive', signal: controller.signal }, async () => {
        if (disposed || controller.signal.aborted) throw unavailable();
        const result = await client.auth.getSession();
        if (result.error || disposed || controller.signal.aborted) throw unavailable();
        const token = result.data.session?.access_token;
        if (token && (token.length > 3500 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))) throw unavailable();
        const response = await fetch(endpoint, { method: token ? 'POST' : 'DELETE', credentials: 'same-origin',
          headers: token ? { authorization: `Bearer ${token}` } : {}, redirect: 'error', cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok || disposed) throw unavailable();
        const body = await response.json();
        if (body.status !== (token ? 'synchronized' : 'signed-out')) throw unavailable();
      });
      lastError = false;
    } catch { lastError = true; throw unavailable(); }
    finally { clearTimeout(timeout); controllers.delete(controller); }
  }
  const subscription = client.auth.onAuthStateChange(() => {
    // Never await Auth calls inside its callback (the SDK holds an Auth lock).
    if (disposed || scheduled !== undefined) return;
    scheduled = setTimeout(() => { scheduled = undefined; void synchronize().catch(() => { /* exposed through status and explicit navigation synchronization */ }); }, 0);
  }).data.subscription;
  return {
    synchronize,
    status: () => ({ disposed, unavailable: lastError }),
    dispose() {
      disposed = true;
      subscription.unsubscribe();
      if (scheduled !== undefined) clearTimeout(scheduled);
      controllers.forEach(controller => controller.abort());
    },
  };
}
