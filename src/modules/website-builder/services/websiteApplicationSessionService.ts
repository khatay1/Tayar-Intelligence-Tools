import { assertApplicationOriginScope } from '../core/application-origin';
import { readApplicationDefinition } from '../core/application-validation';
import type { ApplicationDefinition } from '../core/application-model';
import { validateApplicationPublicBackend, type ApplicationPublicBackend } from '../core/application-data-runtime';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tokenPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const cookieName = '__Host-tayar-app-session';
const cookieAttributes = 'Path=/; Secure; HttpOnly; SameSite=Lax';
const validToken = (value: string) => value.length <= 3500 && tokenPattern.test(value);

/** Call only after validating the request's configured isolated origin. Clearing
 * navigation transport does not assert that the upstream session was revoked. */
export function clearApplicationBrowserSession(response: Response): Response {
  response.headers.set('set-cookie', `${cookieName}=; ${cookieAttributes}; Max-Age=0`);
  return response;
}

function cookieToken(request: Request): string | null {
  const header = request.headers.get('cookie') ?? '';
  if (header.length > 16_384) return null;
  const matches = header.split(';').map(value => value.trim()).filter(value => value.startsWith(`${cookieName}=`));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(cookieName.length + 1);
  return validToken(value) ? value : null;
}

/** Cookie possession is NOT authentication. The existing page guard still calls
 * the dedicated Auth server and live role RPC before reading private content.
 */
export function applicationRequestWithBrowserSession(request: Request, scope: {
  applicationOrigin: string; projectId: string; platformOrigin: string;
}): Request {
  if (typeof window !== 'undefined') throw new Error('Application cookies require a server runtime.');
  assertApplicationOriginScope(scope.applicationOrigin, scope.projectId, scope.platformOrigin);
  if (new URL(request.url).origin !== scope.applicationOrigin || request.headers.has('authorization')) return request;
  const token = cookieToken(request);
  if (!token) return request;
  const headers = new Headers(request.headers);
  headers.set('authorization', `Bearer ${token}`);
  return new Request(request, { headers });
}

/** Exchange a browser's dedicated-app access token for navigation transport.
 * Refresh tokens stay with the existing isolated app client. Never accepts a
 * Tayar platform session, user ID, role claim or token from a request body.
 */
export async function handleWebsiteApplicationBrowserSession(request: Request, context: {
  applicationOrigin: string; projectId: string; platformOrigin: string;
  backend: ApplicationPublicBackend; definition: ApplicationDefinition; platformUrl: string;
}): Promise<Response> {
  if (typeof window !== 'undefined') throw new Error('Application cookies require a server runtime.');
  const headers = new Headers({ 'cache-control': 'private, no-store', 'cdn-cache-control': 'no-store',
    'vercel-cdn-cache-control': 'no-store', vary: 'Origin, Authorization, Cookie', 'content-type': 'application/json', 'x-content-type-options': 'nosniff' });
  const reply = (status: number, message: string) => new Response(JSON.stringify({ status: message }), { status, headers });
  try {
    const { applicationOrigin, projectId, platformOrigin, platformUrl } = context;
    const backend = { ...context.backend };
    const definition = readApplicationDefinition(context.definition);
    assertApplicationOriginScope(applicationOrigin, projectId, platformOrigin);
    validateApplicationPublicBackend(backend, platformUrl);
    if (new URL(request.url).origin !== applicationOrigin || request.headers.get('origin') !== applicationOrigin
      || (request.headers.has('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin')) return reply(403, 'Origin not allowed.');
    if (!['POST', 'DELETE'].includes(request.method)) { headers.set('allow', 'POST, DELETE'); return reply(405, 'Method not allowed.'); }
    if (request.method === 'DELETE') {
      headers.set('set-cookie', `${cookieName}=; ${cookieAttributes}; Max-Age=0`);
      const token = cookieToken(request);
      if (token) {
        const revoked = await fetch(`${backend.url}/auth/v1/logout?scope=local`, { method: 'POST',
          headers: { apikey: backend.publishableKey, authorization: `Bearer ${token}` },
          redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10_000),
        });
        if (!revoked.ok && revoked.status !== 401) return reply(503, 'Session revocation is unavailable.');
      }
      return reply(200, 'signed-out');
    }
    if (!definition.auth.enabled) return reply(403, 'Application sign-in is disabled.');
    const token = /^Bearer (.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1] ?? '';
    if (!validToken(token)) return reply(401, 'Sign in required.');
    const verified = await fetch(`${backend.url}/auth/v1/user`, { method: 'GET',
      headers: { apikey: backend.publishableKey, authorization: `Bearer ${token}` },
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10_000),
    });
    if (!verified.ok) return reply(verified.status >= 500 ? 503 : 401, 'Session verification is unavailable.');
    const text = await verified.text();
    if (text.length > 65_536) throw new Error();
    const user = JSON.parse(text);
    if (!user || typeof user.id !== 'string' || !uuid.test(user.id) || user.is_anonymous
      || (definition.auth.emailVerificationRequired && !user.email_confirmed_at)) return reply(403, 'Verified sign-in required.');
    // Only inspect expiration AFTER the remote Auth server validated the token.
    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const remaining = Math.floor(Number(claims.exp) - Date.now() / 1000);
    if (!Number.isFinite(remaining) || remaining <= 0) return reply(401, 'Sign in required.');
    headers.set('set-cookie', `${cookieName}=${token}; ${cookieAttributes}; Max-Age=${Math.min(remaining, 3600)}`);
    return reply(200, 'synchronized');
  } catch { return reply(503, 'Application session is unavailable.'); }
}
