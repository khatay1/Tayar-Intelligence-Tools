import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { handleWebsiteSupabaseConnection } from './website-supabase-connection';

type Environment = Readonly<Record<string, string | undefined>>;
type ClientFactory = typeof createClient;
const provider = /^[A-Za-z0-9_-]{5,128}$/;
const organization = /^[A-Za-z0-9_-]{1,128}$/;
const publicSecret = /^(?:NEXT_PUBLIC_|VITE_|PUBLIC_).*?(?:SECRET|SERVICE_ROLE|PKCE)/i;
const keys = { url: 'SUPABASE_URL', secret: 'SUPABASE_SERVICE_ROLE_KEY',
  clientId: 'WEBSITE_SUPABASE_OAUTH_CLIENT_ID', clientSecret: 'WEBSITE_SUPABASE_OAUTH_CLIENT_SECRET',
  pkceSecret: 'WEBSITE_SUPABASE_PKCE_SECRET', callback: 'WEBSITE_SUPABASE_CALLBACK_URL',
  returnUrl: 'WEBSITE_SUPABASE_RETURN_URL', organization: 'WEBSITE_SUPABASE_PLATFORM_ORGANIZATION_ID' } as const;
const fixedHeaders = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'", 'x-content-type-options': 'nosniff' };

function required(environment: Environment, key: string, max: number) {
  const value = environment[key];
  if (typeof value !== 'string' || !value || value.length > max || value.trim() !== value
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
    || !url.pathname.endsWith('/functions/v1/website-supabase-connection')) throw new Error();
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
function secret(value: string, minimum: number) {
  if (value.length < minimum || /[\r\n]/.test(value)) throw new Error();
  return value;
}
function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), { status,
    headers: { ...fixedHeaders, 'content-type': 'application/json' } });
}

/** Unpublished Supabase Edge composition. The OAuth callback stays public for
 * one-use state consumption, while browser actions authenticate in the core. */
export function createWebsiteSupabaseConnectionEdge(input: { environment: Environment;
  fetcher?: typeof fetch; clientFactory?: ClientFactory }) {
  try {
    if (input.fetcher !== undefined && typeof input.fetcher !== 'function') throw new Error();
    for (const [key, value] of Object.entries(input.environment)) if (value && publicSecret.test(key)) throw new Error();
    const url = platformUrl(required(input.environment, keys.url, 2048));
    const serviceRole = serviceKey(required(input.environment, keys.secret, 4096));
    const clientId = required(input.environment, keys.clientId, 128);
    const clientSecret = secret(required(input.environment, keys.clientSecret, 4096), 20);
    const pkceSecret = secret(required(input.environment, keys.pkceSecret, 4096), 32);
    const callback = callbackUrl(required(input.environment, keys.callback, 2048));
    const destination = browserReturn(required(input.environment, keys.returnUrl, 2048));
    const platformOrganizationId = required(input.environment, keys.organization, 128);
    if (!provider.test(clientId) || !organization.test(platformOrganizationId)) throw new Error();
    const factory = input.clientFactory ?? createClient;
    const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      ...(input.fetcher ? { global: { fetch: input.fetcher } } : {}) };
    const platform = factory(url, serviceRole, options) as SupabaseClient;
    return async (request: Request) => {
      const origin = request.headers.get('origin');
      const headers = new Headers(fixedHeaders); headers.set('vary', 'Origin');
      if (origin && origin !== destination.origin) return json(403, 'Origin not allowed.');
      if (origin) headers.set('access-control-allow-origin', origin);
      headers.set('access-control-allow-methods', 'POST, GET, OPTIONS');
      headers.set('access-control-allow-headers', 'authorization, apikey, content-type, x-client-info');
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      try {
        const response = await handleWebsiteSupabaseConnection(request, { platform, clientId, clientSecret,
          pkceSecret, callback, returnUrl: destination.value, platformOrganizationId, fetcher: input.fetcher });
        const combined = new Headers(response.headers);
        headers.forEach((value, key) => combined.set(key, value));
        return new Response(response.body, { status: response.status, headers: combined });
      } catch { return json(503, 'Supabase connection is unavailable.'); }
    };
  } catch { throw new Error('Supabase connection deployment unavailable.'); }
}

/** Edge-runtime boundary: invalid or incomplete deployment configuration must
 * fail closed without preventing Deno.serve from starting. */
export function createWebsiteSupabaseConnectionDeployment(input: { environment: Environment;
  fetcher?: typeof fetch; clientFactory?: ClientFactory }) {
  try { return createWebsiteSupabaseConnectionEdge(input); }
  catch { return async () => json(503, 'Supabase connection is unavailable.'); }
}
