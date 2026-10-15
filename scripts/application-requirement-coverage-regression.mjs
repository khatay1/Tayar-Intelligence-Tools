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
        { id: 'task-form', origin: 'explicit', acceptanceCriteria: ['A valid owner task is saved.', 'Invalid titles are rejected.'] },
        { id: 'task-page', origin: 'explicit', acceptanceCriteria: ['The tasks page is available after sign-in.'] },
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
  assert.ok(rows.every(row => row.deliveryStatus === 'blocked'), JSON.stringify(rows));
  assert.deepEqual(rows[1].implementation, ['form:tasks', 'operation:op-task-form']);
  assert.deepEqual(rows[1].acceptanceCriteria, ['A valid owner task is saved.', 'Invalid titles are rejected.']);
  assert.equal(rows[1].tests[0].result, 'passed');
  assert.deepEqual(rows[1].tests.slice(1).map(test => [test.id, test.kind, test.result]), [
    ['acceptance:task-form:1', 'acceptance', 'not-run'],
    ['acceptance:task-form:2', 'acceptance', 'not-run'],
  ]);
  assert.match(formatApplicationRequirementCoverage(rows).join('\n'), /Requirement: task-form[\s\S]*Acceptance criteria: A valid owner task is saved\. \| Invalid titles are rejected\.[\s\S]*Implementation: form:tasks[\s\S]*Result: not-run \(acceptance test missing\)[\s\S]*Delivery status: blocked/);
  assert.equal(applicationRequirementIssues(application, pages).length, 3, 'No requirement is deliverable until every acceptance criterion has an executable test');
  const missingPageRows = buildApplicationRequirementCoverage(application, [{ ...pages[0], id: 'other-page' }]);
  assert.equal(missingPageRows.find(row => row.requirementId === 'task-page').deliveryStatus, 'blocked');
  assert.match(applicationRequirementIssues(application, [{ ...pages[0], id: 'other-page' }])[0], /executable tests for every acceptance criterion/);
  const brokenForm = structuredClone(pages);
  brokenForm[0].sections[0].applicationFormBinding.fields[0].tableFieldId = 'missing';
  assert.equal(buildApplicationRequirementCoverage(application, brokenForm).find(row => row.requirementId === 'task-form').tests[0].result, 'failed');
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
