import { readApplicationDefinition } from '../core/application-validation';
import { readEditorIntegrationsFromProject } from '../core/editor-integrations-project-host';
import { renderWebsiteApplicationSnapshot } from './websiteApplicationRenderService';
import { validateGitHubSourceManifest, type GitHubSourceFile } from './websiteGithubExportTransport';

const safeSections = new Set(['hero', 'features', 'about', 'services', 'pricing', 'testimonials', 'footer']);
const secretPattern = /(?:secret:\/\/|sb_secret_|\bservice_role\b|\bsk_(?:test|live)_[a-zA-Z0-9]{8,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|\/api\/application-session|\/functions\/v1\/website-form-submit|track_website_page_view)/i;

/** A deliberately bounded static source compiler for the user-owned repo. It
 * does not attempt to simulate Auth, CRUD, contact submissions or payments.
 * Full-stack projects remain blocked until their independent runtime exists. */
export async function compileWebsiteByoStaticSource(snapshot: Record<string, unknown>, input: {
  environment: 'preview' | 'production';
  platformOrigin: string;
  platformUrl: string;
}): Promise<GitHubSourceFile[]> {
  if (typeof window !== 'undefined' || !snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)
    || !['preview', 'production'].includes(input.environment)) throw new Error('BYO source compilation is unavailable.');
  const platformOrigin = new URL(input.platformOrigin);
  const platformUrl = new URL(input.platformUrl);
  if (platformOrigin.protocol !== 'https:' || platformOrigin.origin !== input.platformOrigin
    || platformUrl.protocol !== 'https:' || platformUrl.origin !== input.platformUrl) {
    throw new Error('BYO source platform identity is unavailable.');
  }
  if (!Array.isArray(snapshot.pages) || !snapshot.pages.length || snapshot.pages.length > 100) {
    throw new Error('BYO source pages are unavailable.');
  }
  const pages = snapshot.pages as Array<Record<string, unknown>>;
  const pageIds = new Set(pages.map(page => String(page?.id ?? '')));
  const app = readApplicationDefinition(snapshot.application, pageIds);
  if (app.tables.length || app.roles.length || app.auth.enabled || app.pageAccess.some(rule => rule.access !== 'public')) {
    throw new Error('BYO application runtime is required before exporting this project.');
  }
  if (readEditorIntegrationsFromProject(snapshot).connections.some(connection =>
    connection.enabled && connection.environments.includes(input.environment))) {
    throw new Error('BYO integration runtime is required before exporting this project.');
  }
  const cms = snapshot.cms as Record<string, unknown> | undefined;
  if (cms && (!Array.isArray(cms.collections) || cms.collections.length)) {
    throw new Error('BYO CMS asset/runtime export is unavailable.');
  }
  for (const page of pages) {
    if (!page || page.cmsTemplate || !Array.isArray(page.sections)) throw new Error('BYO source page is unsupported.');
    for (const section of page.sections as Array<Record<string, unknown>>) {
      if (!section || !safeSections.has(String(section.type)) || section.applicationFormBinding !== undefined
        || section.cmsBinding !== undefined || !Array.isArray(section.elements)
        || section.elements.some((element: Record<string, unknown>) => !element || ['code', 'embed'].includes(String(element.type)))) {
        throw new Error('BYO source requires a user-owned backend or reviewed integration runtime.');
      }
    }
  }
  const rendered = await renderWebsiteApplicationSnapshot(snapshot);
  const repeated = await renderWebsiteApplicationSnapshot(snapshot);
  if (rendered.length !== repeated.length || rendered.some((file, index) =>
    file.name !== repeated[index].name || file.content !== repeated[index].content)) {
    throw new Error('BYO source rendering is not deterministic. Save complete page elements before exporting.');
  }
  const files: GitHubSourceFile[] = [
    { path: 'vercel.json', content: JSON.stringify({ $schema: 'https://openapi.vercel.sh/vercel.json',
      framework: null, outputDirectory: 'public', buildCommand: null }, null, 2) + '\n' },
    ...rendered.map(file => ({ path: `public/${file.name}`, content: file.content })),
  ];
  for (const file of files) {
    if (secretPattern.test(file.content) || file.content.includes(input.platformOrigin)
      || file.content.includes(input.platformUrl)) throw new Error('BYO source contains platform runtime or credential material.');
  }
  validateGitHubSourceManifest(files);
  return files;
}
