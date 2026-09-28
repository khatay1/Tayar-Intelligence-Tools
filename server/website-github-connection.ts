import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createWebsiteConnectionOAuthState } from '../src/modules/website-builder/services/websiteConnectionOAuthStateService';
import { acceptGitHubOAuthCallback, githubAuthorizationUrl } from '../src/modules/website-builder/services/websiteGithubOAuthService';
import { storeWebsiteConnectionHandoff } from '../src/modules/website-builder/services/websiteConnectionHandoffService';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const state = /^[a-f0-9]{64}$/;
const code = /^[a-zA-Z0-9_-]{1,1024}$/;
const responseHeaders = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'none'", 'x-content-type-options': 'nosniff' };
function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...responseHeaders, 'content-type': 'application/json' } });
}
function fixedHttps(value: string, callback = false): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash
    || (callback ? url.search !== '?action=callback' : !!url.search)) throw new Error();
  return url;
}

/** Source-only endpoint. The OAuth callback is unauthenticated at the transport
 * layer, but its one-use state is issued only after owner session verification.
 * All returned browser data is metadata or an opaque short-lived handle. */
export async function handleWebsiteGitHubConnection(request: Request, context: {
  platform: Pick<SupabaseClient, 'auth' | 'from' | 'rpc'>;
  clientId: string;
  clientSecret: string;
  callback: string;
  returnUrl: string;
  fetcher?: typeof fetch;
}): Promise<Response> {
  let callback: URL, destination: URL;
  try {
    callback = fixedHttps(context.callback, true);
    destination = fixedHttps(context.returnUrl);
    if (callback.origin !== new URL(request.url).origin || callback.pathname !== new URL(request.url).pathname
      || !/^[a-zA-Z0-9_]{5,100}$/.test(context.clientId) || !context.clientSecret) throw new Error();
  } catch { return json(503, { error: 'GitHub connection is not configured.' }); }
  const action = new URL(request.url).searchParams.get('action');
  if (action === 'callback') {
    if (request.method !== 'GET') return json(405, { error: 'Method not allowed.' });
    const params = new URL(request.url).searchParams;
    if (params.has('error') || !state.test(params.get('state') ?? '') || !code.test(params.get('code') ?? '')) {
      return json(400, { error: 'GitHub authorization failed. Start the connection again.' });
    }
    try {
      const grant = await acceptGitHubOAuthCallback({ stateClient: context.platform, state: params.get('state')!,
        code: params.get('code')!, clientId: context.clientId, clientSecret: context.clientSecret,
        callback: callback.toString(), fetcher: context.fetcher });
      const handoffId = await storeWebsiteConnectionHandoff({ client: context.platform, ...grant, provider: 'github' });
      destination.hash = new URLSearchParams({ tayar_github_handoff: handoffId }).toString();
      return new Response(null, { status: 303, headers: { ...responseHeaders, location: destination.toString() } });
    } catch { return json(409, { error: 'GitHub authorization could not be completed. Start the connection again.' }); }
  }
  if (action !== 'begin' || request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return json(415, { error: 'JSON request required.' });
  const token = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token || token.length > 16384) return json(401, { error: 'Sign in required.' });
  let ownerId: string;
  try {
    const identity = await context.platform.auth.getUser(token);
    if (identity.error || !identity.data.user || identity.data.user.is_anonymous || !uuid.test(identity.data.user.id)) throw new Error();
    ownerId = identity.data.user.id;
  } catch { return json(401, { error: 'Sign in required.' }); }
  let projectId: string, environment: 'preview' | 'production';
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 4096) throw new Error();
    const body = await request.text();
    if (body.length > 4096) throw new Error();
    const input = JSON.parse(body);
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['projectId', 'environment'].includes(key))
      || !uuid.test(input.projectId) || !['preview', 'production'].includes(input.environment)) throw new Error();
    projectId = input.projectId; environment = input.environment;
  } catch { return json(400, { error: 'Invalid connection request.' }); }
  try {
    const { data, error } = await context.platform.from('projects').select('id').eq('id', projectId)
      .eq('user_id', ownerId).eq('type', 'website-builder').is('deleted_at', null).maybeSingle();
    if (error) return json(503, { error: 'Project is unavailable.' });
    if (!data) return json(404, { error: 'Project not found.' });
    const rawState = await createWebsiteConnectionOAuthState({ client: context.platform,
      ownerId, projectId, environment, provider: 'github', isCurrentOwner: () => true });
    return json(200, { authorizationUrl: githubAuthorizationUrl({ clientId: context.clientId, callback: callback.toString(), state: rawState }) });
  } catch { return json(409, { error: 'GitHub connection could not be started.' }); }
}

Deno.serve(async request => {
  const allowedOrigin = Deno.env.get('WEBSITE_GITHUB_RETURN_URL') ?? '';
  const origin = request.headers.get('origin');
  const headers = new Headers(responseHeaders);
  headers.set('vary', 'Origin');
  try {
    if (origin && new URL(allowedOrigin).origin !== origin) return json(403, { error: 'Origin not allowed.' });
  } catch { return json(503, { error: 'GitHub connection is not configured.' }); }
  if (origin) headers.set('access-control-allow-origin', origin);
  headers.set('access-control-allow-methods', 'POST, GET, OPTIONS');
  headers.set('access-control-allow-headers', 'authorization, apikey, content-type, x-client-info');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  try {
    const platformUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const platform = createClient(platformUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const response = await handleWebsiteGitHubConnection(request, { platform,
      clientId: Deno.env.get('WEBSITE_GITHUB_APP_CLIENT_ID') ?? '',
      clientSecret: Deno.env.get('WEBSITE_GITHUB_APP_CLIENT_SECRET') ?? '',
      callback: Deno.env.get('WEBSITE_GITHUB_CALLBACK_URL') ?? '', returnUrl: allowedOrigin });
    const combined = new Headers(response.headers);
    headers.forEach((value, key) => combined.set(key, value));
    return new Response(response.body, { status: response.status, headers: combined });
  } catch { return json(503, { error: 'GitHub connection is unavailable.' }); }
});
