import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-record-acceptance-'));
try {
  await writeFile(join(dir, 'entry.ts'), ['application-validation', 'project-specification', 'application-requirements', 'application-acceptance-tests']
    .map(name => `export * from ${JSON.stringify(resolve(`src/modules/website-builder/core/${name}`))};`).join('\n'));
  await build({ entryPoints: [join(dir, 'entry.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'test.cjs') });
  const { readApplicationDefinition, projectSpecificationIssues, buildApplicationRequirementCoverage,
    runApplicationAcceptanceTest, formatApplicationRequirementCoverage } = createRequire(import.meta.url)(join(dir, 'test.cjs'));
  const table = { id: 'entries', key: 'entries', name: 'Entries', fields: [
    { id: 'title', key: 'title', name: 'Title', type: 'text', required: true },
    { id: 'amount', key: 'amount', name: 'Amount', type: 'number', required: true, defaultValue: 1 },
    { id: 'quantity', key: 'quantity', name: 'Quantity', type: 'number', required: true },
    { id: 'enabled', key: 'enabled', name: 'Enabled', type: 'boolean', required: true },
    { id: 'date', key: 'due_date', name: 'Due date', type: 'date', required: true },
    { id: 'metadata', key: 'metadata', name: 'Metadata', type: 'json', required: false },
    { id: 'state', key: 'state', name: 'State', type: 'enum', required: true, options: ['open', 'done'], defaultValue: 'open' },
    { id: 'total', key: 'total', name: 'Total', type: 'number', required: true, formula: { operation: 'sum', fieldIds: ['amount', 'quantity'] } },
  ], permissions: ['read', 'create', 'update'].map(operation => ({ operation, access: 'owner' })),
  workflow: { fieldId: 'state', transitions: [{ id: 'finish', label: 'Finish', from: ['open'], to: 'done', access: 'owner' }] } };
  const input = { title: 'Synthetic entry', amount: '2.5', quantity: '2', enabled: 'false', due_date: '2026-10-19', metadata: '{"tag":"fixture"}' };
  const expected = { title: input.title, amount: 2.5, quantity: 2, enabled: false, due_date: input.due_date, metadata: { tag: 'fixture' } };
  const tests = ['create', 'update'].flatMap(operation => [
    { id: `${operation}-values`, operation, input, expected: { outcome: 'accepted', values: expected } },
    { id: `${operation}-required`, operation, input: { ...input, title: '' }, expected: { outcome: 'rejected' } },
    { id: `${operation}-number`, operation, input: { ...input, amount: 'NaN' }, expected: { outcome: 'rejected' } },
    { id: `${operation}-boolean`, operation, input: { ...input, enabled: 'yes' }, expected: { outcome: 'rejected' } },
    { id: `${operation}-date`, operation, input: { ...input, due_date: '2026-02-30' }, expected: { outcome: 'rejected' } },
    { id: `${operation}-json`, operation, input: { ...input, metadata: '{' }, expected: { outcome: 'rejected' } },
    { id: `${operation}-unknown`, operation, input: { ...input, invented: 'value' }, expected: { outcome: 'rejected' } },
    { id: `${operation}-workflow`, operation, input: { ...input, state: 'done' }, expected: { outcome: 'rejected' } },
    { id: `${operation}-formula`, operation, input: { ...input, total: '999' }, expected: { outcome: 'rejected' } },
    { id: `${operation}-default`, operation, input: { ...input, amount: '' }, expected: operation === 'create'
      ? { outcome: 'accepted', values: { title: input.title, quantity: 2, enabled: false, due_date: input.due_date, metadata: { tag: 'fixture' } } }
      : { outcome: 'rejected' } },
  ]).map(test => ({ ...test, requirementId: test.operation, criterionIndex: 0, kind: 'record-values',
    pageId: 'records-page', sectionId: 'records-view', input: Object.entries(test.input).map(([name, value]) => ({ name, value })) }));
  const application = {
    version: 1, roles: [], auth: { enabled: true, signUpEnabled: false, emailVerificationRequired: true }, pageAccess: [], tables: [table],
    requirements: { version: 1, request: 'Validate record input conversion.', items: ['create', 'update'].map(operation => ({
      id: operation, summary: `Validate ${operation} payloads.`, capability: 'records', evidence: [`view:entries:${operation}`],
    })), specification: {
      version: 1, intent: 'Check synthetic record payloads.', actors: [{ id: 'owner', name: 'Owner' }],
      entities: [{ id: table.id, scope: 'owner', classification: 'internal' }],
      requirements: ['create', 'update'].map(id => ({ id, origin: 'explicit', acceptanceCriteria: ['Valid values convert and invalid values are rejected.'] })),
      acceptanceTests: tests,
      operations: ['create', 'update'].map(id => ({ id, summary: `Validate ${id} payloads.`, actorIds: ['owner'], entityIds: [table.id],
        requirementIds: [id], dependsOn: [], execution: 'native', transactional: false })),
      rules: [], tenancy: { mode: 'single' }, integrations: [], privacy: [], decisions: [],
    } },
  };
  const pages = [{ id: 'records-page', slug: 'records', sections: [{ id: 'records-view', type: 'features',
    applicationDataView: { tableId: table.id, columns: ['title', 'amount', 'enabled', 'date'], actions: ['create', 'update'], pageSize: 10 } }] }];
  assert.doesNotThrow(() => readApplicationDefinition(application));
  const rows = buildApplicationRequirementCoverage(application, pages);
  assert.ok(rows.every(row => row.deliveryStatus === 'contract-verified'), JSON.stringify(rows));
  assert.ok(rows.every(row => row.tests.length === 11 && row.tests.every(test => test.result === 'passed')));
  assert.match(rows[0].tests[1].detail, /server authorization, persistence and database effects are not exercised/);
  assert.ok(!formatApplicationRequirementCoverage(rows).join('\n').includes(input.title), 'Reports omit fixture values');
  const specification = application.requirements.specification;
  const first = tests[0];
  const issues = test => projectSpecificationIssues({ ...specification, acceptanceTests: [test] }, application).join('\n');
  for (const operation of ['delete', '', null]) assert.match(issues({ ...first, operation }), /require create or update/);
  assert.match(issues({ ...first, persisted: true }), /Unknown specification property/);
  assert.match(issues({ ...first, input: [...first.input, first.input[0]] }), /unique bounded/);
  assert.match(issues({ ...first, input: [{ name: 'api_key', value: 'synthetic' }] }), /cannot contain credentials/);
  assert.match(issues({ ...first, input: [{ name: 'title', value: 'Bearer fixture' }] }), /cannot contain credentials/);
  assert.match(issues({ ...first, expected: { outcome: 'rejected', values: {} } }), /rejected without values/);
  assert.match(issues({ ...first, expected: { outcome: 'accepted', values: { invented: true } } }), /application schema/);
  const mismatch = structuredClone(application);
  mismatch.requirements.specification.acceptanceTests[0].expected.values.amount = 999;
  assert.equal(buildApplicationRequirementCoverage(mismatch, pages)[0].deliveryStatus, 'blocked');
  const changed = structuredClone(application);
  changed.tables[0].fields.find(field => field.id === 'amount').type = 'text';
  delete changed.tables[0].fields.find(field => field.id === 'total').formula;
  assert.equal(runApplicationAcceptanceTest(changed, pages, first).result, 'failed');
  for (const negative of [first, tests[1]]) {
    for (const modifiedPages of [[], [{ ...pages[0], sections: [] }], [{ ...pages[0], sections: [{ ...pages[0].sections[0],
      applicationDataView: { ...pages[0].sections[0].applicationDataView, actions: ['update'] } }] }],
    [{ ...pages[0], sections: [{ ...pages[0].sections[0], applicationDataView: { ...pages[0].sections[0].applicationDataView, columns: ['missing'] } }] }]]) {
      assert.equal(runApplicationAcceptanceTest(application, modifiedPages, negative).result, 'failed', 'A missing/invalid implementation cannot pass negative fixtures');
    }
  }
  const wrongOperation = structuredClone(application);
  wrongOperation.requirements.specification.acceptanceTests[0].operation = 'update';
  assert.equal(buildApplicationRequirementCoverage(wrongOperation, pages)[0].tests[1].result, 'failed', 'Create/update evidence cannot be relinked');
  for (const [capability, evidence] of [['auth', ['auth']], ['records', ['view:entries:read']], ['formula', ['formula:entries']]]) {
    const unrelated = structuredClone(application);
    unrelated.requirements.items[0] = { ...unrelated.requirements.items[0], capability, evidence };
    assert.ok(buildApplicationRequirementCoverage(unrelated, pages)[0].tests.slice(1).every(test => test.result === 'failed'));
  }
  const other = structuredClone(application);
  const otherTable = { ...structuredClone(table), id: 'other', key: 'other' };
  otherTable.fields.forEach(field => { field.id = `other-${field.id}`; if (field.formula) field.formula.fieldIds = field.formula.fieldIds.map(id => `other-${id}`); });
  otherTable.workflow.fieldId = 'other-state';
  other.tables.push(otherTable);
  other.requirements.specification.entities.push({ id: 'other', scope: 'owner', classification: 'internal' });
  other.requirements.items[0].evidence = ['view:other:create'];
  const otherPages = [...pages, { id: 'other-page', slug: 'other', sections: [{ id: 'other-view', type: 'features',
    applicationDataView: { ...pages[0].sections[0].applicationDataView, tableId: 'other', columns: ['other-title', 'other-amount'] } }] }];
  const otherRow = buildApplicationRequirementCoverage(other, otherPages)[0];
  assert.equal(otherRow.tests[0].result, 'passed');
  assert.ok(otherRow.tests.slice(1).every(test => test.result === 'failed'), 'Record evidence cannot cover another table');
  console.log('PASS record acceptance: current create/update parsing, defaults, typed/unknown/immutable input rejection, stale targets and evidence scope; no database write');
} finally { await rm(dir, { recursive: true, force: true }); }
