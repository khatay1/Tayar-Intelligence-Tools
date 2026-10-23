import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const dir = await mkdtemp(join(tmpdir(), 'tayar-generated-application-'));
try {
  const out = join(dir, 'generation.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/editor-ai-generation-handler.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile: out, alias: { '@': resolve('src') }, define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'fixture-ai', setup(b) {
      b.onResolve({ filter: /^@\/lib\/ai\/service$/ }, () => ({ path: 'ai', namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const createAIService=()=>({completeJSON:async(request)=>{globalThis.__generationRequest=request;return globalThis.__generationResponse}});' }));
    } }] });
  const { createAIGenerationHandler } = require(out);
  const deliveryOut = join(dir, 'delivery.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/editor-delivery-actions.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile: deliveryOut, alias: { '@': resolve('src') } });
  const { createDeliveryActions } = require(deliveryOut);
  const table = { id: 'appointments', key: 'appointments', name: 'Appointments',
    fields: [{ id: 'visit_date', key: 'visit_date', name: 'Date', type: 'date', required: true }],
    permissions: [{ operation: 'read', access: 'owner' }, { operation: 'create', access: 'owner' }] };
  const application = { version: 1, roles: [], tables: [table], auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true },
    pageAccess: [{ pageId: 'booking', access: 'authenticated' }] };
  const response = { projectKind: 'application', application, requirements: [
    { id: 'account-access', summary: 'Users can sign in to their portal.', capability: 'auth', evidence: ['auth'] },
    { id: 'booking-page', summary: 'Users can open the booking page.', capability: 'page', evidence: ['page:booking'] },
    { id: 'saved-request', summary: 'Users can submit a saved request.', capability: 'form', evidence: ['form:appointments'] },
  ], siteName: 'Dental clinic', pages: [
    { name: 'Home', slug: 'home', sections: [{ type: 'hero', buttonText: 'Book', buttonUrl: '/booking' }] },
    { name: 'Booking', slug: 'booking', sections: [{ type: 'contact', anchorId: 'booking-form', buttonText: 'Request appointment',
      formFields: [{ id: 'date_input', name: 'visit_date', label: 'Date', type: 'date', required: true }],
      applicationFormBinding: { operation: 'create', tableId: 'appointments', fields: [{ formFieldId: 'date_input', tableFieldId: 'visit_date' }] } }] },
  ] };
  async function run(json, maxPages = 6, prompt = 'Build saved records with a patient portal', agentMode = false) {
    globalThis.__generationResponse = { json };
    globalThis.__generationRequest = undefined;
    globalThis.window = { confirm: () => true };
    const state = {}, checkpoints = [];
    const setter = key => value => { state[key] = typeof value === 'function' ? value(state[key] ?? []) : value; };
    const args = {
      activeUserIdRef: { current: 'owner' }, aiAbortControllerRef: { current: null }, aiQualityAbortControllerRef: { current: null },
      aiOperationSequenceRef: { current: 0 }, aiUndoContextRef: { current: null }, aiQualityReviewContextRef: { current: null },
      aiBusy: false, aiQualityBusy: false, aiPrompt: prompt, user: { id: 'owner' },
      aiEditorContextIsCurrent: () => true, captureAIEditorContext: () => ({}), beginAIRequest: () => new AbortController(), finishAIRequest: () => {},
      billingEntitlements: { maxPages }, theme: {}, headerConfig: {}, brand: {}, seo: {}, l: text => text,
      buildProjectSnapshot: () => ({ application: { old: true } }), pushProjectCheckpoint: (...data) => checkpoints.push(data), requestGeneratedImage: async () => { throw new Error(); },
    };
    for (const key of ['Application','ActivePageId','AiBusy','AiCandidatePreview','AiError','AiIntent','AiMessages','AiPatchReview','AiPlan','AiPrompt','AiQualityReview','AiStage','AiUndoSnapshot','Brand','HeaderConfig','HomePageId','Pages','Saved','Sections','SelectedElementId','SelectedId','Seo','SiteName','Theme']) args[`set${key}`] = setter(key);
    await createAIGenerationHandler(args)(agentMode);
    return { state, checkpoints, request: globalThis.__generationRequest };
  }
  const built = await run(response);
  assert.ok(built.request.integrationCapabilities.capabilities.some(item => item.id === 'booking' && item.adapter === 'internal'));
  assert.ok(built.request.integrationCapabilities.policy.includes('deferred plans only'));
  assert.ok(built.request.integrationCapabilities.capabilities.filter(item => item.providerId !== 'tayar').every(item => ['isolated-existing-adapter', 'metadata-only'].includes(item.testStatus)));
  assert.equal(built.state.AiStage, 'ready');
  assert.equal(built.state.Application.tables[0].key, 'appointments');
  assert.equal(built.state.Application.pageAccess[0].pageId, built.state.Pages[1].id);
  assert.equal(built.state.Application.requirements.request, 'Build saved records with a patient portal');
  assert.equal(built.state.Application.requirements.items[1].evidence[0], `page:${built.state.Pages[1].id}`);
  assert.equal(built.state.Pages[0].sections[0].buttonUrl, 'page:booking');
  assert.equal(built.state.Pages[0].sections[0].elements.find(e => e.type === 'button').href, 'page:booking');
  assert.equal(built.state.Pages[1].sections[0].formFields[0].name, 'visit_date');
  assert.deepEqual(built.checkpoints.at(-1)[1].application, built.state.Application);
  assert.match(built.state.AiMessages.at(-1).content, /No backend has been provisioned/);
  const projectSpecification = {
    version: 1, intent: 'Let patients authenticate and submit appointment requests.',
    actors: [{ id: 'patient', name: 'Patient' }],
    entities: [{ id: 'appointments', scope: 'owner', classification: 'restricted' }],
    requirements: [
      { id: 'account-access', origin: 'inferred', acceptanceCriteria: ['A patient can authenticate before accessing the portal.'] },
      { id: 'booking-page', origin: 'explicit', acceptanceCriteria: ['An authenticated patient can open the booking page.'] },
      { id: 'saved-request', origin: 'explicit', acceptanceCriteria: ['A valid appointment request is saved for its owner.'] },
    ],
    operations: [
      { id: 'sign-in', summary: 'Authenticate a patient.', actorIds: ['patient'], entityIds: [], requirementIds: ['account-access'], dependsOn: [], execution: 'native', transactional: false },
      { id: 'open-booking', summary: 'Open the protected booking page.', actorIds: ['patient'], entityIds: [], requirementIds: ['booking-page'], dependsOn: ['sign-in'], execution: 'native', transactional: false },
      { id: 'create-request', summary: 'Create an owner-scoped appointment request.', actorIds: ['patient'], entityIds: ['appointments'], requirementIds: ['saved-request'], dependsOn: ['sign-in'], execution: 'native', transactional: true },
    ],
    rules: [{ id: 'appointment-owner', summary: 'Patients can submit and read only their own requests.', operationIds: ['create-request'] }],
    tenancy: { mode: 'single' }, integrations: [],
    privacy: [{ entityId: 'appointments', purpose: 'Fulfil the patient appointment request.', retentionDays: 365 }], decisions: [],
  };
  const missingAgentSpec = await run(response, 6, 'Build saved records with a patient portal', true);
  assert.equal(missingAgentSpec.state.AiStage, 'error');
  assert.equal(missingAgentSpec.state.Application, undefined);
  assert.equal(missingAgentSpec.checkpoints.length, 0);
  const agentBuild = await run({ ...response, projectSpecification }, 6, 'Build saved records with a patient portal', true);
  assert.equal(agentBuild.state.AiStage, 'ready');
  assert.deepEqual(agentBuild.state.Application.requirements.specification, projectSpecification);
  assert.match(agentBuild.request.prompt, /customOperationInputJson/,
    'agent generation must bind custom operations through the declarative page action contract');
  assert.match(agentBuild.request.prompt, /customOperationBindFormValues=true/,
    'agent generation must make form-value binding an explicit choice');
  assert.match(agentBuild.request.prompt, /action="custom-operation"/);
  const customDraftSpecification = { ...projectSpecification, operations: projectSpecification.operations.map((operation, index) => index
    ? operation : { ...operation, execution: 'custom', transactional: false, source: 'return { accepted: true };' }) };
  const customActionResponse = structuredClone(response);
  customActionResponse.pages[0].sections[0].elements = [{ type: 'button', action: 'custom-operation', customOperationId: 'sign-in',
    customOperationInputJson: '{"email":"person@example.test"}', content: 'Run action' }];
  const customDraftBuild = await run({ ...customActionResponse, projectSpecification: customDraftSpecification }, 6, 'Build saved records with a patient portal', true);
  assert.ok(customDraftBuild.state.Pages[0].sections[0].elements.some(element => element.action === 'custom-operation'
    && element.customOperationId === 'sign-in' && element.customOperationInputJson === '{"email":"person@example.test"}'));
  const boundActionResponse = structuredClone(customActionResponse);
  boundActionResponse.pages[1].sections[0].elements = [{ type: 'button', action: 'custom-operation', customOperationId: 'sign-in',
    customOperationInputJson: '{}', customOperationBindFormValues: true, content: 'Run with form values' }];
  const boundActionBuild = await run({ ...boundActionResponse, projectSpecification: customDraftSpecification }, 6,
    'Build saved records with a patient portal', true);
  assert.equal(boundActionBuild.state.AiStage, 'ready');
  assert.equal(boundActionBuild.state.Pages[1].sections[0].elements.find(element => element.customOperationId === 'sign-in').customOperationBindFormValues, true);
  const invalidBoundAction = structuredClone(boundActionResponse);
  invalidBoundAction.pages[0].sections[0].elements[0] = { ...invalidBoundAction.pages[1].sections[0].elements[0] };
  const invalidBoundActionBuild = await run({ ...invalidBoundAction, projectSpecification: customDraftSpecification }, 6,
    'Build saved records with a patient portal', true);
  assert.equal(invalidBoundActionBuild.state.AiStage, 'error', 'form values must bind only to their own bound application form section');
  const invalidCustomAction = structuredClone(customActionResponse);
  invalidCustomAction.pages[0].sections[0].elements[0].customOperationInputJson = '[]';
  const invalidCustomActionBuild = await run({ ...invalidCustomAction, projectSpecification: customDraftSpecification }, 6,
    'Build saved records with a patient portal', true);
  assert.equal(invalidCustomActionBuild.state.AiStage, 'error');
  assert.equal(invalidCustomActionBuild.state.Pages, undefined, 'invalid custom action must reject the entire generated project');
  assert.equal(customDraftBuild.state.AiStage, 'ready');
  assert.deepEqual(customDraftBuild.state.Application.requirements.specification, customDraftSpecification);
  const invalidAgentSpec = await run({ ...response, projectSpecification: { ...projectSpecification,
    operations: projectSpecification.operations.map((operation, index) => index ? operation : { ...operation, execution: 'custom' }) } }, 6, 'Build saved records with a patient portal', true);
  assert.equal(invalidAgentSpec.state.AiStage, 'error');
  assert.equal(invalidAgentSpec.state.Application, undefined);
  assert.equal(invalidAgentSpec.state.Pages, undefined);
  assert.equal(invalidAgentSpec.checkpoints.length, 0);
  const deliveryConfig = { clientName: '', clientEmail: '', projectCode: '', status: 'review', dueDate: '', handoffNotes: '', whiteLabel: true, approvedAt: null, approvedFingerprint: '', deliveredAt: null };
  let deliveryMutations = 0, alerts = 0;
  globalThis.window.alert = () => { alerts++; };
  const deliveryArgs = { pages: built.state.Pages, deliveryConfig, approvalCurrent: false, siteName: 'App', getLaunchReadiness: () => ({ score: 0, checks: [], auditPoints: 0 }), siteAudit: { score: 0, errors: [], warnings: [] }, publishedUrl: 'https://example.test', previewUrl: '', deliveryUsage: { pages: built.state.Pages.length, sections: 0, elements: 0, forms: 0, releases: 0, leads: 0, analyticsEvents: 0 }, setDeliveryConfig: updater => { deliveryMutations++; updater(deliveryConfig); }, setSaved: () => {}, buildDeliveryFingerprint: () => 'verified', requireBillingFeature: () => true, l: text => text };
  createDeliveryActions({ ...deliveryArgs, application }).approveForDelivery();
  assert.equal(deliveryMutations, 0, 'applications without a verified requirement manifest cannot be approved');
  createDeliveryActions({ ...deliveryArgs, application: built.state.Application }).approveForDelivery();
  assert.equal(deliveryMutations, 0, 'legacy compile evidence without structured criteria cannot allow approval');
  const verifiedApplication = structuredClone(built.state.Application);
  verifiedApplication.requirements.items = verifiedApplication.requirements.items.filter(item => item.id === 'booking-page');
  verifiedApplication.requirements.specification = {
    ...structuredClone(projectSpecification),
    requirements: [{ id: 'booking-page', origin: 'explicit', acceptanceCriteria: ['The declared page policy permits a signed-in user.'] }],
    operations: [{ ...projectSpecification.operations[1], dependsOn: [] }],
    rules: [],
    acceptanceTests: [{ id: 'signed-in-page', requirementId: 'booking-page', criterionIndex: 0, kind: 'page-access',
      pageId: built.state.Pages[1].id, principal: { authenticated: true, roleIds: [] }, expected: { accessible: true } }],
  };
  createDeliveryActions({ ...deliveryArgs, application: verifiedApplication }).approveForDelivery();
  assert.equal(deliveryMutations, 1, 'verified application requirements allow approval');
  assert.match(createDeliveryActions({ ...deliveryArgs, application: verifiedApplication }).buildDeliveryReport(), /REQUIREMENT COVERAGE MATRIX[\s\S]*Requirement: booking-page[\s\S]*Delivery status: contract-verified/);
  const deliveryReport = createDeliveryActions({ ...deliveryArgs, application: verifiedApplication }).buildDeliveryReport();
  assert.match(deliveryReport, /DELIVERY EVIDENCE[\s\S]*Project definition: Present \(\d+ pages\)[\s\S]*Requirement contracts: \d+\/\d+ passed; 0 blocked requirements[\s\S]*Build artifact: Not verified by this report[\s\S]*Published URL recorded; deployment health not verified[\s\S]*Live runtime and external services: Not verified by this report/);
  const unverifiedReport = createDeliveryActions({ ...deliveryArgs, publishedUrl: '', application: verifiedApplication }).buildDeliveryReport();
  assert.match(unverifiedReport, /Deployment: Not published/);
  assert.match(unverifiedReport, /Build artifact: Not verified by this report/);
  createDeliveryActions({ ...deliveryArgs, pages: built.state.Pages.filter(page => page.slug !== 'booking'), application: verifiedApplication }).approveForDelivery();
  assert.equal(deliveryMutations, 1, 'stale requirement evidence cannot approve a changed application');
  createDeliveryActions({ ...deliveryArgs, application: verifiedApplication }).markProjectDelivered();
  assert.equal(deliveryMutations, 1, 'unapproved current builds cannot be marked delivered');
  createDeliveryActions({ ...deliveryArgs, approvalCurrent: true, application: verifiedApplication }).markProjectDelivered();
  assert.equal(deliveryMutations, 1, 'local policy/contract tests and a URL cannot prove application runtime delivery');
  createDeliveryActions({ ...deliveryArgs, approvalCurrent: true, application: verifiedApplication,
    getLaunchReadiness: () => ({ score: 100, checks: [{ label: 'Published website', ok: true }, { label: 'Live verification', ok: true }], auditPoints: 40 }),
  }).markProjectDelivered();
  assert.equal(deliveryMutations, 1, 'generic launch checklist flags cannot substitute for release-bound runtime and service evidence');
  createDeliveryActions({ ...deliveryArgs, approvalCurrent: true, publishedUrl: '', application: verifiedApplication }).markProjectDelivered();
  assert.equal(deliveryMutations, 1, 'an unpublished application cannot be marked delivered');
  assert.equal(alerts, 7);
  createDeliveryActions({ ...deliveryArgs, approvalCurrent: true, application: undefined }).markProjectDelivered();
  assert.equal(deliveryMutations, 2, 'brochure delivery retains its existing path');
  const dataView = { tableId: 'appointments', columns: ['visit_date'], actions: ['update', 'delete'], pageSize: 10 };
  const dashboardResponse = { ...response, requirements: [{ id: 'record-editor', summary: 'Users can update saved records.', capability: 'records', evidence: ['view:appointments:update'] }], application: { ...application, tables: [{ ...table, permissions: [...table.permissions, { operation: 'update', access: 'owner' }, { operation: 'delete', access: 'owner' }] }] },
    pages: [...response.pages, { name: 'Records', slug: 'records', sections: [{ type: 'features', title: 'My records', applicationDataView: dataView }] }] };
  const dashboard = await run(dashboardResponse, 6, 'Build record management');
  assert.equal(dashboard.state.AiStage, 'ready');
  assert.deepEqual(dashboard.state.Pages[2].sections[0].applicationDataView, dataView);
  assert.deepEqual(dashboard.checkpoints.at(-1)[1].pages[2].sections[0].applicationDataView, dataView);
  const controlTable = { ...table, fields: [...table.fields,
    { id: 'record_name', key: 'name', name: 'Name', type: 'text', required: false },
    { id: 'record_state', key: 'state', name: 'State', type: 'enum', required: false, options: ['open', 'closed'] }] };
  const controlResponse = { ...dashboardResponse,
    application: { ...dashboardResponse.application, tables: [controlTable] },
    requirements: [
      { id: 'record-search', summary: 'Users can search records.', capability: 'records', evidence: ['view:appointments:search'] },
      { id: 'record-filter', summary: 'Users can filter records.', capability: 'records', evidence: ['view:appointments:filter'] },
    ],
    pages: [...response.pages, { name: 'Records', slug: 'records', sections: [{ type: 'features', title: 'My records',
      applicationDataView: { tableId: 'appointments', columns: ['visit_date', 'record_name', 'record_state'], actions: [], pageSize: 10,
        searchFieldId: 'record_name', filterFieldId: 'record_state' } }] }],
  };
  let controlledApplication, controlledPages;
  for (const prompt of [
    'Build a record management app with search and filtering',
    'بدي تطبيق لإدارة السجلات مع البحث والتصفية',
    'Bygg en app för posthantering med sökning och filtrering',
  ]) {
    const controlled = await run(controlResponse, 6, prompt);
    assert.equal(controlled.state.AiStage, 'ready', `${prompt}: ${controlled.state.AiError ?? ''}`);
    assert.equal(controlled.state.Pages[2].sections[0].applicationDataView.searchFieldId, 'record_name');
    assert.equal(controlled.state.Pages[2].sections[0].applicationDataView.filterFieldId, 'record_state');
    controlledApplication = controlled.state.Application;
    controlledPages = controlled.state.Pages;
  }
  for (const [prompt, missing] of [
    ['Build a record management app with search', 'searchFieldId'],
    ['بدي تطبيق لإدارة السجلات مع التصفية', 'filterFieldId'],
    ['Bygg en app för posthantering med sökning', 'searchFieldId'],
  ]) {
    const incompleteControl = structuredClone(controlResponse);
    delete incompleteControl.pages[2].sections[0].applicationDataView[missing];
    incompleteControl.requirements = incompleteControl.requirements.filter(item => !item.evidence[0].endsWith(missing === 'searchFieldId' ? ':search' : ':filter'));
    const rejected = await run(incompleteControl, 6, prompt);
    assert.equal(rejected.state.AiStage, 'error', `Missing ${missing} must reject: ${prompt}`);
    assert.equal(rejected.state.Pages, undefined);
    assert.equal(rejected.checkpoints.length, 0);
  }
  const seoOnly = await run(dashboardResponse, 6, 'Build a record management app with search engine optimization copy');
  assert.equal(seoOnly.state.AiStage, 'ready', 'SEO copy must not require a record search control');
  const recordTest = { id: 'valid-record', requirementId: 'record-editor', criterionIndex: 0, kind: 'record-values',
    pageId: 'records', sectionId: 'record-editor', operation: 'update', input: [{ name: 'visit_date', value: '2026-10-19' }],
    expected: { outcome: 'accepted', values: { visit_date: '2026-10-19' } } };
  const recordResponse = structuredClone(dashboardResponse);
  recordResponse.pages[2].sections[0].anchorId = 'record-editor';
  recordResponse.projectSpecification = { ...projectSpecification,
    requirements: [{ id: 'record-editor', origin: 'explicit', acceptanceCriteria: ['A synthetic record date converts for update.'] }],
    operations: [{ ...projectSpecification.operations[2], requirementIds: ['record-editor'], dependsOn: [] }],
    rules: [], acceptanceTests: [recordTest] };
  const recordBuild = await run(recordResponse, 6, 'Build record management', true);
  assert.equal(recordBuild.state.AiStage, 'ready');
  assert.match(recordBuild.request.prompt, /kind="record-values"/);
  assert.deepEqual(recordBuild.state.Application.requirements.specification.acceptanceTests, [{ ...recordTest,
    pageId: recordBuild.state.Pages[2].id, sectionId: recordBuild.state.Pages[2].sections[0].id }]);
  assert.equal(recordResponse.projectSpecification.acceptanceTests[0].pageId, 'records', 'Normalization must not mutate the AI response');
  const coverageOut = join(dir, 'coverage.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/application-requirements.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: coverageOut });
  const { buildApplicationRequirementCoverage } = require(coverageOut);
  assert.equal(buildApplicationRequirementCoverage(recordBuild.state.Application, recordBuild.state.Pages)[0].deliveryStatus, 'contract-verified');
  assert.ok(buildApplicationRequirementCoverage(controlledApplication, controlledPages)
    .every(row => row.tests.filter(test => test.kind === 'contract').every(test => test.result === 'passed')),
  'search/filter contract evidence must be recomputed from bound controls');
  for (const override of [{ operation: 'delete' }, { pageId: 'missing' }, { sectionId: 'missing' }, { operation: 'create' }]) {
    const invalidRecord = structuredClone(recordResponse);
    Object.assign(invalidRecord.projectSpecification.acceptanceTests[0], override);
    const rejected = await run(invalidRecord, 6, 'Build record management', true);
    assert.equal(rejected.state.AiStage, 'error');
    assert.equal(rejected.state.Pages, undefined, 'Invalid record fixtures must reject generation atomically');
    assert.equal(rejected.checkpoints.length, 0);
  }
  const formResponse = { ...response, projectSpecification: { ...projectSpecification, acceptanceTests: [{
    id: 'form-date', requirementId: 'saved-request', criterionIndex: 0, kind: 'form-values', pageId: 'booking', sectionId: 'booking-form',
    input: [{ name: 'visit_date', value: '2026-10-19' }], expected: { outcome: 'accepted', values: { visit_date: '2026-10-19' } },
  }, { id: 'protected-page', requirementId: 'booking-page', criterionIndex: 0, kind: 'page-access', pageId: 'booking',
    principal: { authenticated: true, roleIds: [] }, expected: { accessible: true } }] } };
  const formBuild = await run(formResponse, 6, 'Build saved records with a patient portal', true);
  assert.equal(formBuild.state.AiStage, 'ready');
  assert.ok(buildApplicationRequirementCoverage(formBuild.state.Application, formBuild.state.Pages).slice(1).every(row => row.deliveryStatus === 'contract-verified'));
  const ambiguous = structuredClone(recordResponse);
  ambiguous.pages[2].sections.push({ ...ambiguous.pages[2].sections[0] });
  const rejectedAmbiguous = await run(ambiguous, 6, 'Build record management', true);
  assert.equal(rejectedAmbiguous.state.AiStage, 'error');
  assert.equal(rejectedAmbiguous.checkpoints.length, 0);
  // Explicit real-estate CRUD must exist on the property table itself.
  // Valid authentication or a read-only property view is NOT enough.
  const propertyTable = { id: 'properties', key: 'properties', name: 'Properties',
    fields: [{ id: 'property_title', key: 'title', name: 'Title', type: 'text', required: true }],
    permissions: ['read', 'create', 'update', 'delete'].map(operation => ({ operation, access: 'owner' })) };
  const propertyPrompt = 'Build a real estate app where agents can add, edit and delete property listings';
  const arPropertyPrompt = 'بدي تطبيق عقارات لإضافة العقارات وتعديلها وحذفها';
  const propertyView = { tableId: 'properties', columns: ['property_title'],
    actions: ['create', 'update', 'delete'], pageSize: 10 };
  const propertyGenerated = {
    projectKind: 'application',
    application: { ...application, pageAccess: [], tables: [propertyTable] },
    requirements: [{ id: 'property-records', summary: 'Manage property listings.', capability: 'records',
      evidence: ['view:properties:read'] }],
    pages: [{ name: 'Properties', slug: 'properties', sections: [{
      type: 'features', title: 'Property records', applicationDataView: propertyView }] }],
  };
  for (const prompt of [propertyPrompt, arPropertyPrompt]) {
    const complete = await run(propertyGenerated, 6, prompt);
    assert.equal(complete.state.AiStage, 'ready', 'Complete property CRUD should build: ' + prompt);
    assert.equal(complete.state.Application.tables[0].id, 'properties');
  }
  for (const missing of ['create', 'update', 'delete']) {
    const partial = structuredClone(propertyGenerated);
    partial.pages[0].sections[0].applicationDataView.actions = propertyView.actions.filter(x => x !== missing);
    const incomplete = await run(partial, 6, propertyPrompt);
    assert.equal(incomplete.state.AiStage, 'error', 'Missing '+missing+' property operation must fail');
    assert.equal(incomplete.state.Pages, undefined);
    assert.equal(incomplete.checkpoints.length, 0);
  }
  const wrongTable = structuredClone(propertyGenerated);
  wrongTable.application.tables.push({ ...propertyTable, id: 'orders', key: 'orders', name: 'Orders' });
  wrongTable.pages[0].sections[0].applicationDataView = { ...propertyView, actions: [],
    columns: ['property_title'] };
  wrongTable.pages.push({ name: 'Orders', slug: 'orders', sections: [{
    type: 'features', applicationDataView: { ...propertyView, tableId: 'orders' } }] });
  const unrelated = await run(wrongTable, 6, propertyPrompt);
  assert.equal(unrelated.state.AiStage, 'error', 'CRUD on unrelated records cannot substitute property CRUD');
  const readOnlyProperties = structuredClone(propertyGenerated);
  readOnlyProperties.pages[0].sections[0].applicationDataView.actions = [];
  const readOnlyPortal = await run(readOnlyProperties, 6, 'Build a real estate portal to view property listings');
  assert.equal(readOnlyPortal.state.AiStage, 'ready', 'Read-only property portal must remain supported');
  for (const prompt of [
    'Create a real estate app to display property listings',
    'Build a property management app with users, roles and reporting',
    'Create a real estate site where visitors upload property photos',
  ]) {
    const display = await run(readOnlyProperties, 6, prompt);
    assert.equal(display.state.AiStage, 'ready', 'Creating an app is not requesting property-record creation: '+prompt);
    assert.equal(display.state.Application.tables[0].id, 'properties');
  }
  const searchableProperties = structuredClone(readOnlyProperties);
  searchableProperties.pages[0].sections[0].applicationDataView.searchFieldId = 'property_title';
  searchableProperties.requirements[0].evidence = ['view:properties:search'];
  const propertySearch = await run(searchableProperties, 6, 'Create a property management app with listings and a search page');
  assert.equal(propertySearch.state.AiStage, 'ready');
  assert.equal(propertySearch.state.Pages[0].sections[0].applicationDataView.searchFieldId, 'property_title');


  const readOnlyResponse = { ...response,
    requirements: [{ id: 'record-reader', summary: 'Users can read their saved records.', capability: 'records', evidence: ['view:appointments:read'] }],
    application: { ...application, pageAccess: [], tables: [{ ...table, permissions: [{ operation: 'read', access: 'owner' }] }] },
    pages: [{ name: 'Records', slug: 'records', sections: [{ type: 'features', title: 'My records', applicationDataView: { ...dataView, actions: [] } }] }],
  };
  for (const prompt of ['Build a data dashboard', 'بدي لوحة بيانات', 'Bygg datapanel']) {
    const reader = await run(readOnlyResponse, 6, prompt);
    assert.equal(reader.state.AiStage, 'ready', prompt);
    assert.deepEqual(reader.state.Pages[0].sections[0].applicationDataView.actions, []);
    assert.deepEqual(reader.state.Application.requirements.items[0].evidence, ['view:appointments:read']);
    let approvals = 0;
    const readerArgs = { ...deliveryArgs, application: reader.state.Application, pages: reader.state.Pages,
      setDeliveryConfig: updater => { approvals++; updater(deliveryConfig); } };
    globalThis.window.alert = () => {};
    createDeliveryActions(readerArgs).approveForDelivery();
    assert.equal(approvals, 0, 'a compiled read-only dashboard still needs criterion-specific tests before approval');
    assert.match(createDeliveryActions(readerArgs).buildDeliveryReport(), /contract:view:appointments:read=passed/);
    createDeliveryActions({ ...readerArgs, pages: reader.state.Pages.map(page => ({ ...page, sections: [] })) }).approveForDelivery();
    assert.equal(approvals, 0, 'removing the read-only binding cannot allow approval');
    assert.match(createDeliveryActions({ ...readerArgs, pages: reader.state.Pages.map(page => ({ ...page, sections: [] })) })
      .buildDeliveryReport(), /contract:view:appointments:read=failed/);
  }
  for (const invalid of [
    { ...dashboardResponse, application: undefined },
    { ...dashboardResponse, pages: [...response.pages, { ...dashboardResponse.pages[2], sections: [{ type: 'features', applicationDataView: { ...dataView, credentials: 'forbidden' } }] }] },
    { ...dashboardResponse, pages: [...response.pages, { ...dashboardResponse.pages[2], sections: [{ type: 'features', applicationDataView: { ...dataView, columns: ['missing'] } }] }] },
  ]) {
    const failed = await run(invalid, 6, 'Build record management');
    assert.equal(failed.state.AiStage, 'error'); assert.equal(failed.state.Pages, undefined); assert.equal(failed.checkpoints.length, 0);
  }
  const bookingFields = [
    { id: 'booking_resource', key: 'resource_id', name: 'Resource', type: 'uuid', required: true },
    { id: 'booking_start', key: 'starts_at', name: 'Start', type: 'datetime', required: true },
    { id: 'booking_end', key: 'ends_at', name: 'End', type: 'datetime', required: true },
  ];
  const bookingRule = { resourceFieldId: 'booking_resource', startFieldId: 'booking_start', endFieldId: 'booking_end' };
  const bookingResponse = { projectKind: 'application', requirements: [{ id: 'safe-booking', summary: 'Users can create a conflict-safe booking.', capability: 'booking', evidence: ['booking:appointments'] }], application: { ...application,
    tables: [{ ...table, fields: bookingFields, booking: bookingRule }] }, pages: [{ name: 'Booking', slug: 'booking', sections: [{ type: 'features',
      applicationDataView: { tableId: 'appointments', columns: bookingFields.map(field => field.id), actions: ['create'], pageSize: 10 } }] }] };
  const realBooking = await run(bookingResponse, 6, 'بدي حجز المواعيد');
  assert.equal(realBooking.state.AiStage, 'ready'); assert.deepEqual(realBooking.state.Application.tables[0].booking, bookingRule);
  const scheduleTest = { id: 'within-hours', requirementId: 'safe-booking', criterionIndex: 0, kind: 'booking-schedule', tableId: 'appointments',
    startsAt: '2026-10-19T10:00:00.000Z', endsAt: '2026-10-19T10:30:00.000Z', expected: { withinSchedule: true } };
  const scheduledBookingResponse = { ...bookingResponse,
    application: { ...bookingResponse.application, tables: [{ ...bookingResponse.application.tables[0], booking: { ...bookingRule,
      schedule: { timeZone: 'UTC', maxDurationMinutes: 60, weekly: [{ day: 1, startMinute: 540, endMinute: 1020 }] } } }] },
    projectSpecification: { ...projectSpecification,
      requirements: [{ id: 'safe-booking', origin: 'explicit', acceptanceCriteria: ['A synthetic interval fits the declared working hours.'] }],
      operations: [{ ...projectSpecification.operations[2], requirementIds: ['safe-booking'], dependsOn: [] }],
      rules: [], acceptanceTests: [scheduleTest] },
  };
  const scheduledBooking = await run(scheduledBookingResponse, 6, 'Build booking working hours', true);
  assert.equal(scheduledBooking.state.AiStage, 'ready');
  assert.deepEqual(scheduledBooking.state.Application.requirements.specification.acceptanceTests, [scheduleTest]);
  const invalidScheduleFixture = structuredClone(scheduledBookingResponse);
  invalidScheduleFixture.projectSpecification.acceptanceTests[0].startsAt = '2026-02-30T10:00:00.000Z';
  const rejectedSchedule = await run(invalidScheduleFixture, 6, 'Build booking working hours', true);
  assert.equal(rejectedSchedule.state.AiStage, 'error');
  assert.equal(rejectedSchedule.state.Pages, undefined, 'An invalid booking acceptance fixture rejects generation atomically');
  for (const prompt of ['Build recurring appointments', 'Build a booking waitlist', 'Build booking working hours', 'Book a doctor and room using multiple resources']) {
    const incompleteBooking = await run(bookingResponse, 6, prompt);
    assert.equal(incompleteBooking.state.AiStage, 'error'); assert.equal(incompleteBooking.state.Pages, undefined); assert.equal(incompleteBooking.checkpoints.length, 0);
  }
  for (const invalid of [response, { ...bookingResponse, application: { ...bookingResponse.application, tables: [{ ...bookingResponse.application.tables[0], booking: undefined }] } },
    { ...bookingResponse, application: { ...bookingResponse.application, tables: [{ ...bookingResponse.application.tables[0], booking: { ...bookingRule, secret: 'forbidden' } }] } }]) {
    const failed = await run(invalid, 6, 'Build appointment booking');
    assert.equal(failed.state.AiStage, 'error'); assert.equal(failed.state.Pages, undefined); assert.equal(failed.checkpoints.length, 0);
  }
  const inventoryTable = { id: 'stock_items', key: 'stock_items', name: 'Stock', fields: [
    { id: 'item_name', key: 'name', name: 'Name', type: 'text', required: true },
    { id: 'item_qty', key: 'quantity', name: 'Quantity', type: 'number', required: true, defaultValue: 0 }],
    permissions: ['read','create','update'].map(operation => ({ operation, access: 'owner' })),
    counter: { fieldId: 'item_qty', minimum: 0, integer: true } };
  const inventoryResponse = { projectKind: 'application', requirements: [{ id: 'stock-adjustment', summary: 'Authorized users can adjust stock safely.', capability: 'counter', evidence: ['counter:stock_items'] }], application: { ...application, pageAccess: [], tables: [inventoryTable] },
    pages: [{ name: 'Stock', slug: 'stock', sections: [{ type: 'features', applicationDataView: { tableId: 'stock_items', columns: ['item_name','item_qty'], actions: ['create','adjust'], pageSize: 10 } }] }] };
  const inventory = await run(inventoryResponse, 6, 'بدي إدارة المخزون'); assert.equal(inventory.state.AiStage, 'ready');
  assert.deepEqual(inventory.state.Application.tables[0].counter, inventoryTable.counter);
  const fakeInventory = await run(dashboardResponse, 6, 'Build inventory management');
  assert.equal(fakeInventory.state.AiStage, 'error'); assert.equal(fakeInventory.state.Pages, undefined); assert.equal(fakeInventory.checkpoints.length, 0);
  const invoiceTable = { id: 'invoice_lines', key: 'invoice_lines', name: 'Invoice lines', fields: [
    { id: 'unit_price', key: 'unit_price', name: 'Unit price', type: 'number', required: true, defaultValue: 0 },
    { id: 'units', key: 'units', name: 'Units', type: 'number', required: true, defaultValue: 0 },
    { id: 'line_total', key: 'line_total', name: 'Line total', type: 'number', required: true, formula: { operation: 'multiply', fieldIds: ['unit_price', 'units'] } }],
    permissions: ['read', 'create'].map(operation => ({ operation, access: 'owner' })) };
  const formulaResponse = { projectKind: 'application', requirements: [{ id: 'line-total', summary: 'Calculate line totals.', capability: 'formula', evidence: ['formula:invoice_lines'] }],
    application: { ...application, pageAccess: [], tables: [invoiceTable] }, pages: [{ name: 'Invoices', slug: 'invoices', sections: [{ type: 'features', applicationDataView: {
      tableId: 'invoice_lines', columns: ['unit_price', 'units', 'line_total'], actions: ['create'], pageSize: 10 } }] }] };
  const formulaApp = await run(formulaResponse, 6, 'Build invoice totals'); assert.equal(formulaApp.state.AiStage, 'ready');
  const hiddenFormula = structuredClone(formulaResponse); hiddenFormula.pages[0].sections[0].applicationDataView.columns = ['unit_price', 'units'];
  const missingFormula = await run(hiddenFormula, 6, 'Build invoice totals'); assert.equal(missingFormula.state.AiStage, 'error'); assert.equal(missingFormula.state.Pages, undefined);
  const orderTable = { id: 'orders', key: 'orders', name: 'Orders', fields: [{ id: 'order_note', key: 'note', name: 'Note', type: 'text', required: true }], permissions: [{ operation: 'read', access: 'owner' }, { operation: 'create', access: 'owner' }], transaction: { itemTableId: 'stock_items', lineTableId: 'order_lines', lineTransactionFieldId: 'order_line_order', lineItemFieldId: 'order_line_item', lineQuantityFieldId: 'order_line_quantity', counterDirection: 'decrement' } };
  const lineTable = { id: 'order_lines', key: 'order_lines', name: 'Order lines', fields: [
    { id: 'order_line_order', key: 'order_id', name: 'Order', type: 'reference', required: true, referenceTableId: 'orders' },
    { id: 'order_line_item', key: 'item_id', name: 'Item', type: 'reference', required: true, referenceTableId: 'stock_items' },
    { id: 'order_line_quantity', key: 'quantity', name: 'Quantity', type: 'number', required: true }], permissions: [{ operation: 'read', access: 'owner' }] };
  const orderResponse = { projectKind: 'application', requirements: [{ id: 'atomic-order', summary: 'Users can create a multi-item order atomically.', capability: 'transaction', evidence: ['transaction:orders'] }], application: { ...application, pageAccess: [], tables: [inventoryTable, orderTable, lineTable] }, pages: [{ name: 'Orders', slug: 'orders', sections: [{ type: 'features', applicationDataView: { tableId: 'orders', columns: ['order_note'], actions: ['transact'], pageSize: 10 } }] }] };
  const orders = await run(orderResponse, 6, 'بدي إدارة الطلبات'); assert.equal(orders.state.AiStage, 'ready'); assert.deepEqual(orders.state.Application.tables[1].transaction, orderTable.transaction);
  const fakeOrders = await run(dashboardResponse, 6, 'Build order management'); assert.equal(fakeOrders.state.AiStage, 'error'); assert.equal(fakeOrders.state.Pages, undefined);
  const pricedInventoryTable = { ...inventoryTable, fields: [...inventoryTable.fields,
    { id: 'item_price', key: 'unit_price', name: 'Unit price', type: 'number', required: true, defaultValue: 0 }] };
  const paidOrderTable = { ...orderTable, payment: { provider: 'stripe', currency: 'usd', itemUnitAmountFieldId: 'item_price', refundRoleId: 'finance' } };
  const paymentResponse = { projectKind: 'application', requirements: [{ id: 'server-payment', summary: 'Users can pay and finance can refund.', capability: 'payment', evidence: ['payment:orders', 'view:orders:refund'] }],
    application: { ...application, roles: [{ id: 'finance', name: 'Finance' }], pageAccess: [], tables: [pricedInventoryTable, paidOrderTable, lineTable] },
    pages: [{ name: 'Checkout', slug: 'checkout', sections: [{ type: 'features', applicationDataView: { tableId: 'orders', columns: ['order_note'], actions: ['transact', 'pay', 'refund'], pageSize: 10 } }] }] };
  const payment = await run(paymentResponse, 6, 'Build Stripe checkout and refunds'); assert.equal(payment.state.AiStage, 'ready');
  assert.deepEqual(payment.state.Application.tables[1].payment, paidOrderTable.payment);
  const missingRefund = structuredClone(paymentResponse); missingRefund.pages[0].sections[0].applicationDataView.actions = ['transact', 'pay'];
  const incompleteRefund = await run(missingRefund, 6, 'Build Stripe checkout and refunds'); assert.equal(incompleteRefund.state.AiStage, 'error'); assert.equal(incompleteRefund.state.Pages, undefined);
  const workflowTable = { ...orderTable, transaction: undefined, permissions: ['read', 'create', 'update'].map(operation => ({ operation, access: 'owner' })),
    fields: [...orderTable.fields, { id: 'order_state', key: 'state', name: 'State', type: 'enum', required: true, options: ['pending', 'approved'], defaultValue: 'pending' }],
    workflow: { fieldId: 'order_state', transitions: [{ id: 'approve', label: 'Approve', from: ['pending'], to: 'approved', access: 'owner' }] } };
  const workflowResponse = { projectKind: 'application', requirements: [{ id: 'approval', summary: 'Users can approve their pending orders.', capability: 'workflow', evidence: ['workflow:orders'] }],
    application: { ...application, pageAccess: [], tables: [workflowTable] }, pages: [{ name: 'Approvals', slug: 'approvals', sections: [{ type: 'features',
      applicationDataView: { tableId: 'orders', columns: ['order_note', 'order_state'], actions: ['transition'], pageSize: 10 } }] }] };
  const workflow = await run(workflowResponse, 6, 'Build order approvals'); assert.equal(workflow.state.AiStage, 'ready');
  assert.deepEqual(workflow.state.Application.tables[0].workflow, workflowTable.workflow);
  const missingWorkflowAction = structuredClone(workflowResponse); missingWorkflowAction.pages[0].sections[0].applicationDataView.actions = [];
  const missingWorkflow = await run(missingWorkflowAction, 6, 'Build order approvals'); assert.equal(missingWorkflow.state.AiStage, 'error'); assert.equal(missingWorkflow.state.Pages, undefined);
  const reportTable = { ...invoiceTable, fields: [...invoiceTable.fields,
    { id: 'invoice_category', key: 'category', name: 'Category', type: 'enum', required: true, options: ['service', 'product'], defaultValue: 'service' },
    { id: 'invoice_date', key: 'invoice_date', name: 'Date', type: 'date', required: true }],
    reports: [{ id: 'monthly_count', name: 'Monthly count', operation: 'count', groupByFieldId: 'invoice_category',
      period: { fieldId: 'invoice_date', unit: 'month', timeZone: 'UTC', offset: 0, comparePrevious: true } }] };
  const reportResponse = { projectKind: 'application', requirements: [{ id: 'monthly-report', summary: 'Show grouped monthly counts and compare periods.', capability: 'reports', evidence: ['reports:invoice_lines'] }],
    application: { ...application, pageAccess: [], tables: [reportTable] }, pages: [{ name: 'Reports', slug: 'reports', sections: [{ type: 'features', applicationDataView: {
      tableId: 'invoice_lines', columns: ['invoice_category', 'invoice_date'], actions: [], pageSize: 10 } }] }] };
  const reports = await run(reportResponse, 6, 'Build grouped monthly reports with period comparison'); assert.equal(reports.state.AiStage, 'ready');
  const ungrouped = structuredClone(reportResponse); delete ungrouped.application.tables[0].reports[0].groupByFieldId;
  const incompleteReports = await run(ungrouped, 6, 'Build grouped monthly reports with period comparison'); assert.equal(incompleteReports.state.AiStage, 'error'); assert.equal(incompleteReports.state.Pages, undefined);
  const emailResponse = { ...response, requirements: [{ id: 'created-email', summary: 'Email the owner after creation.', capability: 'email', evidence: ['email:appointments'] }],
    application: { ...application, tables: [{ ...table, notifications: [{ id: 'created-email', connectionId: 'invented-resend', event: { type: 'created' }, subject: 'Saved {{record.id}}', text: 'Your request was saved.' }] }] } };
  const inventedEmail = await run(emailResponse, 6, 'Build confirmation email notifications'); assert.equal(inventedEmail.state.AiStage, 'error'); assert.equal(inventedEmail.state.Pages, undefined);
  for (const prompt of ['Build Stripe payment checkout', 'Build confirmation email notifications', 'Build grouped monthly reports', 'Build private file uploads']) {
    const incompleteCapability = await run(dashboardResponse, 6, prompt);
    assert.equal(incompleteCapability.state.AiStage, 'error'); assert.equal(incompleteCapability.state.Pages, undefined); assert.equal(incompleteCapability.checkpoints.length, 0);
  }
  for (const invalidRequirements of [undefined, [], [{ id: 'fake-payment', summary: 'Payments work.', capability: 'records', evidence: ['view:payments:create'] }]]) {
    const failed = await run({ ...dashboardResponse, requirements: invalidRequirements }, 6, 'Build record management');
    assert.equal(failed.state.AiStage, 'error'); assert.equal(failed.state.Pages, undefined); assert.equal(failed.checkpoints.length, 0);
  }
  const fakeDashboard = await run(response, 6, 'Build record management');
  assert.equal(fakeDashboard.state.AiStage, 'error'); assert.equal(fakeDashboard.state.Pages, undefined);
  const fakeRecordBrochure = await run({ projectKind: 'website', pages: [response.pages[0]] }, 6, 'بدي إدارة السجلات');
  assert.equal(fakeRecordBrochure.state.AiStage, 'error'); assert.equal(fakeRecordBrochure.state.Pages, undefined);

  // Real applications must never be accepted as brochure-only pages.
  const informationalRealEstate = { projectKind: 'website', pages: [{ name: 'Home', slug: 'home',
    sections: [{ type: 'hero', title: 'Properties', buttonText: 'Explore', buttonUrl: '#hero' }] }] };
  for (const prompt of [
    'بدي تطبيق عقارات متكامل لإضافة العقارات وتعديلها وحذفها',
    'اعمل نظام إدارة العقارات للموظفين',
    'موقع عقارات فيه لوحة تحكم لإدارة الإعلانات',
    'Build a property management application with saved listings',
    'Build a custom app for my rental business',
    'Build a property management application with a landing page',
    'Landing page plus a working CRM for my team',
    'Build a brochure site and a custom real estate app',
    'صفحة تعريفية مع نظام إدارة العقارات',
    'I need an online marketplace with sellers, buyers and orders',
    'Build a real estate website where agents can add, edit and delete property listings',
    'Build an interactive portal with user login and saved properties',
    'Please create a booking and payment platform',
    'أريد موقع عقاري فيه بحث وتصفية وإدارة حجوزات',
    'Build a landing page plus a booking platform',
  ]) {
    const downgraded = await run(informationalRealEstate, 6, prompt);
    assert.equal(downgraded.state.AiStage, 'error', 'Brochure downgrade: ' + prompt);
    assert.equal(downgraded.state.Application, undefined);
    assert.equal(downgraded.state.Pages, undefined);
    assert.equal(downgraded.checkpoints.length, 0);
  }
  for (const prompt of ['بدي موقع عقارات تعريفي يعرض الصور', 'Create a landing page for my property management app', 'صفحة هبوط لنظام إدارة العقارات',
    'Landing page for my booking platform, with screenshots of login and orders',
    'Build an informational website about property management systems and database design',
    'موقع تسويقي لمنصة الحجوزات يعرض ميزات تسجيل الدخول وإضافة الطلبات']) {
    const brochureOnly = await run(informationalRealEstate, 6, prompt);
    assert.equal(brochureOnly.state.AiStage, 'ready', 'Informational site should remain allowed: ' + prompt);
    assert.equal(brochureOnly.state.Application, undefined);
  }
  for (const [json, limit] of [
    [{ ...response, application: undefined }, 6],
    [{ ...response, application: { ...application, secrets: { token: 'forbidden' } } }, 6],
    [{ ...response, application: { ...application, tables: [{ ...table, permissions: [{ operation: 'create', access: 'public' }] }] } }, 6],
    [{ ...response, unsupportedFeatures: ['SMS confirmation'] }, 6],
    [{ ...response, pages: [{ ...response.pages[0], sections: [{ type: 'hero', buttonText: 'Login', buttonUrl: '#login' }] }, response.pages[1]] }, 6],
    [response, 1],
    [{ ...response, pages: [response.pages[0], { ...response.pages[1], sections: [{ ...response.pages[1].sections[0], formFields: [{ ...response.pages[1].sections[0].formFields[0], credentials: 'forbidden' }] }] }] }, 6],
    [{ ...response, pages: [response.pages[0], { ...response.pages[1], sections: [{ type: 'contact' }] }] }, 6],
    [{ ...response, pages: [response.pages[0], { ...response.pages[1], sections: [{ ...response.pages[1].sections[0], formSuccessAction: 'redirect', formRedirectUrl: '/thanks' }] }] }, 6],
    [{ ...response, pages: [response.pages[0], { ...response.pages[1], sections: [{ ...response.pages[1].sections[0], formAutomations: [{ enabled: true }] }] }] }, 6],
  ]) {
    const failed = await run(json, limit);
    assert.equal(failed.state.AiStage, 'error');
    assert.equal(failed.state.Application, undefined, 'Invalid response cannot alter current app');
    assert.equal(failed.state.Pages, undefined, 'Invalid response cannot apply a partial site');
    assert.equal(failed.checkpoints.length, 0);
  }
  const brochure = await run({ projectKind: 'website', pages: [{ name: 'Home', slug: 'home', sections: [{ type: 'hero', buttonText: 'Explore', buttonUrl: '#hero' }] }] }, 6, 'Build a dental practice brochure');
  assert.equal(brochure.state.AiStage, 'ready');
  assert.equal(brochure.state.Application, undefined);
  const completeBrochure = { projectKind: 'website', pages: Array.from({ length: 7 }, (_, index) => ({
    name: `Page ${index + 1}`, slug: `page-${index + 1}`,
    sections: Array.from({ length: 9 }, (_, sectionIndex) => ({ type: 'about', title: `Content ${index}-${sectionIndex}` })),
  })) };
  const complete = await run(completeBrochure, 25, 'Build a complete business website');
  assert.equal(complete.state.AiStage, 'ready');
  assert.equal(complete.state.Pages.length, 7, 'Generation must honor entitlements beyond six pages');
  assert.equal(complete.state.Pages[6].sections.length, 9, 'Generation must retain sections beyond eight');
  assert.equal(complete.state.Pages[6].sections[8].title, 'Content 6-8');
  assert.equal(complete.state.Pages[0].sections[0].buttonText, '', 'Do not invent a CTA');
  assert.equal(complete.state.Pages[0].sections[0].buttonUrl, '', 'Do not invent a missing contact target');
  assert.equal(complete.state.Pages[0].sections[0].elements.some(element => element.type === 'button'), false);
  await build({ entryPoints: ['src/lib/ai/prompts.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'prompts.cjs'), alias: { '@': resolve('src') } });
  const { promptManager } = require(join(dir, 'prompts.cjs'));
  const messages = promptManager.buildMessages('website-builder', { action: 'generate', prompt: 'Build seven pages', limits: { maxPages: 25, maxSectionsPerPage: 80 } });
  assert.match(messages.at(-1).content, /"maxPages":25/, 'Model must receive the real page allowance');
  assert.match(messages.map(message => message.content).join('\n'), /"operation":"related".*"referenceFieldId".*"change"/s, 'AI contract must describe the executable atomic related-record effect');
  for (const json of [
    completeBrochure,
    { projectKind: 'website', pages: [completeBrochure.pages[0], { name: 'Missing', sections: [] }] },
    { projectKind: 'website', pages: [{ sections: [{ type: 'unsupported-widget' }, { type: 'hero' }] }] },
    { projectKind: 'website', pages: [{ sections: Array.from({ length: 81 }, () => ({ type: 'about' })) }] },
    { projectKind: 'website', pages: [{ sections: [{ type: 'hero', buttonText: 'Open portal' }] }] },
    { projectKind: 'website', pages: [{ sections: null }] },
  ]) {
    const failed = await run(json, 6, 'Build a business website');
    assert.equal(failed.state.AiStage, 'error');
    assert.equal(failed.state.Pages, undefined, 'Incomplete brochure must not replace the current site');
    assert.equal(failed.checkpoints.length, 0);
  }
  await build({ entryPoints: ['src/modules/website-builder/core/website-project-links.ts', 'src/modules/website-builder/core/website-builder-rendering.ts'], bundle: true,
    platform: 'node', format: 'cjs', outdir: dir, alias: { '@': resolve('src') }, define: { 'import.meta.env': '{}' } });
  const { websiteProjectLinkIssues } = require(join(dir, 'website-project-links.js'));
  const { resolveBuilderHref, sectionToHtml } = require(join(dir, 'website-builder-rendering.js'));
  const customOperationButton = { id: 'approve', type: 'button', action: 'custom-operation', content: 'Approve',
    customOperationId: 'approve_case', customOperationInputJson: '{"caseId":"case-17"}', style: {} };
  const customOperationHtml = sectionToHtml({ id: 'workflow', type: 'features', elements: [customOperationButton] }, 'home');
  assert.match(customOperationHtml, /data-tayar-custom-operation="approve_case"/);
  assert.match(customOperationHtml, /data-tayar-custom-operation-input="\{&quot;caseId&quot;:&quot;case-17&quot;\}"/);
  assert.match(customOperationHtml, /<button[^>]*disabled/);
  assert.match(customOperationHtml, /data-tayar-custom-operation-status/);
  assert.match(customOperationHtml, /<details data-tayar-custom-operation-result hidden><summary>Result<\/summary><pre><\/pre><\/details>/,
    'custom operations provide an initially hidden, accessible result panel');
  const boundOperationHtml = sectionToHtml({ id: 'bound-contact', type: 'contact', elements: [
    { ...customOperationButton, customOperationBindFormValues: true },
  ], formFields: [{ id: 'email-field', name: 'email', label: 'Email', type: 'email', required: true }],
    applicationFormBinding: { operation: 'create', tableId: 'requests', fields: [] } }, 'home');
  assert.match(boundOperationHtml, /data-tayar-custom-operation-bind-form="true"/);
  const malformedOperationHtml = sectionToHtml({ id: 'workflow', type: 'features', elements: [
    { ...customOperationButton, customOperationInputJson: '[1]' },
  ] }, 'home');
  assert.match(malformedOperationHtml, /data-tayar-custom-operation-invalid="true"/);
  assert.doesNotMatch(malformedOperationHtml, /data-tayar-custom-operation-input=/);
  const pages = structuredClone(built.state.Pages);
  pages[0].sections[0].buttonUrl = 'page:booking#booking-form';
  pages[0].sections[0].elements.find(e => e.type === 'button').href = 'page:booking#booking-form';
  assert.equal(websiteProjectLinkIssues(pages).length, 0);
  assert.equal(resolveBuilderHref('page:booking#booking-form'), 'booking.html#booking-form');
  assert.match(sectionToHtml(pages[0].sections[0], 'home'), /href="booking.html#booking-form"/);
  assert.match(sectionToHtml(pages[1].sections[0], 'home'), /id="booking-form"/);
  pages[0].sections[0].buttonUrl = '#login';
  assert.equal(websiteProjectLinkIssues(pages)[0].code, 'LINK_ANCHOR_MISSING');
  pages[0].sections[0].buttonUrl = '/booking';
  assert.equal(websiteProjectLinkIssues(pages)[0].code, 'LINK_ESCAPES_PROJECT');
  console.log('PASS real generation handler: complete pages/sections without invented CTAs; native application/forms/links/history; invalid plans rejected atomically');
} finally { delete globalThis.window; delete globalThis.__generationResponse; await rm(dir, { recursive: true, force: true }); }
