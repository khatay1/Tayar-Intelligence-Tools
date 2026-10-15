import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const temp = await mkdtemp(join(tmpdir(), 'tayar-application-ai-'));
try {
  const outfile = join(temp, 'planner.cjs');
  const entry = join(temp, 'entry.ts');
  await writeFile(entry, [
    'src/modules/website-builder/services/websiteApplicationAIService.ts',
    ...['application-operations', 'editor-command', 'editor-history'].map(name => `src/modules/website-builder/core/${name}.ts`),
  ].map(path => `export * from ${JSON.stringify(resolve(path))};`).join('\n'));
  await build({
    entryPoints: [entry],
    bundle: true, platform: 'node', format: 'cjs', outfile,
    alias: { '@': resolve('src') },
    plugins: [{ name: 'isolated-ai-engine', setup(bundler) {
      bundler.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({ path: 'ai-engine', namespace: 'mock' }));
      bundler.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const supabase = { functions: { invoke: async (_, request) => { globalThis.__aiBody = request.body; return globalThis.__aiResponse; } } };', loader: 'js' }));
    } }],
  });
  const { planWebsiteApplicationWithAI, applicationFingerprint, createApplicationCommand, runEditorCommand, createEditorHistory, undoEditorHistory, redoEditorHistory } = (await import(pathToFileURL(outfile))).default;
  const project = { cloudProjectId: 'app-one', pages: [{ id: 'home' }], application: undefined };
  const base = { id: 'products', key: 'products', name: 'Products', fields: [{ id: 'product-name', key: 'name', name: 'Name', type: 'text', required: true }], permissions: [{ operation: 'read', access: 'public' }] };
  globalThis.__aiResponse = { data: { json: { summary: 'Products', warnings: [], operations: [{ type: 'put_table', table: base }] } }, error: null };
  const plan = await planWebsiteApplicationWithAI(project, 'Create product data');
  assert.equal(plan.operations[0].table.key, 'products');
  assert.equal(globalThis.__aiBody.tool, 'website-builder');
  assert.equal(JSON.stringify(globalThis.__aiBody).includes('STRIPE_SECRET_KEY'), false);
  for (const operation of [
    { type: 'put_table', table: { ...base, key: 'products; drop table users' } },
    { type: 'put_table', table: { ...base, secrets: { token: 'hidden' } } },
    { type: 'remove_table', tableId: 'products' },
    { type: 'put_role', role: { id: 'admin', name: 'Admin', permissions: ['service_role'] } },
    { type: 'put_table', table: { ...base, fields: [{ ...base.fields[0], referenceTableId: 'other' }] } },
  ]) {
    globalThis.__aiResponse = { data: { json: { summary: 'unsafe', warnings: [], operations: [operation] } }, error: null };
    await assert.rejects(planWebsiteApplicationWithAI(project, 'Do something unsafe'));
  }
  const amount = { id: 'amount', key: 'amount', name: 'Amount', type: 'number', required: true, defaultValue: 1 };
  const linkedTable = { ...base, fields: [...base.fields, amount], permissions: ['read', 'create', 'update'].map(operation => ({ operation, access: 'owner' })) };
  const linked = { cloudProjectId: 'linked-project', pages: [{ id: 'home', sections: [
    { id: 'form', type: 'contact', elements: [], formFields: [{ id: 'name-input', name: 'name', label: 'Name', type: 'text', required: true }],
      applicationFormBinding: { operation: 'create', tableId: base.id, fields: [{ formFieldId: 'name-input', tableFieldId: base.fields[0].id }] } },
    { id: 'view', type: 'features', elements: [], applicationDataView: { tableId: base.id, columns: ['product-name', 'amount'], actions: ['create', 'update'], pageSize: 10 } },
  ] }], application: { version: 1, roles: [], auth: { enabled: true, signUpEnabled: false, emailVerificationRequired: true },
    pageAccess: [{ pageId: 'home', access: 'authenticated' }], tables: [linkedTable], requirements: { version: 1, request: 'Preserve verified payload and page policies.',
      items: [
        { id: 'form', summary: 'Convert synthetic names.', capability: 'form', evidence: ['form:products'] },
        { id: 'record', summary: 'Convert synthetic record amounts.', capability: 'records', evidence: ['view:products:update'] },
        { id: 'page', summary: 'Require a signed-in principal.', capability: 'page', evidence: ['page:home'] },
      ], specification: { version: 1, intent: 'Preserve native payload conversion and page policy.', actors: [{ id: 'owner', name: 'Owner' }],
        entities: [{ id: 'products', scope: 'owner', classification: 'internal' }], requirements: [
          { id: 'form', origin: 'explicit', acceptanceCriteria: ['The synthetic name converts unchanged.'] },
          { id: 'record', origin: 'explicit', acceptanceCriteria: ['The synthetic amount converts to a number.'] },
          { id: 'page', origin: 'explicit', acceptanceCriteria: ['An anonymous principal cannot open the page.'] },
        ], acceptanceTests: [
          { id: 'form-values', requirementId: 'form', criterionIndex: 0, kind: 'form-values', pageId: 'home', sectionId: 'form', input: [{ name: 'name', value: 'Synthetic' }], expected: { outcome: 'accepted', values: { name: 'Synthetic' } } },
          { id: 'record-values', requirementId: 'record', criterionIndex: 0, kind: 'record-values', pageId: 'home', sectionId: 'view', operation: 'update',
            input: [{ name: 'name', value: 'Synthetic' }, { name: 'amount', value: '2' }], expected: { outcome: 'accepted', values: { name: 'Synthetic', amount: 2 } } },
          { id: 'page-policy', requirementId: 'page', criterionIndex: 0, kind: 'page-access', pageId: 'home', principal: { authenticated: false, roleIds: [] }, expected: { accessible: false } },
        ], operations: ['form', 'record', 'page'].map(id => ({ id, summary: `Check ${id}.`, actorIds: ['owner'], entityIds: ['products'], requirementIds: [id], dependsOn: [], execution: 'native', transactional: false })),
        rules: [], tenancy: { mode: 'single' }, integrations: [], privacy: [], decisions: [] } } } };
  const original = JSON.stringify(linked);
  const response = operations => ({ data: { json: { summary: 'Repair application configuration.', warnings: [], operations } }, error: null });
  const safeOperation = { type: 'put_table', table: { ...linkedTable, fields: linkedTable.fields.map(field => ({ ...field, indexed: true })) } };
  globalThis.__aiResponse = response([safeOperation]);
  const safePlan = await planWebsiteApplicationWithAI(linked, 'Index existing fields without changing behavior.');
  const planningInput = JSON.parse(globalThis.__aiBody.messages[1].content);
  assert.deepEqual(planningInput.pageContracts[0].sections[0].applicationFormBinding, linked.pages[0].sections[0].applicationFormBinding);
  assert.deepEqual(planningInput.pageContracts[0].sections[1].applicationDataView, linked.pages[0].sections[1].applicationDataView);
  assert.deepEqual(planningInput.application, linked.application, 'Planning preserves the full schema and acceptance fixtures');
  assert.ok(planningInput.requirementChecks.every(row => row.tests.every(test => test.result === 'passed')));
  assert.match(globalThis.__aiBody.messages[0].content, /Preserve existing native form\/data-view mappings/);
  const visual = structuredClone(linked); visual.pages[0].sections[0].image = 'https://example.test/private-visual-asset';
  visual.pages[0].sections[0].description = 'Unrelated visual copy';
  globalThis.__aiResponse = response([safeOperation]);
  await planWebsiteApplicationWithAI(visual, 'Index fields.');
  assert.ok(!globalThis.__aiBody.messages[1].content.includes('private-visual-asset'));
  assert.ok(!globalThis.__aiBody.messages[1].content.includes('Unrelated visual copy'));
  visual.pages[0].sections[0].formAutomations = [{ enabled: false, webhookUrl: 'synthetic-private-webhook', headers: { authorization: 'synthetic-private-header' } }];
  visual.pages[0].sections[0].formFields[0].placeholder = 'synthetic-private-placeholder';
  visual.pages[0].sections[1].elements.push({ id: 'custom-button', type: 'button', action: 'custom-operation', customOperationId: 'custom-operation',
    customOperationInputJson: '{"api_key":"synthetic-private-input"}', customOperationBindFormValues: false });
  await planWebsiteApplicationWithAI(visual, 'Index fields.');
  const safeContext = globalThis.__aiBody.messages[1].content;
  for (const omitted of ['synthetic-private-webhook', 'synthetic-private-header', 'synthetic-private-placeholder', 'synthetic-private-input']) {
    assert.ok(!safeContext.includes(omitted), 'Planning context excludes automation configuration, presentation text and custom input literals');
  }
  const projected = JSON.parse(safeContext).pageContracts[0];
  assert.equal(projected.sections[0].hasEnabledFormAutomations, false);
  assert.equal(projected.sections[1].customOperations[0].operationId, 'custom-operation');

  for (const oversizedInstruction of ['x'.repeat(4_001)]) {
    globalThis.__aiBody = undefined;
    await assert.rejects(planWebsiteApplicationWithAI(linked, oversizedInstruction), /No request was sent|no request was sent/);
    assert.equal(globalThis.__aiBody, undefined, 'Oversized instructions fail before provider invocation');
  }
  const oversized = { ...project, application: { version: 1, roles: [], pageAccess: [],
    auth: { enabled: false, signUpEnabled: false, emailVerificationRequired: true },
    tables: Array.from({ length: 20 }, (_, index) => ({ id: `table-${index}`, key: `table_${index}`, name: `Synthetic table ${index}`,
      fields: Array.from({ length: 40 }, (_, field) => ({ id: `field-${index}-${field}`, key: `field_${field}`, name: `Synthetic field ${field}`, type: 'text', required: false })),
      permissions: [{ operation: 'read', access: 'public' }],
    })),
  } };
  globalThis.__aiBody = undefined;
  await assert.rejects(planWebsiteApplicationWithAI(oversized, 'Index fields.'), /complete application planning context/);
  assert.equal(globalThis.__aiBody, undefined, 'Oversized projects cannot send a sliced/incomplete schema');
  assert.equal(JSON.stringify(linked), original);
  assert.equal(safePlan.fingerprint, applicationFingerprint(linked));
  assert.equal(JSON.stringify(linked), original, 'Planning preserves the original application and pages');
  const approved = { projectId: linked.cloudProjectId, fingerprint: safePlan.fingerprint, reviewed: true };
  const applied = runEditorCommand(linked, createApplicationCommand(safePlan.operations, approved, 'ai'), { history: createEditorHistory() });
  assert.equal(applied.transaction.ok, true, JSON.stringify(applied.transaction));
  assert.equal(applied.project.application.tables[0].fields[0].indexed, true);
  const undone = undoEditorHistory(applied.project, applied.history);
  assert.deepEqual(undone.value, linked, 'AI schema repair uses the existing full-project undo boundary');
  assert.deepEqual(redoEditorHistory(undone.value, undone.history).value, applied.project);
  for (const operation of [
    { type: 'put_table', table: { ...linkedTable, fields: linkedTable.fields.map(field => field.id === 'product-name' ? { ...field, key: 'renamed_name' } : field) } },
    { type: 'put_table', table: { ...linkedTable, fields: linkedTable.fields.map(field => field.id === 'amount' ? { ...field, type: 'text', defaultValue: '1' } : field) } },
    { type: 'put_table', table: { ...linkedTable, fields: [amount] } },
    { type: 'put_table', table: { ...linkedTable, permissions: linkedTable.permissions.filter(rule => rule.operation !== 'create') } },
    { type: 'set_page_access', rules: [{ pageId: 'home', access: 'public' }] },
  ]) {
    globalThis.__aiResponse = response([safeOperation, operation]);
    await assert.rejects(planWebsiteApplicationWithAI(linked, 'Repair application configuration.'));
    const rejected = runEditorCommand(linked, createApplicationCommand([safeOperation, operation], approved, 'ai'), { history: createEditorHistory() });
    assert.equal(rejected.transaction.ok, false);
    if (operation.type === 'set_page_access' || operation.table?.fields.some(field => field.id === 'amount' && field.type === 'text')
      || !operation.table?.permissions.some(rule => rule.operation === 'create')) {
      assert.match(rejected.transaction.errors.join(' '), /AI application change blocked/, 'Valid schemas still cannot invalidate current bindings or passing evidence');
    }
    assert.deepEqual(rejected.project, linked, 'Failed multi-operation repairs roll back the entire draft');
    assert.equal(rejected.history.past.length, 0);
    assert.equal(JSON.stringify(linked), original);
  }
  for (const mutate of [
    changed => { changed.pages[0].sections[0].formFields[0].name = 'renamed_input'; },
    changed => { changed.pages[0].sections[0].formFields[0].validation = { maxLength: 3 }; },
    changed => { changed.pages[0].sections[0].applicationFormBinding.fields[0].tableFieldId = 'amount'; },
    changed => { changed.pages[0].sections[1].applicationDataView.actions = ['create']; },
  ]) {
    const changed = structuredClone(linked); mutate(changed);
    assert.notEqual(applicationFingerprint(changed), safePlan.fingerprint, 'Native page changes invalidate an outstanding schema approval');
    const stale = runEditorCommand(changed, createApplicationCommand(safePlan.operations, approved, 'ai'), { history: createEditorHistory() });
    assert.equal(stale.transaction.ok, false); assert.match(stale.transaction.errors.join(' '), /Review the plan again/);
    assert.deepEqual(stale.project, changed); assert.equal(stale.history.past.length, 0);
  }
  const cosmetic = structuredClone(linked); cosmetic.pages[0].sections[0].title = 'Improved title'; cosmetic.pages[0].sections[0].background = '#123456';
  assert.equal(applicationFingerprint(cosmetic), safePlan.fingerprint, 'Unrelated visual edits do not invalidate schema review');
  const untested = structuredClone(linked); delete untested.application.requirements.specification.acceptanceTests;
  globalThis.__aiResponse = response([safeOperation]);
  await assert.doesNotReject(planWebsiteApplicationWithAI(untested, 'Index fields.'));
  globalThis.__aiResponse = { data: { content: '{not valid' }, error: null };
  await assert.rejects(planWebsiteApplicationWithAI(project, 'Invalid JSON'));
  console.log('PASS actual application AI planner and command: schema/binding/acceptance safety, atomic multi-operation rollback, stale native-page reviews, complete bounded context with private-value omission, and undo/redo');
} finally { await rm(temp, { recursive: true, force: true }); }
