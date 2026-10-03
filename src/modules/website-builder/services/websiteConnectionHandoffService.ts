import type { SupabaseClient } from '@supabase/supabase-js';
import { isUntrustedBrowserRuntime } from './trustedServerRuntime';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Provider = 'github' | 'supabase' | 'vercel' | 'stripe';
type Environment = 'preview' | 'production';

function serverOnly() {
  if (isUntrustedBrowserRuntime()) throw new Error('Connection handoff requires a trusted server.');
}

/** Vault custody lasts at most four minutes. The handle is safe to return to
 * the browser; the raw provider token is neither returned nor snapshotted. */
export async function storeWebsiteConnectionHandoff(input: {
  client: Pick<SupabaseClient, 'rpc'>;
  ownerId: string;
  projectId: string;
  provider: Provider;
  environment: Environment;
  userToken: string;
  now?: () => number;
}): Promise<string> {
  serverOnly();
  if (!uuid.test(input.ownerId) || !uuid.test(input.projectId)
    || !['github', 'supabase', 'vercel', 'stripe'].includes(input.provider)
    || !['preview', 'production'].includes(input.environment)
    || !input.userToken || input.userToken.length < 20 || new TextEncoder().encode(input.userToken).length > 65_536) {
    throw new Error('Connection handoff could not be stored.');
  }
  const id = crypto.randomUUID();
  const { error } = await input.client.rpc('website_store_connection_handoff', {
    p_id: id, p_owner_id: input.ownerId, p_project_id: input.projectId,
    p_provider: input.provider, p_environment: input.environment,
    p_token: input.userToken, p_expires_at: new Date((input.now ?? Date.now)() + 4 * 60_000).toISOString(),
  });
  if (error) throw new Error('Connection handoff could not be stored.');
  return id;
}

/** The caller must have verified the current Tayar owner session and project
 * before passing those identities. Consume is atomic, including Vault cleanup. */
export async function consumeWebsiteConnectionHandoff(input: {
  client: Pick<SupabaseClient, 'rpc'>;
  id: string;
  ownerId: string;
  projectId: string;
  provider: Provider;
  isCurrentOwner(): boolean;
}): Promise<{ environment: Environment; userToken: string }> {
  serverOnly();
  if (!uuid.test(input.id) || !uuid.test(input.ownerId) || !uuid.test(input.projectId)
    || !input.isCurrentOwner()) throw new Error('Connection handoff is unavailable.');
  const { data, error } = await input.client.rpc('website_consume_connection_handoff', {
    p_id: input.id, p_owner_id: input.ownerId, p_project_id: input.projectId, p_provider: input.provider,
  });
  if (error || !data || !['preview', 'production'].includes(data.environment)
    || typeof data.userToken !== 'string' || data.userToken.length < 20 || new TextEncoder().encode(data.userToken).length > 65_536
    || !input.isCurrentOwner()) throw new Error('Connection handoff is unavailable.');
  return { environment: data.environment, userToken: data.userToken };
}

/** Trusted chooser read. The short expiry, owner scope and service-only RPC
 * apply on every read; a browser receives only sanitized repository options. */
export async function peekWebsiteConnectionHandoff(input: {
  client: Pick<SupabaseClient, 'rpc'>;
  id: string;
  ownerId: string;
  projectId: string;
  provider: Provider;
  isCurrentOwner(): boolean;
}): Promise<{ environment: Environment; userToken: string }> {
  serverOnly();
  if (!uuid.test(input.id) || !uuid.test(input.ownerId) || !uuid.test(input.projectId)
    || !input.isCurrentOwner()) throw new Error('Connection handoff is unavailable.');
  const { data, error } = await input.client.rpc('website_peek_connection_handoff', {
    p_id: input.id, p_owner_id: input.ownerId, p_project_id: input.projectId, p_provider: input.provider,
  });
  if (error || !data || !['preview', 'production'].includes(data.environment)
    || typeof data.userToken !== 'string' || data.userToken.length < 20 || new TextEncoder().encode(data.userToken).length > 65_536
    || !input.isCurrentOwner()) throw new Error('Connection handoff is unavailable.');
  return { environment: data.environment, userToken: data.userToken };
}

export async function revokeWebsiteConnectionHandoff(input: {
  client: Pick<SupabaseClient, 'rpc'>;
  id: string;
  ownerId: string;
  projectId: string;
}): Promise<void> {
  serverOnly();
  if (!uuid.test(input.id) || !uuid.test(input.ownerId) || !uuid.test(input.projectId)) throw new Error('Connection handoff is unavailable.');
  const { error } = await input.client.rpc('website_revoke_connection_handoff', {
    p_id: input.id, p_owner_id: input.ownerId, p_project_id: input.projectId,
  });
  if (error) throw new Error('Connection handoff is unavailable.');
}
