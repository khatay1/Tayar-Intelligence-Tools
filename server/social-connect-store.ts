import type { SupabaseClient } from '@supabase/supabase-js';
import { isUntrustedBrowserRuntime } from '../src/modules/website-builder/services/trustedServerRuntime';
import type { SocialConnectStore, SocialConnectVault, SocialConnection, SocialOAuthState } from './social-connect';
import { SocialConnectError } from './social-connect';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digits = /^[1-9][0-9]{0,39}$/;
function fail(): never { throw new SocialConnectError(); }
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(); return value as Record<string, unknown>; }
function string(value: unknown) { if (typeof value !== 'string') fail(); return value; }
function id(value: unknown) { const result = string(value); if (!uuid.test(result)) fail(); return result; }
function account(value: unknown) { const result = string(value); if (!digits.test(result)) fail(); return result; }
function ownership(value: unknown): 'official' | 'customer' { if (value !== 'official' && value !== 'customer') fail(); return value; }
function channel(value: unknown): SocialConnection['channel'] { if (!['whatsapp', 'telegram', 'facebook', 'instagram'].includes(String(value))) fail(); return value as SocialConnection['channel']; }
function date(value: unknown) { const result = string(value); if (!Number.isFinite(Date.parse(result))) fail(); return result; }
function parsedConnection(value: unknown, tenantId: string, connectionId: string): SocialConnection | null {
  if (value === null) return null;
  const row = record(value);
  if (row.id !== connectionId || row.scope_id !== tenantId || !['connected', 'disconnected', 'expired'].includes(String(row.status))
    || typeof row.permissions_verified !== 'boolean' || typeof row.webhook_verified !== 'boolean'
    || !Array.isArray(row.scopes) || !row.scopes.every(x => typeof x === 'string')
    || (row.status === 'connected' && (typeof row.secret_ref !== 'string' || !uuid.test(row.secret_ref)))
    || !Number.isSafeInteger(row.version) || Number(row.version) < 1) fail();
  return { id: id(row.id), tenantId: id(row.scope_id), ownerUserId: id(row.owner_user_id), ownership: ownership(row.ownership),
    channel: channel(row.channel), accountId: account(row.external_account_id), status: row.status as SocialConnection['status'],
    permissionsVerified: row.permissions_verified, webhookVerified: row.webhook_verified, tokenRef: row.secret_ref === null ? null : id(row.secret_ref),
    scopes: row.scopes, expiresAt: row.expires_at === null ? null : date(row.expires_at), version: Number(row.version) };
}

/** Trusted service-role client only. Never construct this adapter in a browser or with user-controlled RPC names. */
export function createSocialConnectPersistence(client: Pick<SupabaseClient, 'rpc'>): { store: SocialConnectStore; vault: SocialConnectVault } {
  if (isUntrustedBrowserRuntime()) fail();
  async function rpc(name: string, args: Record<string, unknown>) {
    if (isUntrustedBrowserRuntime()) fail();
    try { const { data, error } = await client.rpc(name, args); if (error) fail(); return data as unknown; } catch { return fail(); }
  }
  const store: SocialConnectStore = {
    async saveOAuthState(state) {
      await rpc('save_social_hub_oauth_state', { p_state_hash: state.stateHash, p_scope_id: state.tenantId, p_user_id: state.userId,
        p_channel: state.channel, p_expires_at: state.expiresAt, p_metadata: { accountId: state.accountId, ownership: state.ownership,
          callbackUrl: state.callbackUrl, ...(state.pageId ? { pageId: state.pageId } : {}), ...(state.businessAccountId ? { businessAccountId: state.businessAccountId } : {}) } });
    },
    async consumeOAuthState(scope) {
      const value = await rpc('consume_social_hub_oauth_state', { p_state_hash: scope.stateHash, p_scope_id: scope.tenantId, p_user_id: scope.userId });
      if (value === null) return null;
      const row = record(value), metadata = record(row.metadata), kind = channel(row.channel);
      if (row.scope_id !== scope.tenantId || row.user_id !== scope.userId || row.state_hash !== scope.stateHash || kind === 'telegram') fail();
      const state: SocialOAuthState = { stateHash: string(row.state_hash), tenantId: id(row.scope_id), userId: id(row.user_id), channel: kind,
        accountId: account(metadata.accountId), ownership: ownership(metadata.ownership), callbackUrl: string(metadata.callbackUrl), expiresAt: date(row.expires_at),
        ...(metadata.pageId ? { pageId: account(metadata.pageId) } : {}), ...(metadata.businessAccountId ? { businessAccountId: account(metadata.businessAccountId) } : {}) };
      return state;
    },
    async getConnection(scope) { return parsedConnection(await rpc('get_social_hub_connection', { p_id: scope.id, p_scope_id: scope.tenantId }), scope.tenantId, scope.id); },
    async saveConnection(connection, expectedVersion) { await rpc('save_social_hub_connection', { p_record: connection, p_expected_version: expectedVersion }); },
  };
  const vault: SocialConnectVault = {
    async put(scope) { return id(await rpc('social_hub_store_credential', { p_scope_id: scope.tenantId, p_connection_id: scope.connectionId, p_access_token: scope.accessToken })); },
    async revoke(scope) { await rpc('social_hub_revoke_credential', { p_scope_id: scope.tenantId, p_connection_id: scope.connectionId, p_secret_ref: scope.tokenRef }); },
  };
  return { store, vault };
}

/** Server-worker lease only: database RPC rechecks enabled binding, scope, expiry and verification. */
export async function readSocialConnectionCredential(client: Pick<SupabaseClient, 'rpc'>, scope: { tenantId: string; connectionId: string; tokenRef: string }): Promise<string> {
  if (isUntrustedBrowserRuntime() || !uuid.test(scope.tenantId) || !uuid.test(scope.connectionId) || !uuid.test(scope.tokenRef)) fail();
  try {
    const { data, error } = await client.rpc('read_social_hub_credential', { p_scope_id: scope.tenantId, p_connection_id: scope.connectionId, p_secret_ref: scope.tokenRef });
    if (error || typeof data !== 'string' || data.length < 20 || data.length > 8192 || [...data].some(character => /\s/.test(character) || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) fail();
    return data;
  } catch { return fail(); }
}
