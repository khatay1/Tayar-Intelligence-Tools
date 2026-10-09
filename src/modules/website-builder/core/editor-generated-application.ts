import type { AIWebsiteGeneration } from './editor-ai-patch-review';
import type { WebsitePage } from './website-builder-model';
import type { ApplicationDefinition } from './application-model';
import { readApplicationDefinition } from './application-validation';
import { compileApplicationCreateForm } from './application-form-runtime';
import { compileApplicationDataView } from './application-data-view';
import { websiteProjectLinkIssues } from './website-project-links';

const bookingRequest = (prompt: string) => /\b(?:book(?:ing)? appointments?|appointments? booking|room booking|resource booking|reservations?|bokning|boka)\b|(?:حجز|حجوزات)/iu.test(prompt);

/** Never silently downgrade requested application behavior to a brochure. */
export function prepareGeneratedApplication(generated: AIWebsiteGeneration, pages: WebsitePage[], prompt: string): ApplicationDefinition | undefined {
  if (generated.projectKind !== undefined && !['website', 'application'].includes(generated.projectKind)) throw new Error('AI returned an invalid project kind.');
  if (generated.unsupportedFeatures !== undefined && (!Array.isArray(generated.unsupportedFeatures)
    || generated.unsupportedFeatures.length > 20 || generated.unsupportedFeatures.some(item => typeof item !== 'string' || !item.trim() || item.length > 300))) {
    throw new Error('AI returned invalid application requirements.');
  }
  if (generated.unsupportedFeatures?.length) throw new Error(`This request needs additional application features before it can be built: ${generated.unsupportedFeatures.join('; ')}. No incomplete application was applied.`);
  const counterRequested = /\b(?:stock (?:adjustments?|management)|inventory management|quota management|points system)\b|(?:إدارة المخزون|تعديل المخزون|إدارة الحصص|نظام النقاط)/iu.test(prompt);
  const transactionRequested = /\b(?:multi[ -]?item orders?|order management|inventory reservations?|stock reservations?|material issuance|usage allocation)\b|(?:إدارة الطلبات|طلب متعدد العناصر|حجز المخزون|صرف المواد)/iu.test(prompt);
  const requested = /\b(?:patient portal|staff portal|admin portal|sign[ -]?in|log[ -]?in|authentication|database|book(?:ing)? appointments?|appointment booking|data dashboard|record management|crud|data editor)\b|(?:حجز المواعيد|حجز موعد|تسجيل الدخول|قاعدة بيانات|بوابة المرضى|بوابة الموظفين|إدارة السجلات|عرض السجلات|لوحة بيانات)/iu.test(prompt);
  if (generated.application === undefined) {
    if (generated.projectKind === 'application' || requested || counterRequested || transactionRequested || bookingRequest(prompt) || pages.some(page => page.sections.some(section => section.applicationFormBinding || section.applicationDataView))) {
      throw new Error('This request needs a real application definition and bound forms. AI returned only pages; no incomplete application was applied.');
    }
    return undefined;
  }
  const raw = structuredClone(generated.application);
  if (Array.isArray(raw.pageAccess)) raw.pageAccess = raw.pageAccess.map(rule => {
    const page = pages.find(page => page.slug === rule.pageId);
    if (!page) throw new Error('An application access rule targets a page that was not generated. Reduce the page count or regenerate the complete application.');
    return { ...rule, pageId: page.id };
  });
  const definition = readApplicationDefinition(raw, new Set(pages.map(page => page.id)));
  if (!definition.auth.enabled && !definition.tables.length) throw new Error('AI returned an empty application instead of the requested functionality.');
  if (!Array.isArray(generated.requirements) || !generated.requirements.length || generated.requirements.length > 100) {
    throw new Error('AI did not return a complete requirements manifest. No unverifiable application was applied.');
  }
  let dataViews = 0;
  let bookingCreates = 0;
  let counterViews = 0;
  let transactionViews = 0;
  const evidence = new Set<string>();
  if (definition.auth.enabled) evidence.add('auth');
  for (const page of pages) evidence.add(`page:${page.slug}`);
  for (const page of pages) for (const section of page.sections) {
    if (section.applicationDataView !== undefined) {
      if (section.type === 'contact' || section.type === 'footer') throw new Error('Data views require a content section.');
      const view = compileApplicationDataView(definition, section.applicationDataView);
      if (view.table.booking && view.binding.actions.includes('create')) bookingCreates++;
      if (view.table.counter && view.binding.actions.includes('adjust')) counterViews++;
      if (view.table.transaction && view.binding.actions.includes('transact')) transactionViews++;
      for (const action of view.binding.actions) evidence.add(`view:${view.table.id}:${action}`);
      if (view.table.booking && view.binding.actions.includes('create')) evidence.add(`booking:${view.table.id}`);
      if (view.table.counter && view.binding.actions.includes('adjust')) evidence.add(`counter:${view.table.id}`);
      if (view.table.transaction && view.binding.actions.includes('transact')) evidence.add(`transaction:${view.table.id}`);
      if (view.table.workflow && view.binding.actions.includes('transition')) evidence.add(`workflow:${view.table.id}`);
      if (view.table.fields.some(field => field.formula && view.binding.columns.includes(field.id))) evidence.add(`formula:${view.table.id}`);
      dataViews++;
    }
    if (section.type === 'contact' && !section.applicationFormBinding) throw new Error('Every form in a customer-owned application must be bound to its application data.');
    if (section.applicationFormBinding) {
      for (const field of section.formFields ?? []) {
        if (!field || typeof field !== 'object' || Array.isArray(field) || typeof field.id !== 'string' || !field.id || field.id.length > 120
          || typeof field.name !== 'string' || typeof field.label !== 'string' || !field.label.trim() || field.label.length > 160
          || typeof field.required !== 'boolean' || (field.placeholder !== undefined && (typeof field.placeholder !== 'string' || field.placeholder.length > 300))
          || (field.options !== undefined && (!Array.isArray(field.options) || field.options.length > 100 || field.options.some(option => typeof option !== 'string' || option.length > 200)))) throw new Error('AI returned invalid form fields.');
        if (Object.keys(field).some(key => !['id', 'name', 'label', 'type', 'required', 'options', 'placeholder', 'validation'].includes(key))) throw new Error('AI returned unsupported form configuration.');
      }
      compileApplicationCreateForm(definition, section, section.applicationFormBinding);
      evidence.add(`form:${section.applicationFormBinding.tableId}`);
      if (definition.tables.find(table => table.id === section.applicationFormBinding!.tableId)?.booking) bookingCreates++;
      if (definition.tables.find(table => table.id === section.applicationFormBinding!.tableId)?.booking) evidence.add(`booking:${section.applicationFormBinding.tableId}`);
    }
  }
  if (bookingRequest(prompt) && !bookingCreates) throw new Error('Appointment booking requires a bound create form or data view with a database booking rule; ordinary records cannot replace conflict-safe booking.');
  if (/\b(?:data dashboard|record management|crud|data editor)\b|(?:إدارة السجلات|عرض السجلات|لوحة بيانات)/iu.test(prompt) && !dataViews) throw new Error('Record management requires a bound data view; descriptive pages cannot replace it.');
  if (counterRequested && !counterViews) throw new Error('Quantity management requires a bound adjustment view and a native counter rule.');
  if (transactionRequested && !transactionViews) throw new Error('Multi-item transactions require a bound transaction view and native parent, line and counter rules.');
  const requirementIds = new Set<string>();
  const allowedCapabilities = new Set(['page', 'auth', 'form', 'records', 'booking', 'counter', 'transaction', 'workflow', 'formula']);
  const capabilityEvidence: Record<string, string> = { page: 'page:', auth: 'auth', form: 'form:', records: 'view:', booking: 'booking:', counter: 'counter:', transaction: 'transaction:', workflow: 'workflow:', formula: 'formula:' };
  const items = generated.requirements.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || Object.keys(item).some(key => !['id', 'summary', 'capability', 'evidence'].includes(key))
      || typeof item.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(item.id) || requirementIds.has(item.id)
      || typeof item.summary !== 'string' || !item.summary.trim() || item.summary.length > 300
      || !allowedCapabilities.has(String(item.capability))
      || !Array.isArray(item.evidence) || !item.evidence.length || item.evidence.length > 20
      || item.evidence.some(entry => typeof entry !== 'string' || !evidence.has(entry))) {
      throw new Error(`Requirement ${index + 1} is incomplete or cites functionality that was not generated. No incomplete application was applied.`);
    }
    const expected = capabilityEvidence[item.capability];
    if (!item.evidence.some(entry => expected === 'auth' ? entry === expected : entry.startsWith(expected))) {
      throw new Error(`Requirement ${item.id} has no evidence for its declared capability. No incomplete application was applied.`);
    }
    requirementIds.add(item.id);
    return {
      id: item.id,
      summary: item.summary.trim(),
      capability: item.capability,
      evidence: item.evidence.map(entry => {
        if (!entry.startsWith('page:')) return entry;
        const page = pages.find(candidate => candidate.slug === entry.slice(5));
        return `page:${page!.id}`;
      }),
    };
  });
  return readApplicationDefinition({ ...definition, requirements: { version: 1, request: prompt.slice(0, 4000), items } }, new Set(pages.map(page => page.id)));
}

/** Root-relative AI paths previously escaped /site/owner/project entirely.
 * Convert only exact, known project routes; unknown paths are errors. */
export function normalizeGeneratedPageLinks(pages: WebsitePage[]): WebsitePage[] {
  const convert = (href: string) => {
    if (!href.startsWith('/') || href.startsWith('//')) return href;
    const match = /^\/([^?#]*)(#[^?]*)?$/.exec(href);
    if (!match) return href;
    const slug = match[1].replace(/\.html$/, '');
    const page = slug === '' || slug === 'index' ? pages[0] : pages.find(page => page.slug === slug);
    return page ? `page:${page.slug}${match[2] ?? ''}` : href;
  };
  const next = pages.map(page => ({ ...page, sections: page.sections.map(section => ({ ...section,
    buttonUrl: convert(section.buttonUrl),
    elements: section.elements.map(element => element.type === 'button' && element.href ? { ...element, href: convert(element.href) } : element),
  })) }));
  const issues = websiteProjectLinkIssues(next);
  if (issues.length) throw new Error(`AI returned an incomplete link: ${issues[0].message}. No incomplete project was applied.`);
  return next;
}
