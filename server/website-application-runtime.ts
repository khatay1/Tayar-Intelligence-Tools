import { createClient } from '@supabase/supabase-js';
import { servePublishedWebsiteApplication, validateWebsiteApplicationRelease } from '../src/modules/website-builder/services/websiteApplicationPublishedService';
import { applicationOriginForProject } from '../src/modules/website-builder/core/application-origin';
import { clearApplicationBrowserSession, handleWebsiteApplicationBrowserSession } from '../src/modules/website-builder/services/websiteApplicationSessionService';

const unavailable = () => new Response('Application runtime is unavailable.', { status: 503, headers: { 'cache-control': 'private, no-store' } });
function platformClient(platformUrl: string) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!serviceKey) throw new Error('Application runtime is unavailable.');
  return createClient(platformUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (resource, init) => {
      try {
        const url = resource instanceof Request ? resource.url : String(resource);
        if (new URL(url).origin !== new URL(platformUrl).origin) throw new Error();
        return await fetch(resource, { ...init, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      } catch { return new Response(JSON.stringify({ message: 'Application platform unavailable.' }), { status: 503, headers: { 'content-type': 'application/json' } }); }
    } },
  });
}
function browserScope(projectId: string) {
  if (process.env.WEBSITE_APPLICATION_SESSIONS_ENABLED !== 'true') return undefined;
  const platformOrigin = process.env.WEBSITE_PLATFORM_ORIGIN ?? 'https://tayar.se';
  const applicationOrigin = applicationOriginForProject(projectId, process.env.WEBSITE_APPLICATION_HOST_SUFFIX ?? '', platformOrigin);
  return { applicationOrigin, platformOrigin };
}

/** Feature flags remain off until private releases, origin routing and browser checks are ready. */
export async function tryServePublishedApplication(input: {
  request: Request; ownerId: string; projectId: string; file: string; platformUrl: string; preview: boolean;
}): Promise<Response | null> {
  if (process.env.WEBSITE_APPLICATION_RUNTIME_ENABLED !== 'true') return null;
  try {
    return await servePublishedWebsiteApplication({ ...input, platform: platformClient(input.platformUrl), browserSession: browserScope(input.projectId) });
  } catch { return unavailable(); }
}

/** Same-origin session bridge. Project/owner query values are checked against the
 * active immutable release; the required host is derived from SERVER config.
 */
export async function serveApplicationBrowserSession(input: {
  request: Request; ownerId: string; projectId: string; platformUrl: string;
}): Promise<Response> {
  if (process.env.WEBSITE_APPLICATION_RUNTIME_ENABLED !== 'true') return unavailable();
  let mayClearCookie = false;
  const failed = () => mayClearCookie ? clearApplicationBrowserSession(unavailable()) : unavailable();
  try {
    const scope = browserScope(input.projectId);
    if (!scope) return unavailable();
    if (new URL(input.request.url).origin !== scope.applicationOrigin || input.request.headers.get('origin') !== scope.applicationOrigin
      || (input.request.headers.has('sec-fetch-site') && input.request.headers.get('sec-fetch-site') !== 'same-origin')) {
      return new Response('Origin not allowed.', { status: 403, headers: { 'cache-control': 'private, no-store' } });
    }
    if (!['POST', 'DELETE'].includes(input.request.method)) return new Response('Method not allowed.', { status: 405, headers: { allow: 'POST, DELETE', 'cache-control': 'private, no-store' } });
    mayClearCookie = input.request.method === 'DELETE';
    const platform = platformClient(input.platformUrl);
    const result = await platform.rpc('website_application_published_release', { p_project_id: input.projectId, p_owner_id: input.ownerId });
    if (result.error || !result.data?.enabled || !result.data.release) return failed();
    const { backend, definition } = validateWebsiteApplicationRelease(result.data.release, input.projectId, input.ownerId, input.platformUrl);
    const response = await handleWebsiteApplicationBrowserSession(input.request, { ...scope, projectId: input.projectId, backend, definition, platformUrl: input.platformUrl });
    return mayClearCookie ? clearApplicationBrowserSession(response) : response;
  } catch { return failed(); }
}
