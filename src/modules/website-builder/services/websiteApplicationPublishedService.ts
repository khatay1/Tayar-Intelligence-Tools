import { addApplicationPageBootstrap } from './websiteApplicationPageBootstrapService';
import { applicationAuthScreenResponse } from './websiteApplicationAuthScreenService';
import { applicationRequestWithBrowserSession } from './websiteApplicationSessionService';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readApplicationDefinition } from '../core/application-validation';
import { assertApplicationBackendRevision } from '../core/application-backend-verification';
import { validateApplicationPublicBackend, type ApplicationPublicBackend } from '../core/application-data-runtime';
import { assertValidPublishVersionArchive } from '../core/publish-version-archive-validation';
import { normalizeWebsiteLocalization, websitePageOutputPath, type WebsiteLocalizationConfig } from '../core/website-localization';
import type { WebsitePage } from '../core/website-builder-model';
import { createDedicatedApplicationRevisionReader } from './websiteApplicationBackendService';
import { assertDedicatedApplicationAuthSettings } from './websiteApplicationAuthSettingsService';
import { serveWebsiteApplicationPage } from './websiteApplicationPageService';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const failure = (status: number) => new Response(status === 404 ? 'Published application page not found.' : 'Published application is unavailable.', {
  status, headers: { 'cache-control': 'private, no-store', 'cdn-cache-control': 'no-store', 'vary': 'Authorization, Cookie' },
});

/** Shared by the trusted uploader and runtime so file/page authorization cannot drift. */
export function validateWebsiteApplicationRelease(release: unknown, projectId: string, ownerId: string, platformUrl: string) {
  if (!record(release) || typeof release.id !== 'string' || !uuid.test(release.id)
    || release.project_id !== projectId || release.user_id !== ownerId || release.storage_bucket !== 'website-application-releases'
    || typeof release.storage_prefix !== 'string' || !record(release.snapshot) || !record(release.backend)) throw new Error('Invalid private release.');
  const snapshot = release.snapshot;
  if (!snapshot.application || !Array.isArray(snapshot.pages) || !snapshot.pages.length || snapshot.pages.length > 100
    || typeof snapshot.homePageId !== 'string') throw new Error('Invalid private release.');
  const pages = snapshot.pages;
  if (pages.some(page => !record(page) || typeof page.id !== 'string' || typeof page.slug !== 'string'
    || (page.language !== undefined && (typeof page.language !== 'string' || !['en', 'ar', 'sv'].includes(page.language)))
    || (page.translationKey !== undefined && typeof page.translationKey !== 'string'))) throw new Error('Invalid private release.');
  const pageIds = new Set(pages.map(page => page.id as string));
  if (pageIds.size !== pages.length || !pageIds.has(snapshot.homePageId)) throw new Error('Invalid private release.');
  const definition = readApplicationDefinition(snapshot.application, pageIds);
  const backend: ApplicationPublicBackend = {
    url: String(release.backend.url ?? ''), projectRef: String(release.backend.projectRef ?? ''), publishableKey: String(release.backend.publishableKey ?? ''),
  };
  validateApplicationPublicBackend(backend, platformUrl);
  const manifest = release.file_manifest;
  if (!Array.isArray(manifest) || manifest.some(item => !record(item) || typeof item.name !== 'string'
    || !/^[\p{L}\p{N}][\p{L}\p{N}._/-]{0,500}$/u.test(item.name) || typeof item.pageId !== 'string' || !pageIds.has(item.pageId)
    || typeof item.contentType !== 'string' || !/^[a-z]+\/[a-z0-9.+-]+(?:; charset=utf-8)?$/i.test(item.contentType))) throw new Error('Invalid private release.');
  assertValidPublishVersionArchive({ versionId: release.id, projectId, ownerId, storagePrefix: release.storage_prefix, fileManifest: manifest });
  // Reuse the exporter's route mapping; never let a protected HTML page claim a public page ID.
  const localization = normalizeWebsiteLocalization(snapshot.localization as Partial<WebsiteLocalizationConfig> | undefined);
  const htmlPaths = new Map<string, string>();
  for (const page of pages) {
    const path = websitePageOutputPath(page as WebsitePage, pages as WebsitePage[], snapshot.homePageId, localization);
    if (htmlPaths.has(path)) throw new Error('Invalid private release.');
    htmlPaths.set(path, page.id);
  }
  if (manifest.some(item => /^text\/html(?:;|$)/i.test(item.contentType) !== /\.html?$/i.test(item.name)
    || (/\.html?$/i.test(item.name) && htmlPaths.get(item.name) !== item.pageId))) throw new Error('Invalid private release.');
  return { release, definition, backend, manifest, pageIds };
}

/** NULL means an ordinary static site. Once private mode is selected, every
 * failure returns a response and MUST NOT fall through to public storage.
 * Uses the existing immutable publish-version snapshot, never the edited draft.
 */
export async function servePublishedWebsiteApplication(input: {
  request: Request;
  ownerId: string;
  projectId: string;
  file: string;
  preview?: boolean;
  browserSession?: { applicationOrigin: string; platformOrigin: string };
  platformUrl: string;
  platform: Pick<SupabaseClient, 'rpc' | 'storage'>;
}): Promise<Response | null> {
  if (typeof window !== 'undefined') throw new Error('Private application publishing requires a server runtime.');
  const { projectId, ownerId, platform, platformUrl, request, file } = input;
  if (!uuid.test(projectId) || !uuid.test(ownerId)) return failure(400);
  try {
    const load = () => platform.rpc('website_application_published_release', { p_project_id: projectId, p_owner_id: ownerId });
    const result = await load();
    if (result.error) return failure(503);
    if (result.data === null) return null;
    if (!record(result.data) || result.data.enabled !== true) return failure(503);
    if (input.preview) return failure(404);
    const release = result.data.release;
    if (release === null) return failure(404);
    const validated = validateWebsiteApplicationRelease(release, projectId, ownerId, platformUrl);
    const { definition, backend, manifest, pageIds } = validated;
    const storedRelease = validated.release;
    const entry = manifest.find(item => item.name === file);
    if (!entry) return failure(404);
    const credential = await platform.rpc('website_application_release_credential', { p_project_id: projectId, p_version_id: storedRelease.id });
    if (credential.error || typeof credential.data !== 'string') return failure(503);
    const reader = createDedicatedApplicationRevisionReader(backend, platformUrl, credential.data);
    await Promise.all([
      assertApplicationBackendRevision(definition, backend, platformUrl, reader),
      assertDedicatedApplicationAuthSettings(definition, backend, platformUrl),
    ]);
    const authorizedRequest = input.browserSession ? applicationRequestWithBrowserSession(request, { ...input.browserSession, projectId }) : request;
    const isolatedHtmlBrowser = input.browserSession && new URL(request.url).origin === input.browserSession.applicationOrigin
      && request.method === 'GET' && request.headers.get('accept')?.includes('text/html')
      && /^text\/html(?:;|$)/i.test(entry.contentType) && definition.auth.enabled;
    const browserConfig = () => {
      const snapshot = storedRelease.snapshot as Record<string, unknown>;
      const pages = snapshot.pages as Array<Record<string, unknown>>;
      const page = pages.find(item => item.id === entry.pageId);
      const language = page?.language ?? normalizeWebsiteLocalization(snapshot.localization as Partial<WebsiteLocalizationConfig> | undefined).defaultLanguage;
      return { ...input.browserSession!, projectId, ownerId, backend, platformUrl,
        returnPath: `/site/${ownerId}/${projectId}/${file.split('/').map(encodeURIComponent).join('/')}`,
        signUpEnabled: definition.auth.signUpEnabled, language: (language === 'ar' || language === 'sv' ? language : 'en') as 'ar' | 'sv' | 'en',
      };
    };
    const authScreen = (status: 200 | 401) => applicationAuthScreenResponse(browserConfig(), status);
    // Account management is a separate trusted shell, not a private-content bypass.
    if (isolatedHtmlBrowser && new URL(request.url).searchParams.get('applicationAuth') === '1') return authScreen(200);
    let response = await serveWebsiteApplicationPage({ request: authorizedRequest, pageId: entry.pageId, pageIds, definition, backend, platformUrl, async loadPage() {
      const current = await load();
      if (current.error || JSON.stringify(current.data) !== JSON.stringify(result.data)) throw new Error('Release changed.');
      const object = await platform.storage.from('website-application-releases').download(`${storedRelease.storage_prefix}/${entry.name}`);
      if (object.error || !object.data || object.data.size > 16 * 1024 * 1024) throw new Error('Private page unavailable.');
      return new Response(object.data, { headers: { 'content-type': entry.contentType } });
    } });
    if (isolatedHtmlBrowser && response.status === 401) return authScreen(401);
    if (isolatedHtmlBrowser && response.status === 200) {
      const prefix = `/site/${ownerId}/${projectId}/`;
      const paths = manifest.filter(item => /^text\/html(?:;|$)/i.test(item.contentType))
        .map(item => prefix + item.name.split('/').map(encodeURIComponent).join('/'));
      if (paths.includes(prefix + 'index.html')) paths.push(prefix, prefix.slice(0, -1));
      response = await addApplicationPageBootstrap(response, { ...browserConfig(), definition, paths });
    }
    if (input.browserSession && new URL(request.url).origin === input.browserSession.applicationOrigin) {
      // Only the per-project isolated host may use its own localStorage/Auth SDK.
      // Shared Tayar-origin pages retain the existing opaque-origin sandbox.
      response.headers.set('content-security-policy', "sandbox allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation; default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https:; frame-src https:; object-src 'none'; base-uri 'none'; form-action 'self' https:;");
    }
    return response;
  } catch { return failure(503); }
}
