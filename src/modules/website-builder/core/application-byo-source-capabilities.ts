import { websiteProjectLinkIssues } from './website-project-links';
import { readApplicationDefinition } from './application-validation';
import { readEditorIntegrationsFromProject } from './editor-integrations-project-host';
import { validateEditorIntegrations } from './editor-integrations';
import type { ApplicationDefinition } from './application-model';

export interface ByoStripeCheckout {
  id: string;
  previewPriceId: string;
  productionPriceId: string;
}
export interface ByoSourceCapabilities {
  definition: ApplicationDefinition;
  pageIds: string[];
  needs: { auth: boolean; database: boolean; privatePages: boolean; forms: boolean; integrations: boolean; cms: boolean };
  integrationProviders: string[];
  stripeCheckouts: ByoStripeCheckout[];
  blockers: string[];
}

const checkoutId=/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/;
const price=/^price_[A-Za-z0-9]{8,128}$/;

/** A source compiler must satisfy every capability in the saved project, not
 * silently export static HTML for a page whose behavior needs a backend. */
export function analyzeByoSourceCapabilities(snapshot: Record<string, unknown>, environment: 'preview' | 'production'): ByoSourceCapabilities {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)
    || !['preview', 'production'].includes(environment)
    || !Array.isArray(snapshot.pages) || !snapshot.pages.length || snapshot.pages.length > 100) {
    throw new Error('BYO source capabilities are unavailable.');
  }
  const ids = new Set<string>(), checkoutIds=new Set<string>(), blockers: string[] = [];
  const stripeCheckouts:ByoStripeCheckout[]=[];
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
      if(Array.isArray(section.elements))for(const raw of section.elements){
        if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;
        const element=raw as Record<string,unknown>;
        if(element.type!=='button'||element.action!=='stripe-checkout')continue;
        const id=typeof element.id==='string'?element.id:'';
        const previewPriceId=typeof element.stripePreviewPriceId==='string'?element.stripePreviewPriceId.trim():'';
        const productionPriceId=typeof element.stripeProductionPriceId==='string'?element.stripeProductionPriceId.trim():'';
        if(!checkoutId.test(id)||checkoutIds.has(id)||!price.test(previewPriceId)||!price.test(productionPriceId)){
          blockers.push('Stripe checkout buttons require unique IDs plus valid Preview and Production Price IDs.');
          continue;
        }
        checkoutIds.add(id);stripeCheckouts.push({id,previewPriceId,productionPriceId});
      }
    }
  }
  blockers.push(...websiteProjectLinkIssues(snapshot.pages, typeof snapshot.homePageId === 'string' ? snapshot.homePageId : undefined).map(issue => issue.message));
  const definition = readApplicationDefinition(snapshot.application, ids);
  const privatePages = definition.pageAccess.some(rule => rule.access !== 'public');
  const auth = definition.auth.enabled || privatePages || definition.roles.length > 0;
  const database = !!definition.tables.length || auth || forms;
  const cms = !!(snapshot.cms && typeof snapshot.cms === 'object'
    && Array.isArray((snapshot.cms as { collections?: unknown[] }).collections)
    && (snapshot.cms as { collections: unknown[] }).collections.length);
  if (cms) blockers.push('CMS collections need an asset and data export adapter.');

  const integrationConfig=readEditorIntegrationsFromProject(snapshot);
  const active=integrationConfig.connections.filter(connection=>connection.enabled&&connection.status!=='disabled'
    &&connection.environments.includes(environment));
  const integrationProviders=[...new Set(active.map(connection=>connection.providerId))].sort();
  const issues=validateEditorIntegrations({version:1,connections:active});
  if(issues.length)blockers.push('Active integrations contain invalid configuration or credential references.');
  if(active.some(connection=>connection.providerId!=='stripe'))
    blockers.push('External integrations other than Stripe checkout still need a customer-owned runtime adapter.');
  const stripe=active.filter(connection=>connection.providerId==='stripe');
  if(stripe.some(connection=>(connection.events?.length??0)>0))
    blockers.push('Stripe event automation is not deployed yet; checkout buttons are supported without integration events.');
  if(stripeCheckouts.length&&stripe.length!==1)
    blockers.push('Stripe checkout requires exactly one enabled Stripe connection for this environment.');

  if (forms && !definition.auth.enabled) blockers.push('Bound forms need configured application Auth and RLS.');
  return { definition, pageIds: [...ids], needs: { auth, database, privatePages, forms,
    integrations: active.length>0||stripeCheckouts.length>0, cms }, integrationProviders,stripeCheckouts,
    blockers: [...new Set(blockers)] };
}
