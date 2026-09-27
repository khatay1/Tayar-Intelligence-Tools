import type { SupabaseClient } from '@supabase/supabase-js';
import { readBoundedJson } from './websiteApplicationBackendLinkService';
import { inspectWebsiteApplicationReleaseOutcome, publishWebsiteApplicationRelease } from './websiteApplicationReleaseService';
import { applicationOriginForProject } from '../core/application-origin';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store', 'vary': 'Authorization, Origin' },
});

/** No HTML, owner ID, backend credentials or arbitrary publish URL accepted.
 * Publishing stays unavailable until the deployment enables the private runtime,
 * browser sessions and executor with a valid isolated host configuration.
 */
export async function handleWebsiteApplicationRelease(request: Request, context: {
  platform: Pick<SupabaseClient, 'auth' | 'from' | 'rpc' | 'storage'>;
  platformUrl: string;
  platformOrigin: string;
  applicationHostSuffix: string;
  publishingEnabled: boolean;
}): Promise<Response> {
  if (typeof window !== 'undefined') throw new Error('Private releases require a server runtime.');
  if (request.method !== 'POST') return reply(405, { error: 'Method not allowed.' });
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return reply(415, { error: 'JSON request required.' });
  const accessToken = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!accessToken || accessToken.length > 16_384) return reply(401, { error: 'Sign in required.' });
  let body: Record<string, unknown>;
  try {
    const input = await readBoundedJson(request, 4096);
    if (!record(input) || typeof input.projectId !== 'string' || !uuid.test(input.projectId)
      || !['status', 'outcome', 'publish'].includes(String(input.operation))) throw new Error();
    const allowed = input.operation === 'publish' ? ['operation', 'projectId', 'expectedSnapshotDigest', 'releaseNote']
      : input.operation === 'outcome' ? ['operation', 'projectId', 'versionId'] : ['operation', 'projectId'];
    if (Object.keys(input).some(key => !allowed.includes(key))) throw new Error();
    if (input.operation === 'outcome' && (typeof input.versionId !== 'string' || !uuid.test(input.versionId))) throw new Error();
    if (input.operation === 'publish' && (typeof input.expectedSnapshotDigest !== 'string' || !/^[a-f0-9]{64}$/.test(input.expectedSnapshotDigest)
      || (input.releaseNote !== undefined && (typeof input.releaseNote !== 'string' || input.releaseNote.length > 500)))) throw new Error();
    body = input;
  } catch { return reply(400, { error: 'Invalid release request.' }); }
  const projectId = body.projectId as string;
  const { platform, platformUrl } = context;
  let applicationOrigin: string | undefined;
  if (context.publishingEnabled) {
    try { applicationOrigin = applicationOriginForProject(projectId, context.applicationHostSuffix, context.platformOrigin); }
    catch { applicationOrigin = undefined; }
  }
  try {
    const identity = await platform.auth.getUser(accessToken);
    const ownerId = identity.data.user?.id;
    if (identity.error || !ownerId || !uuid.test(ownerId) || identity.data.user?.is_anonymous) return reply(401, { error: 'Sign in required.' });
    const project = await platform.from('projects').select('id').eq('id', projectId).eq('user_id', ownerId)
      .eq('type', 'website-builder').is('deleted_at', null).maybeSingle();
    if (project.error) return reply(503, { error: 'Project is unavailable.' });
    if (!project.data) return reply(404, { error: 'Project not found.' });
    if (body.operation === 'status') {
      const result = await platform.rpc('website_application_published_release', { p_project_id: projectId, p_owner_id: ownerId });
      if (result.error) throw new Error();
      let versionId: string | null = null;
      if (result.data !== null) {
        if (!record(result.data) || result.data.enabled !== true) throw new Error();
        if (result.data.release !== null) {
          const release = result.data.release;
          if (!record(release) || typeof release.id !== 'string' || !uuid.test(release.id)
            || release.project_id !== projectId || release.user_id !== ownerId) throw new Error();
          versionId = release.id;
        }
      }
      return reply(200, { projectId, operation: 'status', privateMode: result.data !== null, versionId, publishingAvailable: !!applicationOrigin });
    }
    if (body.operation === 'outcome') {
      const status = await inspectWebsiteApplicationReleaseOutcome({ platform, accessToken, projectId, versionId: body.versionId as string });
      return reply(status === 'unavailable' ? 503 : 200, { projectId, operation: 'outcome', versionId: body.versionId, status });
    }
    if (!applicationOrigin) return reply(503, { error: 'Private publishing is not available yet.' });
    const publishedUrl = `${applicationOrigin}/site/${ownerId}/${projectId}/`;
    const result = await publishWebsiteApplicationRelease({ platform, platformUrl, accessToken, projectId, publishedUrl,
      expectedSnapshotDigest: body.expectedSnapshotDigest as string, releaseNote: body.releaseNote as string | undefined,
    });
    return reply(result.status === 'active' ? 201 : result.status === 'recovery-required' ? 202 : 422, { projectId, operation: 'publish', ...result });
  } catch { return reply(503, { error: 'Private release service is unavailable.' }); }
}
