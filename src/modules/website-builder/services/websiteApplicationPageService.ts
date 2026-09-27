import { createClient } from '@supabase/supabase-js';
import type { ApplicationDefinition } from '../core/application-model';
import { readApplicationDefinition } from '../core/application-validation';
import { canAccessApplicationPage, validateApplicationPublicBackend, type ApplicationPublicBackend } from '../core/application-data-runtime';

/** Server handler for a trusted route resolved from the deployed page manifest.
 * Content must live in private storage; never also upload protected HTML to a public bucket.
 * The caller must verify the deployed project/backend binding before invoking this handler.
 */
export async function serveWebsiteApplicationPage(input: {
  request: Request;
  pageId: string;
  pageIds: ReadonlySet<string>;
  definition: ApplicationDefinition;
  backend: ApplicationPublicBackend;
  platformUrl: string;
  loadPage: () => Promise<Response>;
}): Promise<Response> {
  if (typeof window !== 'undefined') throw new Error('Application page protection requires a server runtime.');
  const backend = { ...input.backend };
  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'CDN-Cache-Control': 'no-store',
    'Vercel-CDN-Cache-Control': 'no-store',
    'Vary': 'Authorization, Cookie',
    'X-Content-Type-Options': 'nosniff',
  });
  const deny = (status: number, message: string) => new Response(input.request.method === 'HEAD' ? null : message, { status, headers });
  if (!['GET', 'HEAD'].includes(input.request.method)) {
    headers.set('Allow', 'GET, HEAD');
    return deny(405, 'Method not allowed.');
  }
  if (!input.pageIds.has(input.pageId)) return deny(404, 'Page not found.');
  let app: ApplicationDefinition;
  try {
    if (!input.definition) throw new Error('Missing deployed application definition.');
    app = readApplicationDefinition(input.definition, input.pageIds);
    validateApplicationPublicBackend(backend, input.platformUrl);
  } catch { return deny(503, 'Application configuration is unavailable.'); }
  const rule = app.pageAccess.find(item => item.pageId === input.pageId);
  if (rule && rule.access !== 'public') {
    const authorization = input.request.headers.get('authorization') ?? '';
    const token = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(authorization)?.[1];
    if (!token || token.length > 16_384) return deny(401, 'Sign in required.');
    const client = createClient(backend.url, backend.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        headers: { Authorization: `Bearer ${token}` },
        fetch: async (resource, init) => {
          const url = resource instanceof Request ? resource.url : String(resource);
          if (![`${backend.url}/auth/v1/user`, `${backend.url}/rest/v1/rpc/app_my_roles`].includes(url)) {
            throw new Error('Unexpected application authorization endpoint.');
          }
          try { return await fetch(resource, { ...init, redirect: 'error', signal: AbortSignal.timeout(10_000) }); }
          catch {
            // Auth SDK logs thrown transport errors; never let credential-bearing errors reach it.
            return new Response(JSON.stringify({ message: 'Application authorization is unavailable.' }), {
              status: 503, headers: { 'content-type': 'application/json' },
            });
          }
        },
      },
    });
    try {
      // Auth server validation, never decoded claims or user-editable metadata.
      const result = await client.auth.getUser(token);
      if (result.error || !result.data.user || result.data.user.is_anonymous) return deny(401, 'Sign in required.');
      if (app.auth.emailVerificationRequired && !result.data.user.email_confirmed_at) return deny(403, 'Email verification required.');
      let roles: string[] = [];
      if (rule.access === 'role') {
        const result = await client.rpc('app_my_roles');
        if (result.error || !Array.isArray(result.data) || result.data.some(role => typeof role !== 'string')) {
          return deny(503, 'Application permissions are unavailable.');
        }
        roles = result.data;
      }
      if (!canAccessApplicationPage(app, input.pageId, result.data.user, roles)) return deny(403, 'Access denied.');
    } catch { return deny(503, 'Application authorization is unavailable.'); }
  }
  try {
    // This callback cannot run until the authorization decision completes.
    const page = await input.loadPage();
    const responseHeaders = new Headers(page.headers);
    headers.forEach((value, key) => responseHeaders.set(key, value));
    if (input.request.method === 'HEAD') await page.body?.cancel();
    return new Response(input.request.method === 'HEAD' ? null : page.body, { status: page.status, headers: responseHeaders });
  } catch { return deny(503, 'Application page is unavailable.'); }
}
