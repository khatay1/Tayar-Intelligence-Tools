import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-application-repair-'));
try {
  await writeFile(join(dir, 'entry.ts'), ['editor-ai-change-handler', 'editor-application-repair-safety', 'defaults', 'website-builder-config']
    .map(name => `export * from ${JSON.stringify(resolve(`src/modules/website-builder/core/${name}`))};`).join('\n'));
  await build({ entryPoints: [join(dir, 'entry.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'test.cjs'),
    alias: { '@': resolve('src') }, define: { 'import.meta.env': '{}' }, plugins: [{ name: 'fixture-ai', setup(b) {
      b.onResolve({ filter: /^@\/lib\/ai\/service$/ }, () => ({ path: 'ai', namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const createAIService=()=>({completeJSON:async(request)=>globalThis.__repairAI(request)});' }));
    } }] });
  const { createAIChangeHandler, applicationRepairSafetyIssues, normalizeSection, normalizeTheme, normalizeHeaderConfig,
    BUSINESS_BILLING_ENTITLEMENTS } = createRequire(import.meta.url)(join(dir, 'test.cjs'));
  const form = normalizeSection({ id: 'form', type: 'contact', title: 'Create entry', formFields: [
    { id: 'title-input', name: 'title', label: 'Title', type: 'text', required: true },
  ], applicationFormBinding: { operation: 'create', tableId: 'entries', fields: [{ formFieldId: 'title-input', tableFieldId: 'title' }] } });
  const view = normalizeSection({ id: 'view', type: 'features', title: 'Entries',
    applicationDataView: { tableId: 'entries', columns: ['title'], actions: ['create', 'update'], pageSize: 10 } });
  const pages = [{ id: 'home', name: 'Entries', slug: 'entries', showInNavigation: true, sections: [form, view] }];
  const application = { version: 1, auth: { enabled: true, signUpEnabled: false, emailVerificationRequired: true }, roles: [],
    pageAccess: [{ pageId: 'home', access: 'authenticated' }], tables: [{ id: 'entries', key: 'entries', name: 'Entries',
      fields: [{ id: 'title', key: 'title', name: 'Title', type: 'text', required: true }],
      permissions: ['read', 'create', 'update'].map(operation => ({ operation, access: 'owner' })) }],
    requirements: { version: 1, request: 'Validate synthetic entry values.', items: [
      { id: 'entry-form', summary: 'Convert valid titles.', capability: 'form', evidence: ['form:entries'] },
    ], specification: { version: 1, intent: 'Validate entry values.', actors: [{ id: 'owner', name: 'Owner' }],
      entities: [{ id: 'entries', scope: 'owner', classification: 'internal' }],
      requirements: [{ id: 'entry-form', origin: 'explicit', acceptanceCriteria: ['A title converts to its payload.'] }],
      acceptanceTests: [{ id: 'title-values', requirementId: 'entry-form', criterionIndex: 0, kind: 'form-values', pageId: 'home', sectionId: 'form',
        input: [{ name: 'title', value: 'Synthetic title' }], expected: { outcome: 'accepted', values: { title: 'Synthetic title' } } }],
      operations: [{ id: 'create-entry', summary: 'Convert a title.', actorIds: ['owner'], entityIds: ['entries'], requirementIds: ['entry-form'],
        dependsOn: [], execution: 'native', transactional: false }], rules: [], tenancy: { mode: 'single' }, integrations: [], privacy: [], decisions: [] } } };
  assert.deepEqual(applicationRepairSafetyIssues(application, pages, pages), []);
  assert.deepEqual(applicationRepairSafetyIssues(undefined, pages, []), [], 'Brochure edits retain their existing validation path');
  const removedForm = structuredClone(pages); removedForm[0].sections.shift();
  assert.match(applicationRepairSafetyIssues(application, pages, removedForm).join('\n'), /contract:form:entries|acceptance:/);
  const renamed = structuredClone(pages); renamed[0].sections[0].formFields[0].name = 'renamed_title';
  assert.match(applicationRepairSafetyIssues(application, pages, renamed).join('\n'), /acceptance:/,
    'A still-compilable mapping cannot invalidate previously passing acceptance fixtures');
  const badView = structuredClone(pages); badView[0].sections[1].applicationDataView.columns = ['missing'];
  assert.match(applicationRepairSafetyIssues(application, pages, badView).join('\n'), /data-view bindings/);
  assert.match(applicationRepairSafetyIssues(application, pages, []).join('\n'), /page access/);
  const unbound = structuredClone(pages); delete unbound[0].sections[0].applicationFormBinding;
  assert.match(applicationRepairSafetyIssues(application, pages, unbound).join('\n'), /form mappings/);
  const untested = structuredClone(application); delete untested.requirements.specification.acceptanceTests;
  assert.deepEqual(applicationRepairSafetyIssues(untested, pages, pages), [], 'Existing untested criteria do not prevent unrelated repairs');
  const before = JSON.stringify({ application, pages });

  async function run(operation, app = application, approve = true) {
    const state = { AiMessages: [] }, requests = [], checkpoints = [], mutations = [], previews = [];
    globalThis.__repairAI = request => {
      requests.push(request.action);
      if (request.action === 'plan-edit') return { json: { steps: [{ id: 'step-1', title: 'Repair the selected section.' }] } };
      if (request.action === 'edit') return { json: { summary: 'Repair entry interface.', operations: [{ ...operation, planStepId: 'step-1' }] } };
      return { json: { score: 100, summary: 'Model claims this is safe.', findings: [] } };
    };
    const args = {
      application: app, activePageId: 'home', activeUserIdRef: { current: 'owner' }, aiAbortControllerRef: { current: null },
      aiBusy: false, aiQualityBusy: false, aiEditScope: 'site', aiMessages: [], aiOperationSequenceRef: { current: 0 },
      aiPreparedFollowUpRef: { current: null }, aiPrompt: 'Repair the entry interface.', aiQualityAbortControllerRef: { current: null },
      aiQualityReviewContextRef: { current: null }, aiUndoContextRef: { current: null },
      beginAIRequest: () => new AbortController(), finishAIRequest: () => {}, captureAIEditorContext: () => ({}), aiEditorContextIsCurrent: () => true,
      billingEntitlements: BUSINESS_BILLING_ENTITLEMENTS, billingPlan: 'business', brand: {},
      buildAIEditableSnapshot: () => ({ pages }), buildProjectSnapshot: () => ({ application: app, pages }), getCurrentPages: () => structuredClone(pages),
      headerConfig: normalizeHeaderConfig({}), homePageId: 'home', l: text => text, prefs: { language: 'en' },
      pushProjectCheckpoint: (...entry) => checkpoints.push(entry), remember: () => mutations.push('remember'),
      requestAIPlanReview: async () => true, requestAIPatchReview: async review => review.selectedOperationIds,
      requestAICandidatePreview: async preview => { previews.push(preview); return approve; }, requestGeneratedImage: async () => { throw Error(); },
      sections: structuredClone(pages[0].sections), selectedId: 'form', selectedElementId: null,
      seo: { title: 'Entries', description: 'Synthetic entry interface.', keywords: [] }, siteName: 'Entries', symbols: [],
      theme: normalizeTheme({}), user: { id: 'owner' },
    };
    for (const key of ['ActivePageId','AiBusy','AiCandidatePreview','AiError','AiMessages','AiPatchReview','AiPlan','AiPrompt','AiQualityReview','AiStage','AiUndoSnapshot',
      'BuilderPanel','HeaderConfig','HomePageId','InspectorOpen','Pages','Saved','Sections','SelectedElementId','SelectedId','Seo','SiteName','Symbols','Theme']) {
      args[`set${key}`] = value => {
        state[key] = typeof value === 'function' ? value(state[key] ?? []) : value;
        if (['Pages','Sections','HomePageId','SiteName','Theme','HeaderConfig','Symbols','Seo'].includes(key)) mutations.push(key);
      };
    }
    await createAIChangeHandler(args)();
    return { state, requests, checkpoints, mutations, previews };
  }
  for (const operation of [
    { action: 'remove_section', pageId: 'home', sectionId: 'form' },
    { action: 'update_form_field', pageId: 'home', sectionId: 'form', formFieldId: 'title-input', changes: { formFieldName: 'renamed_title' } },
  ]) {
    const rejected = await run(operation);
    assert.equal(rejected.state.AiStage, 'error', JSON.stringify(rejected.state));
    assert.match(rejected.state.AiError, /project safety validation/);
    assert.deepEqual(rejected.requests, ['plan-edit', 'edit'], 'Deterministic failure stops before advisory model review');
    assert.deepEqual(rejected.mutations, []); assert.deepEqual(rejected.checkpoints, []); assert.deepEqual(rejected.previews, []);
    assert.equal(rejected.state.AiUndoSnapshot, undefined, 'Blocked repair cannot replace the last undo snapshot');
  }
  const safe = await run({ action: 'update_section', pageId: 'home', sectionId: 'form', changes: { title: 'Improved title' } });
  assert.equal(safe.state.AiStage, 'ready', JSON.stringify(safe.state));
  assert.deepEqual(safe.requests, ['plan-edit', 'edit', 'review-edit']);
  assert.equal(safe.state.Pages[0].sections[0].title, 'Improved title');
  assert.equal(safe.checkpoints.length, 2, 'Safe repair checkpoints before and after application');
  assert.deepEqual(safe.state.AiUndoSnapshot.pages, JSON.parse(JSON.stringify(pages)), 'Safe repairs retain the exact baseline for existing undo');
  const declined = await run({ action: 'update_section', pageId: 'home', sectionId: 'form', changes: { title: 'Improved title' } }, application, false);
  assert.deepEqual(declined.mutations, []); assert.deepEqual(declined.checkpoints, []);
  assert.equal(JSON.stringify({ application, pages }), before, 'Verification and candidate edits never mutate baseline application data');
  console.log('PASS actual AI repair: invalid bindings and regressed passing acceptance blocked before review/preview/mutation; safe edits checkpoint and preserve undo; declined previews stay inert');
} finally {
  delete globalThis.__repairAI;
  await rm(dir, { recursive: true, force: true });
}
