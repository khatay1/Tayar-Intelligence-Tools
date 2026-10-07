import type { AIWebsiteGeneration } from './editor-ai-patch-review';
import type { WebsitePage } from './website-builder-model';
import type { ApplicationDefinition } from './application-model';
import { readApplicationDefinition } from './application-validation';
import { compileApplicationCreateForm } from './application-form-runtime';
import { websiteProjectLinkIssues } from './website-project-links';

/** Never silently downgrade requested application behavior to a brochure. */
export function prepareGeneratedApplication(generated: AIWebsiteGeneration, pages: WebsitePage[], prompt: string): ApplicationDefinition | undefined {
  if (generated.projectKind !== undefined && !['website', 'application'].includes(generated.projectKind)) throw new Error('AI returned an invalid project kind.');
  if (generated.unsupportedFeatures !== undefined && (!Array.isArray(generated.unsupportedFeatures)
    || generated.unsupportedFeatures.length > 20 || generated.unsupportedFeatures.some(item => typeof item !== 'string' || !item.trim() || item.length > 300))) {
    throw new Error('AI returned invalid application requirements.');
  }
  if (generated.unsupportedFeatures?.length) throw new Error(`This request needs additional application features before it can be built: ${generated.unsupportedFeatures.join('; ')}. No incomplete application was applied.`);
  const requested = /\b(?:patient portal|staff portal|admin portal|sign[ -]?in|log[ -]?in|authentication|database|book(?:ing)? appointments?|appointment booking)\b|(?:حجز المواعيد|حجز موعد|تسجيل الدخول|قاعدة بيانات|بوابة المرضى|بوابة الموظفين)/iu.test(prompt);
  if (generated.application === undefined) {
    if (generated.projectKind === 'application' || requested || pages.some(page => page.sections.some(section => section.applicationFormBinding))) {
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
  let boundForms = 0;
  for (const page of pages) for (const section of page.sections) {
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
      boundForms++;
    }
  }
  if (/\b(?:book(?:ing)? appointments?|appointment booking)\b|(?:حجز المواعيد|حجز موعد)/iu.test(prompt) && !boundForms) throw new Error('Appointment booking requires a real bound form; descriptive pages cannot replace it.');
  return definition;
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
