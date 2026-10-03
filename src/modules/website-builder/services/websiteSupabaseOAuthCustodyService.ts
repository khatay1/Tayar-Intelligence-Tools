import type { SupabaseClient } from '@supabase/supabase-js';
import { assertInfrastructureConnection, type InfrastructureConnection } from '../core/application-infrastructure-connections';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ref = /^[a-z]{20}$/;
const organizationIdPattern = /^[A-Za-z0-9_-]{1,200}$/;
const organizationSlugPattern = /^[a-z0-9][a-z0-9-]{0,199}$/;
const providerTokenMaxBytes = 65_536;

type Client = Pick<SupabaseClient, 'rpc'>;
type Scope = {
  client: Client; connection: InfrastructureConnection;
  organizationId: string; organizationSlug: string;
  isCurrentOwner: () => boolean;
};

function assertScope(input: Scope) {
  if (typeof window !== 'undefined') throw new Error('Customer OAuth custody requires a trusted server.');
  const connection = assertInfrastructureConnection(input.connection);
  if (connection.provider !== 'supabase' || !['connected', 'setup-incomplete', 'outdated-schema', 'ready'].includes(connection.status)
    || !connection.targetId || !ref.test(connection.targetId)
    || !organizationIdPattern.test(input.organizationId)
    || !organizationSlugPattern.test(input.organizationSlug) || !input.isCurrentOwner()) {
    throw new Error('Customer OAuth custody scope changed.');
  }
  return connection;
}

function token(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 20 && new TextEncoder().encode(value).length <= providerTokenMaxBytes
    && !/[\r\n]/.test(value);
}

/** Store only after an independent owner/project API proof for the *new*
 * access token. The private RPC rechecks current connection version/target. */
export async function storeWebsiteSupabaseOAuthCustody(input: Scope & {
  expectedVersion: number; operationId: string;
  accessToken: string; refreshToken: string;
  accessExpiresAt: string; custodyExpiresAt: string;
  confirmOwnedProject: (accessToken: string) => Promise<boolean>;
}): Promise<number> {
  const connection = assertScope(input);
  const now = Date.now(), accessExpiry = Date.parse(input.accessExpiresAt), custodyExpiry = Date.parse(input.custodyExpiresAt);
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 || !uuid.test(input.operationId)
    || !token(input.accessToken) || !token(input.refreshToken)
    || !Number.isFinite(accessExpiry) || accessExpiry <= now || accessExpiry > now + 86_400_000
    || !Number.isFinite(custodyExpiry) || custodyExpiry <= now || custodyExpiry > now + 30 * 86_400_000
    || typeof input.confirmOwnedProject !== 'function'
    || !await input.confirmOwnedProject(input.accessToken) || !input.isCurrentOwner()) {
    throw new Error('Customer OAuth custody scope changed.');
  }
  const base = { p_connection_id: connection.id, p_project_id: connection.projectId,
    p_owner_id: connection.ownerId, p_expected_connection_version: connection.version,
    p_expected_version: input.expectedVersion, p_operation_id: input.operationId };
  const args = { ...base, p_account_id: connection.accountId, p_project_ref: connection.targetId,
    p_organization_id: input.organizationId, p_organization_slug: input.organizationSlug,
    p_access_token: input.accessToken, p_refresh_token: input.refreshToken,
    p_access_expires_at: input.accessExpiresAt, p_custody_expires_at: input.custodyExpiresAt };
  const expected = input.expectedVersion + 1;
  try {
    const { data, error } = await input.client.rpc('website_store_supabase_oauth_custody', args);
    if (error || data !== expected) throw new Error();
  } catch {
    // The write may have committed before its response was lost. Never replay
    // a provider refresh from here or claim success on an unrelated version.
    const { data, error } = await input.client.rpc('website_reconcile_supabase_oauth_custody', base);
    if (error || data !== expected) throw new Error('Customer OAuth custody changed.');
  }
  if (!input.isCurrentOwner()) throw new Error('Customer OAuth custody scope changed.');
  return expected;
}

/** Service-only plaintext is returned to the trusted setup worker for this
 * request; it must never enter project snapshots, responses or logs. */
export async function readWebsiteSupabaseOAuthCustody(input: Scope): Promise<{
  version: number; accessToken: string; refreshToken: string;
  accessExpiresAt: string; custodyExpiresAt: string;
}> {
  const connection = assertScope(input);
  const { data, error } = await input.client.rpc('website_read_supabase_oauth_custody', {
    p_connection_id: connection.id, p_project_id: connection.projectId,
    p_owner_id: connection.ownerId, p_expected_connection_version: connection.version,
  });
  if (error || !data || !input.isCurrentOwner() || !Number.isSafeInteger(data.version) || data.version < 1
    || data.accountId !== connection.accountId || data.projectRef !== connection.targetId
    || data.environment !== connection.environment || data.organizationId !== input.organizationId
    || data.organizationSlug !== input.organizationSlug || !token(data.grant?.accessToken)
    || !token(data.grant?.refreshToken) || !Number.isFinite(Date.parse(data.accessExpiresAt))
    || !Number.isFinite(Date.parse(data.custodyExpiresAt)) || Date.parse(data.custodyExpiresAt) <= Date.now()) {
    throw new Error('Customer OAuth custody unavailable.');
  }
  return { version: data.version, accessToken: data.grant.accessToken,
    refreshToken: data.grant.refreshToken, accessExpiresAt: data.accessExpiresAt,
    custodyExpiresAt: data.custodyExpiresAt };
}

/** Local erasure after the provider revocation attempt. The SQL RPC accepts
 * the *current* connection version, including a disconnected version. */
export async function eraseWebsiteSupabaseOAuthCustody(input: {
  client: Client; connection: InfrastructureConnection; isCurrentOwner: () => boolean;
}): Promise<boolean> {
  if (typeof window !== 'undefined' || !input.isCurrentOwner()) throw new Error('Customer OAuth custody scope changed.');
  const connection = assertInfrastructureConnection(input.connection);
  if (connection.provider !== 'supabase') throw new Error('Customer OAuth custody scope changed.');
  const { data, error } = await input.client.rpc('website_delete_supabase_oauth_custody', {
    p_connection_id: connection.id, p_project_id: connection.projectId,
    p_owner_id: connection.ownerId, p_expected_connection_version: connection.version,
  });
  if (error || !input.isCurrentOwner() || typeof data !== 'boolean') throw new Error('Customer OAuth custody changed.');
  return data;
}
