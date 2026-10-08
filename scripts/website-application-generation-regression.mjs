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
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const createAIService=()=>({completeJSON:async()=>globalThis.__generationResponse});' }));
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
  async function run(json, maxPages = 6, prompt = 'Build saved records with a patient portal') {
    globalThis.__generationResponse = { json };
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
    await createAIGenerationHandler(args)();
    return { state, checkpoints };
  }
  const built = await run(response);
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
  const deliveryConfig = { clientName: '', clientEmail: '', projectCode: '', status: 'review', dueDate: '', handoffNotes: '', whiteLabel: true, approvedAt: null, approvedFingerprint: '', deliveredAt: null };
  let deliveryMutations = 0, alerts = 0;
  globalThis.window.alert = () => { alerts++; };
  const deliveryArgs = { pages: built.state.Pages, deliveryConfig, approvalCurrent: false, siteName: 'App', getLaunchReadiness: () => ({ score: 0, checks: [], auditPoints: 0 }), siteAudit: { score: 0, errors: [], warnings: [] }, publishedUrl: 'https://example.test', previewUrl: '', deliveryUsage: {}, setDeliveryConfig: updater => { deliveryMutations++; updater(deliveryConfig); }, setSaved: () => {}, buildDeliveryFingerprint: () => 'verified', requireBillingFeature: () => true, l: text => text };
  createDeliveryActions({ ...deliveryArgs, application }).approveForDelivery();
  assert.equal(deliveryMutations, 0, 'applications without a verified requirement manifest cannot be approved');
  createDeliveryActions({ ...deliveryArgs, application: built.state.Application }).approveForDelivery();
  assert.equal(deliveryMutations, 1, 'verified application requirements allow approval');
  createDeliveryActions({ ...deliveryArgs, pages: built.state.Pages.filter(page => page.slug !== 'booking'), application: built.state.Application }).approveForDelivery();
  assert.equal(deliveryMutations, 1, 'stale requirement evidence cannot approve a changed application');
  createDeliveryActions({ ...deliveryArgs, application: built.state.Application }).markProjectDelivered();
  assert.equal(deliveryMutations, 1, 'unapproved current builds cannot be marked delivered');
  createDeliveryActions({ ...deliveryArgs, approvalCurrent: true, application: built.state.Application }).markProjectDelivered();
  assert.equal(deliveryMutations, 2, 'approved verified applications can be marked delivered');
  assert.equal(alerts, 3);
  const dataView = { tableId: 'appointments', columns: ['visit_date'], actions: ['update', 'delete'], pageSize: 10 };
  const dashboardResponse = { ...response, requirements: [{ id: 'record-editor', summary: 'Users can update saved records.', capability: 'records', evidence: ['view:appointments:update'] }], application: { ...application, tables: [{ ...table, permissions: [...table.permissions, { operation: 'update', access: 'owner' }, { operation: 'delete', access: 'owner' }] }] },
    pages: [...response.pages, { name: 'Records', slug: 'records', sections: [{ type: 'features', title: 'My records', applicationDataView: dataView }] }] };
  const dashboard = await run(dashboardResponse, 6, 'Build record management');
  assert.equal(dashboard.state.AiStage, 'ready');
  assert.deepEqual(dashboard.state.Pages[2].sections[0].applicationDataView, dataView);
  assert.deepEqual(dashboard.checkpoints.at(-1)[1].pages[2].sections[0].applicationDataView, dataView);
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
  const orderTable = { id: 'orders', key: 'orders', name: 'Orders', fields: [{ id: 'order_note', key: 'note', name: 'Note', type: 'text', required: true }], permissions: [{ operation: 'read', access: 'owner' }, { operation: 'create', access: 'owner' }], transaction: { itemTableId: 'stock_items', lineTableId: 'order_lines', lineTransactionFieldId: 'order_line_order', lineItemFieldId: 'order_line_item', lineQuantityFieldId: 'order_line_quantity', counterDirection: 'decrement' } };
  const lineTable = { id: 'order_lines', key: 'order_lines', name: 'Order lines', fields: [
    { id: 'order_line_order', key: 'order_id', name: 'Order', type: 'reference', required: true, referenceTableId: 'orders' },
    { id: 'order_line_item', key: 'item_id', name: 'Item', type: 'reference', required: true, referenceTableId: 'stock_items' },
    { id: 'order_line_quantity', key: 'quantity', name: 'Quantity', type: 'number', required: true }], permissions: [{ operation: 'read', access: 'owner' }] };
  const orderResponse = { projectKind: 'application', requirements: [{ id: 'atomic-order', summary: 'Users can create a multi-item order atomically.', capability: 'transaction', evidence: ['transaction:orders'] }], application: { ...application, pageAccess: [], tables: [inventoryTable, orderTable, lineTable] }, pages: [{ name: 'Orders', slug: 'orders', sections: [{ type: 'features', applicationDataView: { tableId: 'orders', columns: ['order_note'], actions: ['transact'], pageSize: 10 } }] }] };
  const orders = await run(orderResponse, 6, 'بدي إدارة الطلبات'); assert.equal(orders.state.AiStage, 'ready'); assert.deepEqual(orders.state.Application.tables[1].transaction, orderTable.transaction);
  const fakeOrders = await run(dashboardResponse, 6, 'Build order management'); assert.equal(fakeOrders.state.AiStage, 'error'); assert.equal(fakeOrders.state.Pages, undefined);
  for (const invalidRequirements of [undefined, [], [{ id: 'fake-payment', summary: 'Payments work.', capability: 'records', evidence: ['view:payments:create'] }]]) {
    const failed = await run({ ...dashboardResponse, requirements: invalidRequirements }, 6, 'Build record management');
    assert.equal(failed.state.AiStage, 'error'); assert.equal(failed.state.Pages, undefined); assert.equal(failed.checkpoints.length, 0);
  }
  const fakeDashboard = await run(response, 6, 'Build record management');
  assert.equal(fakeDashboard.state.AiStage, 'error'); assert.equal(fakeDashboard.state.Pages, undefined);
  const fakeRecordBrochure = await run({ projectKind: 'website', pages: [response.pages[0]] }, 6, 'بدي إدارة السجلات');
  assert.equal(fakeRecordBrochure.state.AiStage, 'error'); assert.equal(fakeRecordBrochure.state.Pages, undefined);
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
