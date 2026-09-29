import { build } from 'esbuild';
import { analyzeByoSourceCapabilities } from '../src/modules/website-builder/core/application-byo-source-capabilities';
import { validateOwnedApplicationPublicBackend, type ApplicationPublicBackend } from '../src/modules/website-builder/core/application-data-runtime';
import { renderWebsiteApplicationSnapshot } from '../src/modules/website-builder/services/websiteApplicationRenderService';
import { validateGitHubSourceManifest, type GitHubSourceFile } from '../src/modules/website-builder/services/websiteGithubExportTransport';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeRoute = /^(?:[\p{L}\p{N}._-]+\/)*[\p{L}\p{N}._-]+\.html$/u;
const secrets = /(?:secret:\/\/|sb_secret_|\bservice_role\b|\bsk_(?:test|live)_[a-zA-Z0-9]{8,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----)/i;

/** Source-only package. The caller must obtain the snapshot and customer binding
 * from trusted owner-scoped persistence; this function never reads browser input.
 * The GitHub worker stays unmounted pending customer Supabase/Vercel verification. */
export async function compileWebsiteOwnedApplicationSource(snapshot: Record<string, unknown>, input: {
  projectId: string; applicationOrigin: string; expectedProjectRef: string; backend: ApplicationPublicBackend;
  environment: 'preview' | 'production'; platformOrigin: string; platformUrl: string;
}): Promise<GitHubSourceFile[]> {
  if (typeof window !== 'undefined' || !uuid.test(input.projectId)) throw new Error('Customer source scope is unavailable.');
  const origin = new URL(input.applicationOrigin);
  if (origin.protocol !== 'https:' || origin.origin !== input.applicationOrigin
    || origin.hostname.endsWith('.supabase.co') || origin.origin === new URL(input.backend.url).origin
    || ![input.platformOrigin, input.platformUrl].every(value => new URL(value).protocol === 'https:')) {
    throw new Error('Customer source origin is unavailable.');
  }
  validateOwnedApplicationPublicBackend(input.backend, input.expectedProjectRef);
  const capabilities = analyzeByoSourceCapabilities(snapshot, input.environment);
  if (capabilities.blockers.length || !capabilities.needs.database || !capabilities.definition.auth.enabled) {
    throw new Error('Customer application source requires supported Auth/data without unhandled capabilities.');
  }
  const rendered = await renderWebsiteApplicationSnapshot(snapshot);
  const again = await renderWebsiteApplicationSnapshot(snapshot);
  if (JSON.stringify(rendered) !== JSON.stringify(again) || rendered.length !== capabilities.pageIds.length) {
    throw new Error('Customer application rendering is not deterministic.');
  }
  const pages = snapshot.pages as Array<{ id: string; language?: string; sections: unknown[] }>;
  const routes = rendered.map(file => {
    const page = pages.find(item => item.id === file.pageId);
    if (!page || !safeRoute.test(file.name) || file.name.split('/').some(part => part === '.' || part === '..')
      || file.content.length > 500_000 || secrets.test(file.content)
      || file.content.includes(input.platformOrigin) || file.content.includes(input.platformUrl)) {
      throw new Error('Customer application page contains unsupported source.');
    }
    return { path: `/${file.name}`, pageId: file.pageId, language: ['ar', 'sv'].includes(page.language ?? '') ? page.language : 'en',
      sections: page.sections, html: file.content };
  });
  const routeKeys = new Set(routes.map(route => route.path.toLowerCase()));
  if (routeKeys.size !== routes.length) throw new Error('Customer application routes are ambiguous.');
  const manifest = { projectId: input.projectId, applicationOrigin: input.applicationOrigin,
    expectedProjectRef: input.expectedProjectRef, backend: input.backend, definition: capabilities.definition,
    pages: routes.map(({ html: _html, ...page }) => page) };
  const contents = `import { serveOwnedApplicationRoute } from './src/modules/website-builder/services/websiteOwnedApplicationRouteService';
const manifest = ${JSON.stringify(manifest)};
const pages = new Map(${JSON.stringify(routes.map(route => [route.pageId, route.html]))});
const paths = new Map(${JSON.stringify(routes.map(route => [route.pageId, route.path]))});
export default async function handler(request) {
  const url = new URL(request.url);
  const route = url.searchParams.get('tayarRoute');
  if (route === 'session') url.pathname = '/api/application-session';
  else if (route && paths.has(route)) url.pathname = paths.get(route);
  else return new Response('Application route not found.', { status: 404, headers: { 'cache-control': 'private, no-store' } });
  url.searchParams.delete('tayarRoute');
  return serveOwnedApplicationRoute(new Request(url, request), manifest, async pageId =>
    new Response(pages.get(pageId), { headers: { 'content-type': 'text/html; charset=utf-8' } }));
}`;
  const result = await build({ stdin: { contents, resolveDir: process.cwd(), loader: 'ts' },
    tsconfig: 'tsconfig.app.json', bundle: true, write: false, platform: 'node', format: 'cjs', target: 'node22' });
  const runtime = result.outputFiles[0].text + '\nmodule.exports = module.exports.default;\n';
  // Bundled Supabase SDK includes the literal role name "service_role" for its
  // own compatibility logic; reject key material rather than that code string.
  if (/(?:secret:\/\/|sb_secret_|\bsk_(?:test|live)_[a-zA-Z0-9]{8,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----)/i.test(runtime)
    || runtime.includes(input.platformOrigin) || runtime.includes(input.platformUrl)) {
    throw new Error('Customer application runtime contains platform or secret material.');
  }
  const rewrites = [
    { source: '/api/application-session', destination: '/api/application?tayarRoute=session' },
    ...routes.map(route => ({ source: route.path, destination: `/api/application?tayarRoute=${encodeURIComponent(route.pageId)}` })),
    { source: '/', destination: `/api/application?tayarRoute=${encodeURIComponent(rendered.find(file => file.name === 'index.html')!.pageId)}` },
  ];
  const files = [
    { path: 'package.json', content: JSON.stringify({ private: true, type: 'commonjs' }, null, 2) + '\n' },
    { path: 'vercel.json', content: JSON.stringify({ $schema: 'https://openapi.vercel.sh/vercel.json', framework: null,
      buildCommand: null, rewrites }, null, 2) + '\n' },
    { path: 'api/application.js', content: runtime },
  ];
  validateGitHubSourceManifest(files);
  return files;
}
