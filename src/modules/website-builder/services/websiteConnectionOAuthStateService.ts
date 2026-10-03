import type { SupabaseClient } from '@supabase/supabase-js';
import { isUntrustedBrowserRuntime } from './trustedServerRuntime';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statePattern = /^[0-9a-f]{64}$/;
const providers = ['github', 'supabase', 'vercel', 'stripe'] as const;
type Provider = typeof providers[number];
type Environment = 'preview' | 'production';

function serverOnly() {
  if (isUntrustedBrowserRuntime()) throw new Error('OAuth state requires a trusted server.');
}

async function hash(state: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(state));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Call only after a fresh Tayar owner session and project authorization. The
 * service-role RPC verifies the same owner/project association. */
export async function createWebsiteConnectionOAuthState(input: {
  client: Pick<SupabaseClient, 'rpc'>;
  ownerId: string;
  projectId: string;
  provider: Provider;
  environment: Environment;
  isCurrentOwner(): boolean;
  now?: () => number;
}): Promise<string> {
  serverOnly();
  if (!uuid.test(input.ownerId) || !uuid.test(input.projectId) || !providers.includes(input.provider)
    || !['preview', 'production'].includes(input.environment) || !input.isCurrentOwner()) throw new Error('Connection could not be started.');
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  const digest = await hash(raw);
  const expiresAt = new Date((input.now ?? Date.now)() + 9 * 60_000).toISOString();
  const { error } = await input.client.rpc('website_create_connection_oauth_state', {
    p_state_hash: digest, p_owner_id: input.ownerId, p_project_id: input.projectId,
    p_provider: input.provider, p_environment: input.environment, p_expires_at: expiresAt,
  });
  if (error || !input.isCurrentOwner()) throw new Error('Connection could not be started.');
  return raw;
}

/** The OAuth callback never treats a provider query parameter as project or
 * owner authority. Only this atomic service-role consume supplies that scope. */
export async function consumeWebsiteConnectionOAuthState(input: {
  client: Pick<SupabaseClient, 'rpc'>;
  state: string;
  provider: Provider;
}): Promise<{ ownerId: string; projectId: string; provider: Provider; environment: Environment }> {
  serverOnly();
  if (!statePattern.test(input.state) || !providers.includes(input.provider)) throw new Error('Connection state is invalid or expired.');
  const { data, error } = await input.client.rpc('website_consume_connection_oauth_state', { p_state_hash: await hash(input.state) });
  if (error || !data || !uuid.test(data.ownerId) || !uuid.test(data.projectId)
    || data.provider !== input.provider || !['preview', 'production'].includes(data.environment)) {
    throw new Error('Connection state is invalid or expired.');
  }
  return { ownerId: data.ownerId, projectId: data.projectId, provider: data.provider, environment: data.environment };
}
