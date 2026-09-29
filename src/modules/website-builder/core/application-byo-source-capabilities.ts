import { readApplicationDefinition } from './application-validation';
import { readEditorIntegrationsFromProject } from './editor-integrations-project-host';
import type { ApplicationDefinition } from './application-model';

export interface ByoSourceCapabilities {
  definition: ApplicationDefinition;
  pageIds: string[];
  needs: { auth: boolean; database: boolean; privatePages: boolean; forms: boolean; integrations: boolean; cms: boolean };
  blockers: string[];
}

/** A source compiler must satisfy every capability in the saved project, not
 * silently export static HTML for a page whose behavior needs a backend. */
export function analyzeByoSourceCapabilities(snapshot: Record<string, unknown>, environment: 'preview' | 'production'): ByoSourceCapabilities {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)
    || !['preview', 'production'].includes(environment)
    || !Array.isArray(snapshot.pages) || !snapshot.pages.length || snapshot.pages.length > 100) {
    throw new Error('BYO source capabilities are unavailable.');
  }
  const ids = new Set<string>(), blockers: string[] = [];
  let forms = false;
  for (const page of snapshot.pages) {
    if (!page || typeof page.id !== 'string' || !page.id || ids.has(page.id)
      || !Array.isArray(page.sections) || page.sections.length > 100) throw new Error('BYO source page identity is unavailable.');
    ids.add(page.id);
    if (page.cmsTemplate) blockers.push('CMS template routes need a verified customer-owned data adapter.');
    for (const section of page.sections) {
      if (!section || typeof section !== 'object') throw new Error('BYO source section is unavailable.');
      forms ||= 'applicationFormBinding' in section;
      if ('cmsBinding' in section) blockers.push('CMS bindings need a verified customer-owned data adapter.');
      if (section.type === 'code' || section.type === 'embed'
        || Array.isArray(section.elements) && section.elements.some((element: { type?: string }) =>
          element?.type === 'code' || element?.type === 'embed')) {
        blockers.push('Custom code and embeds need a reviewed customer-owned runtime.');
      }
      if (section.type === 'contact' && !('applicationFormBinding' in section)) {
        blockers.push('Contact forms require a saved application form binding.');
      }
    }
  }
  const definition = readApplicationDefinition(snapshot.application, ids);
  const privatePages = definition.pageAccess.some(rule => rule.access !== 'public');
  const auth = definition.auth.enabled || privatePages || definition.roles.length > 0;
  const database = !!definition.tables.length || auth || forms;
  const cms = !!(snapshot.cms && typeof snapshot.cms === 'object'
    && Array.isArray((snapshot.cms as { collections?: unknown[] }).collections)
    && (snapshot.cms as { collections: unknown[] }).collections.length);
  if (cms) blockers.push('CMS collections need an asset and data export adapter.');
  const integrations = readEditorIntegrationsFromProject(snapshot).connections.some(connection =>
    connection.enabled && connection.environments.includes(environment));
  if (integrations) blockers.push('External integrations need customer-owned secrets and server execution.');
  if (forms && !definition.auth.enabled) blockers.push('Bound forms need configured application Auth and RLS.');
  return { definition, pageIds: [...ids], needs: { auth, database, privatePages, forms, integrations, cms },
    blockers: [...new Set(blockers)] };
}
