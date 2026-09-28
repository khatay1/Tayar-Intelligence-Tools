import type { SupabaseClient } from '@supabase/supabase-js';
import { createIsolatedApplicationClient, type ApplicationPublicBackend } from './application-data-runtime';
import { createApplicationBrowserSessionBridge, type ApplicationBrowserSessionOptions } from './application-browser-session';
import { assertApplicationOriginScope } from './application-origin';

export interface ApplicationAuthScreenConfig extends ApplicationBrowserSessionOptions {
  backend: ApplicationPublicBackend;
  platformUrl: string;
  returnPath: string;
  signUpEnabled: boolean;
  language: 'en' | 'ar' | 'sv';
  roles?: Array<{ id: string; name: string }>;
}
export type ApplicationAuthState = 'signed-out' | 'signed-in' | 'verification-sent' | 'reset-sent' | 'recovery' | 'password-updated';

/** Browser-side account flow only. Server authorization remains authoritative.
 * Dependencies can be supplied by tests without simulating server permission. */
export function createApplicationAuthController(input: ApplicationAuthScreenConfig, dependencies?: {
  client: Pick<SupabaseClient, 'auth'> & Partial<Pick<SupabaseClient, 'rpc'>>;
  bridge: { synchronize(): Promise<void>; dispose(): void };
}) {
  const config = { ...input, backend: { ...input.backend } };
  assertApplicationOriginScope(config.applicationOrigin, config.projectId, config.platformOrigin);
  const destination = new URL(config.returnPath, config.applicationOrigin);
  const prefix = `/site/${config.ownerId}/${config.projectId}/`;
  if (!config.returnPath.startsWith(prefix) || destination.origin !== config.applicationOrigin || destination.search || destination.hash
    || !destination.pathname.startsWith(prefix) || /[%\\]/.test(config.returnPath.replace(/%[a-f0-9]{2}/gi, ''))) throw new Error('Invalid application return path.');
  const client = dependencies?.client ?? createIsolatedApplicationClient(config.backend, config.platformUrl);
  const bridge = dependencies?.bridge ?? createApplicationBrowserSessionBridge(client, config);
  let disposed = false, busy = false, state: ApplicationAuthState = 'signed-out';
  const unavailable = () => new Error('The account request could not be completed. Please try again.');
  const subscription = client.auth.onAuthStateChange(event => {
    if (!disposed && event === 'PASSWORD_RECOVERY') state = 'recovery';
    if (!disposed && event === 'SIGNED_OUT') state = 'signed-out';
  }).data.subscription;
  const run = async <T>(action: () => Promise<T>): Promise<T> => {
    if (disposed || busy) throw unavailable();
    busy = true;
    try { const result = await action(); if (disposed) throw unavailable(); return result; }
    catch { throw unavailable(); }
    finally { busy = false; }
  };
  const checked = <T extends { error: unknown }>(result: T): T => { if (result.error || disposed) throw unavailable(); return result; };
  const email = (value: string) => { if (!value.trim() || value.length > 320) throw unavailable(); return value.trim(); };
  const password = (value: string) => { if (!value || value.length > 4096) throw unavailable(); return value; };
  const verifiedUser = async () => {
    const user = checked(await client.auth.getUser()).data.user;
    if (!user || user.is_anonymous) throw unavailable();
    return user.id;
  };
  const activeUser = async () => {
    if (state !== 'signed-in' && state !== 'password-updated') throw unavailable();
    return verifiedUser();
  };
  const roleAdministrator = async () => {
    if (!config.roles?.length || !client.rpc) throw unavailable();
    const userId = await activeUser();
    if (checked(await client.rpc('app_is_role_admin')).data !== true) throw unavailable();
    return userId;
  };
  const callback = new URL(destination); callback.searchParams.set('applicationAuth', '1');
  return {
    status: () => ({ state, busy, disposed }),
    initialize: () => run(async () => {
      const session = checked(await client.auth.getSession()).data.session;
      if (state === 'recovery') return state;
      if (!session) { state = 'signed-out'; return state; }
      // Synchronization verifies the access token upstream; getSession alone is not authorization.
      state = 'signed-out';
      await bridge.synchronize(); await verifiedUser(); state = 'signed-in'; return state;
    }),
    signIn: (address: string, secret: string) => run(async () => {
      checked(await client.auth.signInWithPassword({ email: email(address), password: password(secret) }));
      state = 'signed-out';
      await bridge.synchronize(); await verifiedUser(); state = 'signed-in'; return state;
    }),
    signUp: (address: string, secret: string) => run(async () => {
      if (!config.signUpEnabled) throw unavailable();
      const { data } = checked(await client.auth.signUp({ email: email(address), password: password(secret), options: { emailRedirectTo: callback.href } }));
      if (data.session) { state = 'signed-out'; await bridge.synchronize(); await verifiedUser(); state = 'signed-in'; }
      else state = 'verification-sent';
      return state;
    }),
    requestReset: (address: string) => run(async () => {
      const redirect = new URL(callback); redirect.searchParams.set('recovery', '1');
      checked(await client.auth.resetPasswordForEmail(email(address), { redirectTo: redirect.href }));
      state = 'reset-sent'; return state;
    }),
    updatePassword: (secret: string) => run(async () => {
      if (state !== 'recovery') throw unavailable();
      checked(await client.auth.updateUser({ password: password(secret) }));
      await bridge.synchronize(); await verifiedUser(); state = 'password-updated'; return state;
    }),
    signOut: () => run(async () => {
      checked(await client.auth.signOut({ scope: 'local' }));
      await bridge.synchronize(); state = 'signed-out'; return state;
    }),
    prepareNavigation: () => run(async () => {
      if (state !== 'signed-in' && state !== 'password-updated') throw unavailable();
      if (!checked(await client.auth.getSession()).data.session) { state = 'signed-out'; throw unavailable(); }
      await bridge.synchronize();
      try { await verifiedUser(); } catch { state = 'signed-out'; throw unavailable(); }
      return destination.href;
    }),
    currentUserId: () => run(activeUser),
    roleAdministration: () => run(async () => ({ userId: await roleAdministrator() })),
    setUserRole: (userId: string, roleId: string, enabled: boolean) => run(async () => {
      await roleAdministrator();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
        || !config.roles?.some(role => role.id === roleId) || typeof enabled !== 'boolean') throw unavailable();
      checked(await client.rpc!('app_set_user_role', { target_user: userId, requested_role: roleId, enabled }));
    }),
    dispose() {
      if (disposed) return;
      disposed = true; subscription.unsubscribe(); bridge.dispose();
      if (!dependencies) void client.auth.stopAutoRefresh().catch(() => {});
    },
  };
}
