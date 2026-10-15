import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-requirement-coverage-'));
try {
  const outfile = join(dir, 'coverage.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/application-requirements.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { buildApplicationRequirementCoverage, applicationRequirementIssues, formatApplicationRequirementCoverage } = (await import(pathToFileURL(outfile))).default;
  const application = {
    version: 1, roles: [], auth: { enabled: true, signUpEnabled: false, emailVerificationRequired: true }, pageAccess: [],
    tables: [{ id: 'tasks', key: 'tasks', name: 'Tasks', fields: [{ id: 'title', key: 'title', name: 'Title', type: 'text', required: true }],
      permissions: [{ operation: 'read', access: 'owner' }, { operation: 'create', access: 'owner' }] }],
    requirements: { version: 1, request: 'Create protected tasks', items: [
      { id: 'account', summary: 'Authenticate the user.', capability: 'auth', evidence: ['auth'] },
      { id: 'task-form', summary: 'Save an owner task.', capability: 'form', evidence: ['form:tasks'] },
      { id: 'task-page', summary: 'Show the task page.', capability: 'page', evidence: ['page:tasks-page'] },
    ], specification: {
      version: 1, intent: 'A protected task list.', actors: [{ id: 'owner', name: 'Task owner' }],
      entities: [{ id: 'tasks', scope: 'owner', classification: 'internal' }],
      requirements: [
        { id: 'account', origin: 'explicit', acceptanceCriteria: ['A signed-in non-anonymous user is identified.'] },
        { id: 'task-form', origin: 'explicit', acceptanceCriteria: ['A valid task title is converted for submission.', 'Blank task titles are rejected.'] },
        { id: 'task-page', origin: 'explicit', acceptanceCriteria: ['The tasks page is available after sign-in.'] },
      ],
      acceptanceTests: [
        { id: 'valid-task-title', requirementId: 'task-form', criterionIndex: 0, kind: 'form-values', pageId: 'tasks-page', sectionId: 'task-form',
          input: [{ name: 'title', value: 'Draft task' }], expected: { outcome: 'accepted', values: { title: 'Draft task' } } },
        { id: 'blank-task-title', requirementId: 'task-form', criterionIndex: 1, kind: 'form-values', pageId: 'tasks-page', sectionId: 'task-form',
          input: [{ name: 'title', value: '' }], expected: { outcome: 'rejected' } },
      ],
      operations: ['account', 'task-form', 'task-page'].map(id => ({ id: `op-${id}`, summary: `Implements ${id}.`,
        actorIds: ['owner'], entityIds: ['tasks'], requirementIds: [id], dependsOn: [], execution: 'native', transactional: false })),
      rules: [], tenancy: { mode: 'single' }, integrations: [], privacy: [], decisions: [],
    } },
  };
  const pages = [{ id: 'tasks-page', slug: 'tasks', sections: [{ id: 'task-form', type: 'contact',
    formFields: [{ id: 'title-input', name: 'title', label: 'Title', type: 'text', required: true }],
    applicationFormBinding: { operation: 'create', tableId: 'tasks', fields: [{ formFieldId: 'title-input', tableFieldId: 'title' }] } }] }];
  const rows = buildApplicationRequirementCoverage(application, pages);
  assert.equal(rows.length, 3);
  assert.equal(rows[1].deliveryStatus, 'contract-verified', 'The form criterion contract tests execute against the current compiler');
  assert.ok(rows.filter(row => row.requirementId !== 'task-form').every(row => row.deliveryStatus === 'blocked'), JSON.stringify(rows));
  assert.deepEqual(rows[1].implementation, ['form:tasks', 'operation:op-task-form']);
  assert.deepEqual(rows[1].acceptanceCriteria, ['A valid task title is converted for submission.', 'Blank task titles are rejected.']);
  assert.equal(rows[1].tests[0].result, 'passed');
  assert.deepEqual(rows[1].tests.slice(1).map(test => [test.id, test.kind, test.result]), [
    ['acceptance:task-form:1:valid-task-title', 'acceptance', 'passed'],
    ['acceptance:task-form:2:blank-task-title', 'acceptance', 'passed'],
  ]);
  assert.match(rows[1].tests[1].detail, /expected mapped payload/);
  assert.match(rows[1].tests[2].detail, /rejected the invalid input/);
  const report = formatApplicationRequirementCoverage(rows).join('\n');
  assert.match(report, /Requirement: task-form[\s\S]*Acceptance criteria: A valid task title is converted for submission\. \| Blank task titles are rejected\.[\s\S]*Implementation: form:tasks[\s\S]*Tests: contract:form:tasks=passed, acceptance:task-form:1:valid-task-title=passed, acceptance:task-form:2:blank-task-title=passed[\s\S]*Result: passed[\s\S]*Delivery status: contract-verified/);
  assert.ok(!report.includes('Draft task'), 'Coverage reports never expose acceptance fixture values');
  assert.equal(applicationRequirementIssues(application, pages).length, 2, 'Only requirements without criterion tests stay blocked');
  const missingPageRows = buildApplicationRequirementCoverage(application, [{ ...pages[0], id: 'other-page' }]);
  assert.equal(missingPageRows.find(row => row.requirementId === 'task-page').deliveryStatus, 'blocked');
  assert.match(applicationRequirementIssues(application, [{ ...pages[0], id: 'other-page' }])[0], /executable tests for every acceptance criterion/);
  const brokenForm = structuredClone(pages);
  brokenForm[0].sections[0].applicationFormBinding.fields[0].tableFieldId = 'missing';
  const brokenFormRow = buildApplicationRequirementCoverage(application, brokenForm).find(row => row.requirementId === 'task-form');
  assert.equal(brokenFormRow.tests[0].result, 'failed');
  assert.ok(brokenFormRow.tests.slice(1).every(test => test.result === 'failed'), 'A broken test setup cannot satisfy expected rejection cases');
  const wrongExpectedResult = structuredClone(application);
  wrongExpectedResult.requirements.specification.acceptanceTests[0].expected.values.title = 'Wrong title';
  assert.equal(buildApplicationRequirementCoverage(wrongExpectedResult, pages).find(row => row.requirementId === 'task-form').tests[1].result, 'failed');
  assert.deepEqual(buildApplicationRequirementCoverage({ ...application, requirements: undefined }, pages), []);

  const customApplication = structuredClone(application);
  customApplication.requirements.specification.operations = [{ id: 'custom-task', requirementIds: ['task-form'], execution: 'custom' }];
  const customPages = structuredClone(pages);
  customPages[0].sections.push({ id: 'run-task', type: 'features', elements: [{ id: 'run-task-button', type: 'button',
    action: 'custom-operation', customOperationId: 'custom-task', customOperationInputJson: '{"task":"current"}' }] });
  const customCoverage = buildApplicationRequirementCoverage(customApplication, customPages);
  assert.equal(customCoverage.find(row => row.requirementId === 'task-form').deliveryStatus, 'blocked');
  assert.equal(customCoverage.find(row => row.requirementId === 'task-form').tests.at(-2).result, 'passed');
  assert.match(customCoverage.find(row => row.requirementId === 'task-form').tests.at(-1).detail, /inert draft/);
  const formBoundPages = structuredClone(pages);
  formBoundPages[0].sections[0].elements = [{ id: 'run-bound-task', type: 'button', action: 'custom-operation',
    customOperationId: 'custom-task', customOperationInputJson: '{}', customOperationBindFormValues: true }];
  assert.equal(buildApplicationRequirementCoverage(customApplication, formBoundPages)
    .find(row => row.requirementId === 'task-form').tests.at(-2).result, 'passed');
  const misplacedFormBoundPages = structuredClone(customPages);
  misplacedFormBoundPages[0].sections[1].elements[0].customOperationBindFormValues = true;
  assert.equal(buildApplicationRequirementCoverage(customApplication, misplacedFormBoundPages)
    .find(row => row.requirementId === 'task-form').tests.at(-2).result, 'failed');
  const missingCustomAction = buildApplicationRequirementCoverage(customApplication, pages)
    .find(row => row.requirementId === 'task-form');
  assert.equal(missingCustomAction.tests.at(-2).result, 'failed');
  assert.match(missingCustomAction.tests.at(-2).detail, /No valid generated page action/);
  console.log('PASS requirement coverage matrix: implementation, contract test, result and honest delivery status');
} finally {
  await rm(dir, { recursive: true, force: true });
}
