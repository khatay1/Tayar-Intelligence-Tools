import type { AIWebsiteGeneration } from './editor-ai-patch-review';
import type { WebsitePage } from './website-builder-model';
import type { ApplicationDefinition, ApplicationRequirementCapability } from './application-model';
import { readApplicationDefinition } from './application-validation';
import { compileApplicationCreateForm } from './application-form-runtime';
import { compileApplicationDataView } from './application-data-view';
import { websiteProjectLinkIssues } from './website-project-links';

const bookingRequest = (prompt: string) => /\b(?:book(?:ing)? appointments?|appointments? booking|room booking|resource booking|reservations?|bokning|boka)\b|(?:حجز|حجوزات)/iu.test(prompt);

const requestedCapabilityPatterns: Array<[ApplicationRequirementCapability, RegExp]> = [
  ['auth', /\b(?:sign[ -]?in|log[ -]?in|authentication|accounts?|patient portal|staff portal|member portal)\b|(?:تسجيل الدخول|حسابات|بوابة المرضى|بوابة الموظفين)|(?:inloggning|konto|kundportal)/iu],
  ['records', /\b(?:data dashboard|record management|crud|data editor|customer portal|admin portal)\b|(?:إدارة السجلات|عرض السجلات|لوحة بيانات|بوابة العملاء|لوحة الإدارة)|(?:datapanel|posthantering|kundportal)/iu],
  ['booking', /\b(?:book(?:ing)? appointments?|appointments? booking|room booking|resource booking|reservations?|availability|waitlist|recurring appointments?|working hours)\b|(?:حجز|حجوزات|المواعيد المتكررة|قائمة الانتظار|ساعات العمل|التوافر)|(?:bokning|boka|väntelista|öppettider|tillgänglighet)/iu],
  ['counter', /\b(?:stock (?:adjustments?|management)|inventory management|quota management|points system)\b|(?:إدارة المخزون|تعديل المخزون|إدارة الحصص|نظام النقاط)|(?:lagerhantering|lagersaldo|poängsystem)/iu],
  ['transaction', /\b(?:multi[ -]?item orders?|order management|inventory reservations?|stock reservations?|material issuance|usage allocation)\b|(?:إدارة الطلبات|طلب متعدد العناصر|حجز المخزون|صرف المواد)|(?:orderhantering|materialuttag)/iu],
  ['workflow', /\b(?:approval workflow|status workflow|state transition|approve orders?|review queue)\b|(?:سير الموافقة|حالات الطلب|اعتماد الطلبات|طابور المراجعة)|(?:godkännandeflöde|statusflöde)/iu],
  ['formula', /\b(?:calculated fields?|computed totals?|line totals?|automatic calculation)\b|(?:حقول محسوبة|إجماليات محسوبة|حساب تلقائي)|(?:beräknade fält|automatisk beräkning)/iu],
  ['files', /\b(?:private attachments?|record files?|document uploads?|file uploads?)\b|(?:مرفقات خاصة|ملفات السجلات|رفع الملفات|رفع المستندات)|(?:privata bilagor|filuppladdning)/iu],
  ['payment', /\b(?:payments?|checkout|stripe|refunds?|paid orders?)\b|(?:الدفع|مدفوعات|استرداد|سترايب|الدفع الإلكتروني)|(?:betalning|kassa|återbetalning)/iu],
  ['email', /\b(?:transactional emails?|email notifications?|confirmation emails?|send an email)\b|(?:إشعارات البريد|رسائل تأكيد|بريد إلكتروني تلقائي)|(?:e-postavisering|bekräftelsemail)/iu],
  ['reports', /\b(?:reports?|analytics|grouped totals?|period comparison|business metrics)\b|(?:تقارير|تحليلات|إجماليات مجمعة|مقارنة الفترات|مؤشرات الأعمال)|(?:rapporter|analys|periodjämförelse)/iu],
];

export function requestedApplicationCapabilities(prompt: string): Set<ApplicationRequirementCapability> {
  return new Set(requestedCapabilityPatterns.filter(([, pattern]) => pattern.test(prompt)).map(([capability]) => capability));
}

/** Never silently downgrade requested application behavior to a brochure. */
export function prepareGeneratedApplication(
  generated: AIWebsiteGeneration,
  pages: WebsitePage[],
  prompt: string,
  availableEmailConnectionIds: ReadonlySet<string> = new Set(),
): ApplicationDefinition | undefined {
  if (generated.projectKind !== undefined && !['website', 'application'].includes(generated.projectKind)) throw new Error('AI returned an invalid project kind.');
  if (generated.unsupportedFeatures !== undefined && (!Array.isArray(generated.unsupportedFeatures)
    || generated.unsupportedFeatures.length > 20 || generated.unsupportedFeatures.some(item => typeof item !== 'string' || !item.trim() || item.length > 300))) {
    throw new Error('AI returned invalid application requirements.');
  }
  if (generated.unsupportedFeatures?.length) throw new Error(`This request needs additional application features before it can be built: ${generated.unsupportedFeatures.join('; ')}. No incomplete application was applied.`);
  const requestedCapabilities = requestedApplicationCapabilities(prompt);
  const counterRequested = requestedCapabilities.has('counter');
  const transactionRequested = requestedCapabilities.has('transaction');
  const requested = /\b(?:patient portal|staff portal|admin portal|sign[ -]?in|log[ -]?in|authentication|database|book(?:ing)? appointments?|appointment booking|data dashboard|record management|crud|data editor)\b|(?:حجز المواعيد|حجز موعد|تسجيل الدخول|قاعدة بيانات|بوابة المرضى|بوابة الموظفين|إدارة السجلات|عرض السجلات|لوحة بيانات)/iu.test(prompt);
  if (generated.application === undefined) {
    if (generated.projectKind === 'application' || requested || requestedCapabilities.size || pages.some(page => page.sections.some(section => section.applicationFormBinding || section.applicationDataView))) {
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
      evidence.add(`view:${view.table.id}:read`);
      for (const action of view.binding.actions) evidence.add(`view:${view.table.id}:${action}`);
      if (view.table.booking && view.binding.actions.includes('create')) evidence.add(`booking:${view.table.id}`);
      if (view.table.counter && view.binding.actions.includes('adjust')) evidence.add(`counter:${view.table.id}`);
      if (view.table.transaction && view.binding.actions.includes('transact')) evidence.add(`transaction:${view.table.id}`);
      if (view.table.attachments && view.binding.actions.includes('attachments')) evidence.add(`files:${view.table.id}`);
      if (view.table.workflow && view.binding.actions.includes('transition')) evidence.add(`workflow:${view.table.id}`);
      if (view.table.fields.some(field => field.formula && view.binding.columns.includes(field.id))) evidence.add(`formula:${view.table.id}`);
      if (view.table.payment && view.binding.actions.some(action => action === 'pay' || action === 'refund')) evidence.add(`payment:${view.table.id}`);
      if (view.table.reports?.length) evidence.add(`reports:${view.table.id}`);
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
  for (const table of definition.tables) if (table.notifications?.length) {
    if (table.notifications.some(rule => !availableEmailConnectionIds.has(rule.connectionId))) {
      throw new Error('Email notifications must reference a real saved email connection. Configure the connection first; no incomplete application was applied.');
    }
    evidence.add(`email:${table.id}`);
  }
  if (bookingRequest(prompt) && !bookingCreates) throw new Error('Appointment booking requires a bound create form or data view with a database booking rule; ordinary records cannot replace conflict-safe booking.');
  if (/\b(?:data dashboard|record management|crud|data editor)\b|(?:إدارة السجلات|عرض السجلات|لوحة بيانات)/iu.test(prompt) && !dataViews) throw new Error('Record management requires a bound data view; descriptive pages cannot replace it.');
  if (counterRequested && !counterViews) throw new Error('Quantity management requires a bound adjustment view and a native counter rule.');
  if (transactionRequested && !transactionViews) throw new Error('Multi-item transactions require a bound transaction view and native parent, line and counter rules.');
  const bookings = definition.tables.filter(table => table.booking).map(table => table.booking!);
  if (/\b(?:recurring appointments?|repeat bookings?)\b|(?:المواعيد المتكررة|تكرار الحجز)|(?:återkommande bokningar)/iu.test(prompt)
    && !bookings.some(rule => rule.recurrence)) throw new Error('Recurring bookings require a native recurrence rule. No incomplete application was applied.');
  if (/\bwaitlist\b|(?:قائمة الانتظار)|(?:väntelista)/iu.test(prompt)
    && !bookings.some(rule => rule.waitlistStatus)) throw new Error('A waiting list requires a declared nonblocking booking status. No incomplete application was applied.');
  if (/\b(?:working hours|special hours|date closures?)\b|(?:ساعات العمل|أوقات خاصة|إغلاق التواريخ)|(?:öppettider|specialtider)/iu.test(prompt)
    && !bookings.some(rule => rule.schedule)) throw new Error('Booking hours require a native schedule rule. No incomplete application was applied.');
  if (/\b(?:multiple resources|doctor and room|staff and room)\b|(?:موارد متعددة|الطبيب والغرفة|الموظف والغرفة)|(?:flera resurser|läkare och rum)/iu.test(prompt)
    && !bookings.some(rule => rule.additionalResourceFieldIds?.length)) throw new Error('Multiple booking resources require distinct referenced resource fields. No incomplete application was applied.');
  if (/\brefunds?\b|(?:استرداد)|(?:återbetalning)/iu.test(prompt)
    && ![...evidence].some(entry => /^view:[^:]+:refund$/.test(entry))) throw new Error('Refunds require an authorized native refund action. No incomplete application was applied.');
  const reports = definition.tables.flatMap(table => table.reports ?? []);
  if (/\b(?:grouped(?: \w+){0,3} reports?|group(?:ed)? totals?|group by)\b|(?:تقارير مجمعة|إجماليات مجمعة|تجميع حسب)|(?:grupperade rapporter|grupperade totaler)/iu.test(prompt)
    && !reports.some(report => report.groupByFieldId)) throw new Error('Grouped reports require a declared grouping field. No incomplete application was applied.');
  if (/\b(?:monthly|weekly|daily|yearly|period) reports?\b|(?:تقارير شهرية|أسبوعية|يومية|سنوية|دورية)|(?:månadsrapporter|veckorapporter|dagsrapporter|årsrapporter)/iu.test(prompt)
    && !reports.some(report => report.period)) throw new Error('Period reports require a declared date period and time zone. No incomplete application was applied.');
  if (/\b(?:period comparison|compare periods?|previous period)\b|(?:مقارنة الفترات|الفترة السابقة)|(?:periodjämförelse|föregående period)/iu.test(prompt)
    && !reports.some(report => report.period?.comparePrevious)) throw new Error('Period comparison requires an explicit previous-period comparison. No incomplete application was applied.');
  const requirementIds = new Set<string>();
  const allowedCapabilities = new Set<ApplicationRequirementCapability>(['page', 'auth', 'form', 'records', 'booking', 'counter', 'transaction', 'workflow', 'formula', 'files', 'payment', 'email', 'reports']);
  const capabilityEvidence: Record<ApplicationRequirementCapability, string> = { page: 'page:', auth: 'auth', form: 'form:', records: 'view:', booking: 'booking:', counter: 'counter:', transaction: 'transaction:', workflow: 'workflow:', formula: 'formula:', files: 'files:', payment: 'payment:', email: 'email:', reports: 'reports:' };
  const items = generated.requirements.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || Object.keys(item).some(key => !['id', 'summary', 'capability', 'evidence'].includes(key))
      || typeof item.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(item.id) || requirementIds.has(item.id)
      || typeof item.summary !== 'string' || !item.summary.trim() || item.summary.length > 300
      || !allowedCapabilities.has(item.capability)
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
  const coveredCapabilities = new Set(items.map(item => item.capability));
  for (const capability of requestedCapabilities) if (!coveredCapabilities.has(capability)) {
    throw new Error(`The requested ${capability} capability has no verified requirement. No incomplete application was applied.`);
  }
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
