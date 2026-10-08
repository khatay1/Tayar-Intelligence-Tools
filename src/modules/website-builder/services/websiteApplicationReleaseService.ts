import { websiteProjectReleaseDigest } from '../core/website-project-release-digest';
import { renderWebsiteApplicationSnapshot } from './websiteApplicationRenderService';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readApplicationDefinition } from '../core/application-validation';
import type { ApplicationPublicBackend } from '../core/application-data-runtime';
import { assertValidPublishedWebsiteBundle, type PublishedWebsiteBundleFile } from '../core/published-site-validation';
import { verifySavedWebsiteApplicationBackend } from './websiteApplicationBackendService';
import { createStoredApplicationRevisionReader } from './websiteApplicationBackendLinkService';
import { assertApplicationFormRequestCapability } from '../core/application-backend-verification';
import { validateWebsiteApplicationRelease } from './websiteApplicationPublishedService';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bucket = 'website-application-releases';
type ReleaseFile = PublishedWebsiteBundleFile & { pageId: string };
export type ApplicationReleaseResult =
  | { status: 'active'; versionId: string }
  | { status: 'recovery-required'; versionId: string }
  | { status: 'failed'; cleanupRequired: boolean; versionId?: string };

/** Trusted server orchestration, not a public HTTP endpoint. The renderer must be
 * server-owned; never accept caller-supplied HTML or a caller-supplied owner ID.
 * No public storage writes. Activation and snapshot comparison are one DB transaction.
 * After a commit request begins, preserve artifacts even on transport failure:
 * the DB may have committed and deleting them could break the active release.
 */
export async function publishWebsiteApplicationRelease(input: {
  platform: Pick<SupabaseClient, 'auth' | 'from' | 'rpc' | 'storage'>;
  platformUrl: string;
  accessToken: string;
  projectId: string;
  publishedUrl: string;
  releaseNote?: string;
  expectedSnapshotDigest?: string;
  renderSnapshot?: (snapshot: Record<string, unknown>, backend: ApplicationPublicBackend) => Promise<ReleaseFile[]>;
}): Promise<ApplicationReleaseResult> {
  if (typeof window !== 'undefined') throw new Error('Private releases require a server runtime.');
  const { platform, platformUrl, accessToken, projectId, publishedUrl, renderSnapshot } = input;
  const renderSaved = renderSnapshot ?? renderWebsiteApplicationSnapshot;
  const expectedSnapshotDigest = input.expectedSnapshotDigest;
  const releaseNote = input.releaseNote ?? '';
  let versionId: string | undefined;
  let attemptedPaths: string[] = [];
  let commitStarted = false;
  try {
    if (!uuid.test(projectId) || !accessToken || accessToken.length > 16_384 || releaseNote.length > 500
      || publishedUrl.length > 2000 || new URL(publishedUrl).protocol !== 'https:') throw new Error();
    const identity = await platform.auth.getUser(accessToken);
    const ownerId = identity.data.user?.id;
    if (identity.error || !ownerId || !uuid.test(ownerId) || identity.data.user?.is_anonymous) throw new Error();
    const saved = await platform.from('projects').select('content').eq('id', projectId)
      .eq('user_id', ownerId).eq('type', 'website-builder').is('deleted_at', null).maybeSingle();
    if (saved.error || !saved.data?.content || typeof saved.data.content !== 'object' || Array.isArray(saved.data.content)) throw new Error();
    // Capture the whole saved project before any remote operation or rendering.
    const serialized = JSON.stringify(saved.data.content);
    if (new TextEncoder().encode(serialized).byteLength > 2_000_000) throw new Error();
    const snapshot = JSON.parse(serialized) as Record<string, unknown>;
    if (expectedSnapshotDigest !== undefined && (!/^[a-f0-9]{64}$/.test(expectedSnapshotDigest) || await websiteProjectReleaseDigest(snapshot) !== expectedSnapshotDigest)) throw new Error();
    const definition = readApplicationDefinition(snapshot.application);
    const verifyBackend = () => verifySavedWebsiteApplicationBackend({ platform, platformUrl, projectId, definition,
      createRevisionReader: backend => createStoredApplicationRevisionReader({ platform, platformUrl, projectId, backend }),
    });
    const backend = await verifyBackend();
    const hasBoundForm = Array.isArray(snapshot.pages) && snapshot.pages.some(page => {
      if (!page || typeof page !== 'object' || !Array.isArray(page.sections)) return false;
      return page.sections.some((section: unknown) => !!section && typeof section === 'object'
        && ('applicationFormBinding' in section || ('applicationDataView' in section
          && Array.isArray((section.applicationDataView as { actions?: unknown } | undefined)?.actions)
          && (section.applicationDataView as { actions: unknown[] }).actions.includes('create'))));
    });
    if (hasBoundForm) {
      const reader = await createStoredApplicationRevisionReader({ platform, platformUrl, projectId, backend });
      await assertApplicationFormRequestCapability(backend, platformUrl, reader);
      // The capability is necessary but not sufficient: published form execution
      // and stable browser request identity must pass before this gate opens.
      throw new Error('Application form publishing is unavailable.');
    }
    const rendered = await renderSaved(JSON.parse(serialized), { ...backend });
    // Copy renderer output before awaits; the renderer cannot mutate uploaded files later.
    const files = rendered.map(file => ({ name: file.name, content: file.content, contentType: file.contentType, pageId: file.pageId }));
    assertValidPublishedWebsiteBundle(files);
    let totalBytes = 0;
    for (const file of files) {
      if (typeof file.content !== 'string') throw new Error();
      const bytes = new TextEncoder().encode(file.content).byteLength;
      if (!bytes || bytes > 16 * 1024 * 1024) throw new Error();
      totalBytes += bytes;
    }
    if (totalBytes > 32 * 1024 * 1024) throw new Error();
    versionId = crypto.randomUUID();
    const storagePrefix = `${ownerId}/${projectId}/versions/${versionId}`;
    const manifest = files.map(({ name, contentType, pageId }) => ({ name, contentType, pageId }));
    validateWebsiteApplicationRelease({ id: versionId, project_id: projectId, user_id: ownerId, backend,
      storage_bucket: bucket, storage_prefix: storagePrefix, snapshot, file_manifest: manifest }, projectId, ownerId, platformUrl);
    // Refuse a transition with legacy public copies. A production transition also
    // requires auditing service-role writers; this helper does not open the publish gate.
    const publicFiles = await platform.storage.from('published-sites').list(`${ownerId}/${projectId}`, { limit: 1 });
    if (publicFiles.error || !publicFiles.data || publicFiles.data.length) throw new Error();
    for (const file of files) {
      const path = `${storagePrefix}/${file.name}`;
      attemptedPaths.push(path);
      const uploaded = await platform.storage.from(bucket).upload(path, file.content, {
        contentType: file.contentType, cacheControl: '0', upsert: false,
      });
      if (uploaded.error) throw new Error();
    }
    const currentBackend = await verifyBackend();
    if (JSON.stringify(currentBackend) !== JSON.stringify(backend)) throw new Error();
    commitStarted = true;
    const committed = await platform.rpc('website_commit_application_release', {
      p_project_id: projectId, p_owner_id: ownerId, p_version_id: versionId,
      p_snapshot: snapshot, p_backend: backend, p_file_manifest: manifest,
      p_published_url: publishedUrl, p_release_note: releaseNote,
    });
    if (committed.error || committed.data !== versionId) return { status: 'recovery-required', versionId };
    return { status: 'active', versionId };
  } catch {
    if (commitStarted && versionId) return { status: 'recovery-required', versionId };
    let cleanupRequired = false;
    if (attemptedPaths.length) {
      try { cleanupRequired = !!(await platform.storage.from(bucket).remove(attemptedPaths)).error; }
      catch { cleanupRequired = true; }
    }
    attemptedPaths = [];
    return { status: 'failed', cleanupRequired, ...(versionId ? { versionId } : {}) };
  }
}

/** Read-only reconciliation for a commit whose response was lost. "Unresolved"
 * never authorizes cleanup: an in-flight database transaction may still commit.
 * "Selected" describes the release pointer, not live backend/browser readiness.
 */
export async function inspectWebsiteApplicationReleaseOutcome(input: {
  platform: Pick<SupabaseClient, 'auth' | 'rpc'>;
  accessToken: string;
  projectId: string;
  versionId: string;
}): Promise<'selected' | 'recorded' | 'unresolved' | 'unavailable'> {
  if (typeof window !== 'undefined') throw new Error('Private releases require a server runtime.');
  const { platform, accessToken, projectId, versionId } = input;
  try {
    if (!uuid.test(projectId) || !uuid.test(versionId) || !accessToken || accessToken.length > 16_384) return 'unavailable';
    const identity = await platform.auth.getUser(accessToken);
    const ownerId = identity.data.user?.id;
    if (identity.error || !ownerId || !uuid.test(ownerId) || identity.data.user?.is_anonymous) return 'unavailable';
    const result = await platform.rpc('website_application_release_outcome', { p_project_id: projectId, p_owner_id: ownerId, p_version_id: versionId });
    if (result.error || !['selected', 'recorded', 'unresolved'].includes(result.data)) return 'unavailable';
    return result.data;
  } catch { return 'unavailable'; }
}
