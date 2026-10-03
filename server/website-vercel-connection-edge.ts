import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { handleWebsiteVercelConnection } from './website-vercel-connection';
import { createWebsiteVercelGithubTargetLoader } from './website-vercel-github-target';

type Environment = Readonly<Record<string, string | undefined>>;
type ClientFactory = typeof createClient;
const provider = /^[A-Za-z0-9_-]{3,128}$/;
const slug = /^[a-z0-9][a-z0-9-]{1,99}$/;
const githubClient = /^[A-Za-z0-9_]{5,100}$/;
const publicSecret = /^(?:NEXT_PUBLIC_|VITE_|PUBLIC_).*?(?:SECRET|SERVICE_ROLE|PRIVATE_KEY)/i;
const keys = { url: 'SUPABASE_URL', secret: 'SUPABASE_SERVICE_ROLE_KEY',
  integrationSlug: 'WEBSITE_VERCEL_INTEGRATION_SLUG', clientId: 'WEBSITE_VERCEL_CLIENT_ID',
  clientSecret: 'WEBSITE_VERCEL_CLIENT_SECRET', callback: 'WEBSITE_VERCEL_CALLBACK_URL',
  returnUrl: 'WEBSITE_VERCEL_RETURN_URL', platformAccount: 'TAYAR_PLATFORM_VERCEL_ACCOUNT_ID',
  githubClient: 'TAYAR_GITHUB_APP_CLIENT_ID', githubKey: 'TAYAR_GITHUB_APP_PRIVATE_KEY_PKCS8' } as const;
const fixedHeaders = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'", 'x-content-type-options': 'nosniff' };

function required(environment: Environment, key: string, max: number) {
  const value = environment[key];
  if (typeof value !== 'string' || !value || value.length > max || value.trim() !== value
    || value.includes(String.fromCharCode(0))) throw new Error();
  return value;
}
function optional(environment: Environment, key: string, max: number) {
  const value = environment[key] ?? '';
  if (typeof value !== 'string' || value.length > max || value.trim() !== value
    || value.includes(String.fromCharCode(0))) throw new Error();
  return value;
}
function platformUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== value || url.pathname !== '/' || url.port
    || url.username || url.password || url.search || url.hash
    || !/^[a-z0-9]{20}[.]supabase[.]co$/.test(url.hostname)) throw new Error();
  return url.origin;
}
function callbackUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash
    || url.search !== '?action=callback'
    || !url.pathname.endsWith('/functions/v1/website-vercel-connection')) throw new Error();
  return url.toString();
}
function browserReturn(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search) throw new Error();
  return { value: url.toString(), origin: url.origin };
}
function legacyServiceRole(value: string) {
  try {
    const parts = value.split('.'); if (parts.length !== 3 || parts.some(part => !part)) return false;
    const base = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base.padEnd(Math.ceil(base.length / 4) * 4, '=')));
    return !!payload && typeof payload === 'object' && payload.role === 'service_role';
  } catch { return false; }
}
function serviceKey(value: string) {
  if (/[\s\r\n]/.test(value) || value.length > 4096
    || (!/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(value) && !legacyServiceRole(value))) throw new Error();
  return value;
}
function privateKey(value: string) {
  if (value && (value.length > 24_000
    || !/^-----BEGIN PRIVATE KEY-----\s+[A-Za-z0-9+/=\s]+\s+-----END PRIVATE KEY-----$/.test(value))) throw new Error();
  return value;
}
function optionalPrivateKey(environment: Environment, key: string, max: number) {
  const raw = environment[key] ?? '';
  if (typeof raw !== 'string' || raw.length > max + 2 || raw.includes(String.fromCharCode(0))) throw new Error();
  const value = raw.endsWith('\r\n') ? raw.slice(0, -2) : raw.endsWith('\n') ? raw.slice(0, -1) : raw;
  if ((raw && !value) || value.length > max || value.trim() !== value) throw new Error();
  return privateKey(value);
}
function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), { status,
    headers: { ...fixedHeaders, 'content-type': 'application/json' } });
}

/** Unpublished Supabase Edge composition. Callback transport remains public
 * for one-use OAuth state, while every browser action is authenticated inside
 * the shared handler. Configuration is parsed once and never accepted in HTTP. */
export function createWebsiteVercelConnectionEdge(input: { environment: Environment;
  fetcher?: typeof fetch; clientFactory?: ClientFactory }) {
  try {
    if (input.fetcher !== undefined && typeof input.fetcher !== 'function') throw new Error();
    for (const [key, value] of Object.entries(input.environment)) if (value && publicSecret.test(key)) throw new Error();
    const url = platformUrl(required(input.environment, keys.url, 2048));
    const secret = serviceKey(required(input.environment, keys.secret, 4096));
    const callback = callbackUrl(required(input.environment, keys.callback, 2048));
    const destination = browserReturn(required(input.environment, keys.returnUrl, 2048));
    const integrationSlug = optional(input.environment, keys.integrationSlug, 100);
    const clientId = optional(input.environment, keys.clientId, 128);
    const clientSecret = optional(input.environment, keys.clientSecret, 4096);
    const platformAccountId = optional(input.environment, keys.platformAccount, 128);
    const githubAppClientId = optional(input.environment, keys.githubClient, 100);
    const githubAppPrivateKeyPkcs8 = optionalPrivateKey(input.environment, keys.githubKey, 24_000);
    if ((integrationSlug && !slug.test(integrationSlug)) || (clientId && !provider.test(clientId))
      || (clientSecret && (clientSecret.length < 20 || /[\r\n]/.test(clientSecret)))
      || (platformAccountId && !provider.test(platformAccountId))
      || (githubAppClientId && !githubClient.test(githubAppClientId))) throw new Error();
    const factory = input.clientFactory ?? createClient;
    const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      ...(input.fetcher ? { global: { fetch: input.fetcher } } : {}) };
    const platform = factory(url, secret, options) as SupabaseClient;
    return async (request: Request) => {
      const origin = request.headers.get('origin');
      const headers = new Headers(fixedHeaders); headers.set('vary', 'Origin');
      if (origin && origin !== destination.origin) return json(403, 'Origin not allowed.');
      if (origin) headers.set('access-control-allow-origin', origin);
      headers.set('access-control-allow-methods', 'POST, GET, OPTIONS');
      headers.set('access-control-allow-headers', 'authorization, apikey, content-type, x-client-info');
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      try {
        const response = await handleWebsiteVercelConnection(request, { platform, integrationSlug,
          clientId, clientSecret, callback, returnUrl: destination.value, platformAccountId,
          loadGithubTarget: async scope => {
            const authorization = request.headers.get('authorization') ?? '';
            const ownerClient = factory(url, secret, { ...options,
              global: { ...(options.global ?? {}), headers: { Authorization: authorization } } }) as SupabaseClient;
            return createWebsiteVercelGithubTargetLoader({ ownerClient, serviceClient: platform,
              githubAppClientId, githubAppPrivateKeyPkcs8, fetcher: input.fetcher })(scope);
          }, fetcher: input.fetcher });
        const combined = new Headers(response.headers);
        headers.forEach((value, key) => combined.set(key, value));
        return new Response(response.body, { status: response.status, headers: combined });
      } catch { return json(503, 'Vercel connection is unavailable.'); }
    };
  } catch { throw new Error('Vercel connection deployment unavailable.'); }
}

/** Edge-runtime boundary: invalid or incomplete deployment configuration must
 * fail closed without preventing Deno.serve from starting. */
export function createWebsiteVercelConnectionDeployment(input: { environment: Environment;
  fetcher?: typeof fetch; clientFactory?: ClientFactory }) {
  try { return createWebsiteVercelConnectionEdge(input); }
  catch { return async () => json(503, 'Vercel connection is unavailable.'); }
}
