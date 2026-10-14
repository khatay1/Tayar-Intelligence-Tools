import type { SupabaseClient } from '@supabase/supabase-js';
import { validateWebsiteApplicationRelease } from '../src/modules/website-builder/services/websiteApplicationPublishedService';
import { createPublishedCustomOperationActorAuthorizer } from './website-application-custom-operation-authorization';
import { resolvePublishedCustomOperationArtifact } from './website-application-custom-operation-release';
import { servePublishedCustomOperationRequest } from './website-application-custom-operation-route';
import { completeWebsiteCustomExecutionUsage, reserveWebsiteCustomExecutionUsage } from './website-application-custom-operation-quota';
import type { IsolatedExecutionAdapter } from './isolated-code-execution';

type Platform = Pick<SupabaseClient, 'rpc' | 'from'>;

/** Joins the existing release, customer-auth, quota, and isolated-execution
 * boundaries. The feature flag is checked before any platform/database access.
 */
export async function servePublishedCustomOperationRuntime(input: {
  request: Request;
  ownerId: string;
  projectId: string;
  applicationOrigin: string;
  platformUrl: string;
  platform: Platform;
  adapter: IsolatedExecutionAdapter;
  enabled: boolean;
  fetcher?: typeof fetch;
}): Promise<Response> {
  if (!input.enabled) return Response.json({ error: 'not_found' }, {
    status: 404,
    headers: { 'cache-control': 'private, no-store', 'cdn-cache-control': 'no-store', 'vary': 'Origin, Authorization, Cookie' },
  });

  let releasePromise: ReturnType<typeof loadRelease> | undefined;
  async function loadRelease() {
    const result = await input.platform.rpc('website_application_published_release', {
      p_project_id: input.projectId,
      p_owner_id: input.ownerId,
    });
    if (result.error || !result.data || typeof result.data !== 'object' || result.data.enabled !== true || !result.data.release) {
      throw new Error('Published release unavailable.');
    }
    return validateWebsiteApplicationRelease(result.data.release, input.projectId, input.ownerId, input.platformUrl);
  }
  const getRelease = () => releasePromise ??= loadRelease();
  const dependencies = {
    enabled: true,
    adapter: input.adapter,
    async authorize(request: { operationId: string }, accessToken?: string) {
      if (typeof accessToken !== 'string') return false;
      try {
        const published = await getRelease();
        const application = published.release.snapshot.application as Record<string, unknown>;
        const requirements = application.requirements as Record<string, unknown> | undefined;
        const specification = requirements?.specification;
        const authorize = createPublishedCustomOperationActorAuthorizer({
          backend: published.backend,
          expectedProjectRef: published.backend.projectRef,
          specification,
          ...(input.fetcher ? { fetcher: input.fetcher } : {}),
        });
        return await authorize(request, accessToken);
      } catch { return false; }
    },
    async loadOperation(request: { projectId: string; releaseId: string; operationId: string }) {
      try {
        const published = await getRelease();
        return resolvePublishedCustomOperationArtifact({
          release: published.release,
          ownerId: input.ownerId,
          projectId: request.projectId,
          releaseId: request.releaseId,
          operationId: request.operationId,
        });
      } catch { return null; }
    },
    reserveUsage(request: { projectId: string; releaseId: string; operationId: string }) {
      return reserveWebsiteCustomExecutionUsage(input.platform as SupabaseClient, input.ownerId, request);
    },
    completeUsage(reservationId: string, _request: unknown, durationMs: number, status: 'success' | 'error') {
      return completeWebsiteCustomExecutionUsage(input.platform as SupabaseClient, input.ownerId, reservationId, durationMs, status);
    },
  };

  return servePublishedCustomOperationRequest({
    request: input.request,
    ownerId: input.ownerId,
    projectId: input.projectId,
    applicationOrigin: input.applicationOrigin,
    dependencies,
  });
}
