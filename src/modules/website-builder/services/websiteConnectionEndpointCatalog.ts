export type WebsiteConnectionEndpointProvider = 'github' | 'supabase' | 'vercel';

type Environment = Readonly<Record<string, string | undefined>>;
type SessionReader = () => Promise<{ ownerId: string; accessToken: string } | null>;
export interface WebsiteConnectionBrowserTransport {
  platformUrl: string;
  anonKey: string;
  getSession: SessionReader;
  fetcher?: typeof fetch;
}
export interface WebsiteConnectionEndpointCatalog {
  endpoints: Readonly<Record<WebsiteConnectionEndpointProvider, string | null>>;
  availableProviders: readonly WebsiteConnectionEndpointProvider[];
  transportFor(provider: WebsiteConnectionEndpointProvider): WebsiteConnectionBrowserTransport | null;
}

const definitions: Readonly<Record<WebsiteConnectionEndpointProvider, { key: string; path: string }>> = {
  github: { key: 'VITE_WEBSITE_GITHUB_CONNECTION_URL', path: '/functions/v1/website-github-connection' },
  supabase: { key: 'VITE_WEBSITE_SUPABASE_CONNECTION_URL', path: '/functions/v1/website-supabase-connection' },
  vercel: { key: 'VITE_WEBSITE_VERCEL_CONNECTION_URL', path: '/functions/v1/website-vercel-connection' },
};

function platformOrigin(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== value || url.pathname !== '/' || url.port
    || url.username || url.password || url.search || url.hash
    || !/^[a-z0-9]{20}[.]supabase[.]co$/.test(url.hostname)) throw new Error();
  return url.origin;
}
function endpoint(value: string | undefined, origin: string, path: string) {
  if (!value) return null;
  const url = new URL(value);
  if (url.origin !== origin || url.protocol !== 'https:' || url.port || url.username || url.password
    || url.pathname !== path || url.search || url.hash || url.toString() !== value) throw new Error();
  return value;
}
function publicKey(value: string) {
  if (!value || value.length > 4096 || value.trim() !== value || /[\s\r\n]/.test(value)
    || /^sb_secret_/i.test(value)) throw new Error();
  let role = '';
  try {
    const parts = value.split('.');
    if (parts.length === 3) {
      const base = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base.padEnd(Math.ceil(base.length / 4) * 4, '=')));
      role = typeof payload?.role === 'string' ? payload.role : '';
    }
  } catch { /* Modern publishable keys are intentionally not JWTs. */ }
  if (role === 'service_role') throw new Error();
  return value;
}

/** Browser-only availability boundary. Empty endpoint values mean unavailable;
 * malformed or cross-origin values fail closed for the entire composition. */
export function createWebsiteConnectionEndpointCatalog(input: { environment: Environment;
  platformUrl: string; anonKey: string; getSession: SessionReader; fetcher?: typeof fetch }): WebsiteConnectionEndpointCatalog {
  try {
    if (typeof input.getSession !== 'function'
      || (input.fetcher !== undefined && typeof input.fetcher !== 'function')) throw new Error();
    const platformUrl = platformOrigin(input.platformUrl);
    const anonKey = publicKey(input.anonKey);
    const endpoints = Object.fromEntries((Object.entries(definitions) as Array<[
      WebsiteConnectionEndpointProvider, { key: string; path: string }
    ]>).map(([provider, definition]) => [provider,
      endpoint(input.environment[definition.key], platformUrl, definition.path)])) as Record<WebsiteConnectionEndpointProvider, string | null>;
    const availableProviders = (Object.keys(definitions) as WebsiteConnectionEndpointProvider[])
      .filter(provider => endpoints[provider] !== null);
    const transport = Object.freeze({ platformUrl, anonKey, getSession: input.getSession,
      ...(input.fetcher ? { fetcher: input.fetcher } : {}) });
    return Object.freeze({ endpoints: Object.freeze(endpoints), availableProviders: Object.freeze(availableProviders),
      transportFor: (provider: WebsiteConnectionEndpointProvider) => endpoints[provider] ? transport : null });
  } catch { throw new Error('Connection setup is unavailable.'); }
}
