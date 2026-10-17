import { serveOwnedApplicationRoute, type OwnedApplicationRouteManifest } from '../src/modules/website-builder/services/websiteOwnedApplicationRouteService';
import type { OwnedReleaseIdentity } from './website-owned-release-identity';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStore = (response: Response) => /(?:^|,)\s*no-store\s*(?:,|$)/i.test(response.headers.get('cache-control') ?? '');

/** Executes deterministic runtime-boundary checks inside the deployed artifact.
 * It never calls Auth/data providers, mutates state or accepts credentials. */
export async function serveOwnedReleaseBehavior(request: Request, input: {
  identity: OwnedReleaseIdentity; manifest: OwnedApplicationRouteManifest;
  loadPage(pageId: string): Promise<Response>;
}): Promise<Response> {
  const headers = { 'cache-control': 'private, no-store', 'cdn-cache-control': 'no-store',
    'vercel-cdn-cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
  const fail = (status: number) => new Response(null, { status, headers });
  try {
    const url = new URL(request.url), challenge = url.searchParams.get('challenge');
    if (request.method !== 'GET') return fail(405);
    if (!challenge || !uuid.test(challenge) || url.searchParams.get('tayarRoute') !== 'release-behavior-proof'
      || [...url.searchParams.keys()].some(key => !['tayarRoute', 'challenge'].includes(key))
      || url.searchParams.getAll('challenge').length !== 1 || url.searchParams.getAll('tayarRoute').length !== 1
      || input.identity.environment !== 'production' || input.identity.projectId !== input.manifest.projectId
      || !input.manifest.pages.length) return fail(400);
    const origin = input.manifest.applicationOrigin, first = input.manifest.pages[0];
    const authUrl = new URL(first.path, origin); authUrl.searchParams.set('applicationAuth', '1');
    const auth = await serveOwnedApplicationRoute(new Request(authUrl, { headers: { accept: 'text/html' } }),
      input.manifest, input.loadPage);
    if (auth.status !== 200 || !noStore(auth) || !/^text\/html(?:;|$)/i.test(auth.headers.get('content-type') ?? '')
      || !/frame-ancestors 'none'/.test(auth.headers.get('content-security-policy') ?? '')) throw new Error();
    await auth.body?.cancel();
    const sessionUrl = new URL('/api/application-session', origin);
    const session = await serveOwnedApplicationRoute(new Request(sessionUrl, { method: 'POST',
      headers: { origin, 'sec-fetch-site': 'same-origin' } }), input.manifest, input.loadPage);
    if (session.status !== 401 || !noStore(session)
      || !/^application\/json(?:;|$)/i.test(session.headers.get('content-type') ?? '')) throw new Error();
    await session.body?.cancel();
    const missing = await serveOwnedApplicationRoute(new Request(new URL('/__tayar_missing__.html', origin)),
      input.manifest, input.loadPage);
    if (missing.status !== 404 || !noStore(missing)) throw new Error();
    await missing.body?.cancel();
    return Response.json({ version: input.identity.version, projectId: input.identity.projectId,
      environment: input.identity.environment, runtimeDigest: input.identity.runtimeDigest, behaviorVersion: 1, challenge,
      checks: ['auth-shell', 'anonymous-session-denial', 'unknown-route-denial'] }, { headers });
  } catch { return fail(503); }
}
