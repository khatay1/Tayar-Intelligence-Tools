import type { ApplicationDefinition } from '../core/application-model';
import type { ApplicationPublicBackend } from '../core/application-data-runtime';
import type { WebsiteSection } from '../core/types';
import { readApplicationDefinition } from '../core/application-validation';
import { validateOwnedApplicationAuthScreenConfig } from '../core/application-auth-controller';
import { preparePublishedApplicationForms } from '../core/application-published-forms';
import { preparePublishedApplicationDataViews } from '../core/application-published-data-views';
import { applicationAuthScreenResponse } from './websiteApplicationAuthScreenService';
import { addApplicationPageBootstrap } from './websiteApplicationPageBootstrapService';
import { serveOwnedWebsiteApplicationPage } from './websiteApplicationPageService';
import { handleOwnedWebsiteApplicationBrowserSession, ownedApplicationRequestWithBrowserSession } from './websiteApplicationSessionService';

export interface OwnedApplicationRouteManifest {
  projectId: string;
  applicationOrigin: string;
  expectedProjectRef: string;
  backend: ApplicationPublicBackend;
  definition: ApplicationDefinition;
  pages: ReadonlyArray<{ path: string; pageId: string; language: 'en' | 'ar' | 'sv'; sections: WebsiteSection[] }>;
}

/** The manifest and HTML loader must be built from one immutable customer-owned
 * deployment. Neither request parameters nor the mutable editor project can
 * select the backend, page identity or private HTML. */
export async function serveOwnedApplicationRoute(request: Request, manifest: OwnedApplicationRouteManifest,
  loadPage: (pageId: string) => Promise<Response>): Promise<Response> {
  const failure = (status: number, message: string) => new Response(request.method === 'HEAD' ? null : message, {
    status, headers: { 'cache-control': 'private, no-store', 'cdn-cache-control': 'no-store',
      'vercel-cdn-cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
  if (typeof window !== 'undefined') return failure(503, 'Application runtime is unavailable.');
  try {
    const pages = manifest.pages;
    if (!Array.isArray(pages) || !pages.length || pages.length > 100 || typeof loadPage !== 'function') throw new Error();
    const paths = new Set<string>(), ids = new Set<string>();
    for (const page of pages) {
      if (!page || !/^\/(?:[\p{L}\p{N}._-]+\/)*[\p{L}\p{N}._-]+\.html$/u.test(page.path)
        || page.path.split('/').some((segment: string) => segment === '.' || segment === '..')
        || !page.pageId || !['en', 'ar', 'sv'].includes(page.language)
        || !Array.isArray(page.sections) || paths.has(page.path) || ids.has(page.pageId)) throw new Error();
      paths.add(page.path); ids.add(page.pageId);
    }
    const definition = readApplicationDefinition(manifest.definition, ids);
    const configFor = (page: typeof pages[number]) => ({ mode: 'owned' as const, projectId: manifest.projectId,
      applicationOrigin: manifest.applicationOrigin, expectedProjectRef: manifest.expectedProjectRef,
      backend: manifest.backend, returnPath: page.path, signUpEnabled: definition.auth.signUpEnabled,
      language: page.language, roles: definition.roles.map(role => ({ id: role.id, name: role.name })) });
    validateOwnedApplicationAuthScreenConfig(configFor(pages[0]));
    const url = new URL(request.url);
    if (url.origin !== manifest.applicationOrigin) return failure(403, 'Origin not allowed.');
    if (url.pathname === '/api/application-session') {
      return handleOwnedWebsiteApplicationBrowserSession(request, { applicationOrigin: manifest.applicationOrigin,
        backend: manifest.backend, expectedProjectRef: manifest.expectedProjectRef, definition });
    }
    const page = pages.find(item => item.path === url.pathname);
    if (!page) return failure(404, 'Application page not found.');
    const config = configFor(page);
    const browserHtml = request.method === 'GET' && request.headers.get('accept')?.includes('text/html');
    if (browserHtml && definition.auth.enabled && url.searchParams.get('applicationAuth') === '1') {
      return applicationAuthScreenResponse(config, 200);
    }
    const authorized = ownedApplicationRequestWithBrowserSession(request, manifest);
    let response = await serveOwnedWebsiteApplicationPage({ request: authorized, pageId: page.pageId, pageIds: ids,
      definition, backend: manifest.backend, expectedProjectRef: manifest.expectedProjectRef,
      loadPage: () => loadPage(page.pageId) });
    if (browserHtml && definition.auth.enabled && response.status === 401) return applicationAuthScreenResponse(config, 401);
    if (browserHtml && response.status === 200 && definition.auth.enabled) {
      response = await addApplicationPageBootstrap(response, { ...config, definition, pageId: page.pageId,
        paths: [...paths], applicationForms: preparePublishedApplicationForms(definition, page.pageId, page.sections),
        applicationDataViews: preparePublishedApplicationDataViews(definition, page.pageId, page.sections) });
      response.headers.set('content-security-policy', "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https:; frame-src https:; object-src 'none'; base-uri 'none'; form-action 'self' https:; frame-ancestors 'none';");
    }
    return response;
  } catch { return failure(503, 'Application runtime is unavailable.'); }
}
