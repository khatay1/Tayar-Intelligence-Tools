import { consumeWebsiteConnectionOAuthState } from './websiteConnectionOAuthStateService';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isUntrustedBrowserRuntime } from './trustedServerRuntime';

const statePattern = /^[0-9a-f]{64}$/;
const appId = /^[a-zA-Z0-9_]{5,100}$/;
const codePattern = /^[a-zA-Z0-9_-]{1,1024}$/;
const providerTokenMaxBytes = 65_536;

export interface GitHubOAuthGrant {
  accessToken: string;
  receivedAt: string;
  expiresIn: number | null;
  refreshToken: string | null;
  refreshTokenExpiresIn: number | null;
}

function callbackUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash
    || (url.search && url.search !== '?action=callback')) {
    throw new Error('GitHub connection is not configured.');
  }
  return url.toString();
}

function token(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 20
    && new TextEncoder().encode(value).length <= providerTokenMaxBytes && !/[\r\n\s]/.test(value);
}

function seconds(value: unknown, max: number): number | null {
  if (value === undefined || value === null) return null;
  return Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= max ? value as number : NaN;
}

function parseGrant(value: unknown, receivedAt: string): GitHubOAuthGrant {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
  const row = value as Record<string, unknown>;
  const expiresIn = seconds(row.expires_in, 86_400);
  const refreshExpiresIn = seconds(row.refresh_token_expires_in, 31_536_000);
  const refreshToken = row.refresh_token === undefined || row.refresh_token === null ? null : row.refresh_token;
  if (row.token_type?.toString().toLowerCase() !== 'bearer' || !token(row.access_token)
    || Number.isNaN(expiresIn) || Number.isNaN(refreshExpiresIn)
    || (refreshToken !== null && !token(refreshToken))
    || ((expiresIn !== null || refreshExpiresIn !== null || refreshToken !== null)
      && (expiresIn === null || refreshExpiresIn === null || refreshToken === null))
    || (expiresIn !== null && refreshExpiresIn !== null && refreshExpiresIn <= expiresIn)
    || !Number.isFinite(Date.parse(receivedAt))) throw new Error();
  return { accessToken: row.access_token, receivedAt, expiresIn, refreshToken, refreshTokenExpiresIn: refreshExpiresIn };
}

function parseStoredGrant(value: unknown): GitHubOAuthGrant {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !['accessToken', 'receivedAt', 'expiresIn', 'refreshToken', 'refreshTokenExpiresIn'].includes(key))
    || !token(row.accessToken) || typeof row.receivedAt !== 'string' || !Number.isFinite(Date.parse(row.receivedAt))
    || !(row.expiresIn === null || (Number.isSafeInteger(row.expiresIn) && (row.expiresIn as number) > 0 && (row.expiresIn as number) <= 86_400))
    || !(row.refreshToken === null || token(row.refreshToken))
    || !(row.refreshTokenExpiresIn === null || (Number.isSafeInteger(row.refreshTokenExpiresIn)
      && (row.refreshTokenExpiresIn as number) > 0 && (row.refreshTokenExpiresIn as number) <= 31_536_000))
    || ((row.expiresIn !== null || row.refreshToken !== null || row.refreshTokenExpiresIn !== null)
      && (row.expiresIn === null || row.refreshToken === null || row.refreshTokenExpiresIn === null))
    || (row.expiresIn !== null && row.refreshTokenExpiresIn !== null
      && (row.refreshTokenExpiresIn as number) <= (row.expiresIn as number))) throw new Error();
  return { accessToken: row.accessToken, receivedAt: row.receivedAt, expiresIn: row.expiresIn as number | null,
    refreshToken: row.refreshToken as string | null, refreshTokenExpiresIn: row.refreshTokenExpiresIn as number | null };
}

export function encodeGitHubOAuthHandoff(grant: GitHubOAuthGrant): string {
  return JSON.stringify(parseStoredGrant(grant));
}

export function decodeGitHubOAuthHandoff(value: string): GitHubOAuthGrant {
  if (typeof value !== 'string' || value.length < 20 || new TextEncoder().encode(value).length > providerTokenMaxBytes) {
    throw new Error('GitHub authorization failed.');
  }
  try { return parseStoredGrant(JSON.parse(value)); }
  catch { throw new Error('GitHub authorization failed.'); }
}

export function githubGrantExpiries(grant: GitHubOAuthGrant): {
  accessExpiresAt: string | null; refreshExpiresAt: string | null; custodyExpiresAt: string;
} {
  const parsed = parseStoredGrant(grant), received = Date.parse(parsed.receivedAt);
  const access = parsed.expiresIn === null ? null : received + parsed.expiresIn * 1000;
  const refresh = parsed.refreshTokenExpiresIn === null ? null : received + parsed.refreshTokenExpiresIn * 1000;
  const custody = refresh ?? received + 180 * 86_400_000;
  if (!Number.isFinite(custody) || custody <= received) throw new Error('GitHub authorization failed.');
  return { accessExpiresAt: access === null ? null : new Date(access).toISOString(),
    refreshExpiresAt: refresh === null ? null : new Date(refresh).toISOString(),
    custodyExpiresAt: new Date(custody).toISOString() };
}

/** The caller provides a fixed, server-configured callback, never a query
 * parameter or project-supplied redirect. The raw state is one-use. */
export function githubAuthorizationUrl(input: { clientId: string; callback: string; state: string }): string {
  if (!appId.test(input.clientId) || !statePattern.test(input.state)) throw new Error('GitHub connection is not configured.');
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', callbackUrl(input.callback));
  url.searchParams.set('state', input.state);
  return url.toString();
}

async function tokenRequest(input: {
  clientId: string; clientSecret: string; body: URLSearchParams; fetcher?: typeof fetch; now?: () => number;
}): Promise<GitHubOAuthGrant> {
  if (isUntrustedBrowserRuntime()) throw new Error('GitHub exchange requires a server.');
  if (!appId.test(input.clientId) || !input.clientSecret || input.clientSecret.length > 4096 || /[\r\n]/.test(input.clientSecret)) {
    throw new Error('GitHub authorization failed.');
  }
  try {
    const response = await (input.fetcher ?? fetch)('https://github.com/login/oauth/access_token', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: input.body,
    });
    if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 16_384) throw new Error();
    const raw = await response.text();
    if (raw.length > 16_384) throw new Error();
    const now = (input.now ?? Date.now)();
    if (!Number.isFinite(now)) throw new Error();
    return parseGrant(JSON.parse(raw), new Date(now).toISOString());
  } catch {
    throw new Error('GitHub authorization failed.');
  }
}

/** Exchange only on the trusted server. Expiring GitHub App user grants keep
 * both access and refresh material so the selected repository remains usable
 * without a platform-held GitHub App private key. */
export async function exchangeGitHubAppUserCode(input: {
  clientId: string;
  clientSecret: string;
  callback: string;
  code: string;
  fetcher?: typeof fetch;
  now?: () => number;
}): Promise<GitHubOAuthGrant> {
  if (!codePattern.test(input.code)) throw new Error('GitHub authorization failed.');
  const body = new URLSearchParams({ client_id: input.clientId, client_secret: input.clientSecret,
    code: input.code, redirect_uri: callbackUrl(input.callback) });
  return tokenRequest({ ...input, body });
}

export async function refreshGitHubAppUserGrant(input: {
  clientId: string; clientSecret: string; refreshToken: string; fetcher?: typeof fetch; now?: () => number;
}): Promise<GitHubOAuthGrant> {
  if (!token(input.refreshToken)) throw new Error('GitHub authorization failed.');
  const body = new URLSearchParams({ client_id: input.clientId, client_secret: input.clientSecret,
    grant_type: 'refresh_token', refresh_token: input.refreshToken });
  return tokenRequest({ ...input, body });
}

/** Consume state before code exchange. No owner/project is accepted from the
 * callback URL; only the atomic state record supplies that scope. */
export async function acceptGitHubOAuthCallback(input: {
  stateClient: Pick<SupabaseClient, 'rpc'>;
  state: string;
  code: string;
  clientId: string;
  clientSecret: string;
  callback: string;
  fetcher?: typeof fetch;
  now?: () => number;
}): Promise<{ ownerId: string; projectId: string; environment: 'preview' | 'production'; userToken: string }> {
  const scope = await consumeWebsiteConnectionOAuthState({ client: input.stateClient, state: input.state, provider: 'github' });
  const grant = await exchangeGitHubAppUserCode(input);
  return { ownerId: scope.ownerId, projectId: scope.projectId, environment: scope.environment,
    userToken: encodeGitHubOAuthHandoff(grant) };
}
