import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-project-specification-'));
try {
  const outfile = join(dir, 'specification.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/project-specification.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { readProjectSpecification, projectSpecificationIssues } = (await import(pathToFileURL(outfile))).default;
  const domains = ['retail', 'restaurant', 'school', 'clinic', 'government', 'factory', 'custom-research'];
  const application = {
    version: 1,
    auth: { enabled: true, signUpEnabled: false, emailVerificationRequired: true },
    roles: [{ id: 'operator', name: 'Operator' }], pageAccess: [],
    tables: domains.map(id => ({ id, key: id.replaceAll('-', '_'), name: id,
      fields: id === 'retail' ? [{ id: 'state', key: 'state', name: 'State', type: 'enum', required: true, options: ['open', 'ready'] }] : [],
      permissions: [{ operation: 'read', access: 'owner' }],
      ...(id === 'retail' ? { workflow: { fieldId: 'state', transitions: [{ id: 'mark-ready', label: 'Mark ready', from: ['open'], to: 'ready', access: 'owner' }] } } : {}) })),
    requirements: { version: 1, request: 'Build seven unrelated operational records.', items: domains.map(id => ({ id: `req-${id}`, summary: `Operate ${id}.`, capability: 'records', evidence: [`view:${id}:read`] })) },
  };
  const specification = {
    version: 1,
    intent: 'A domain-neutral specification linked to the generated schema and manifest.',
    actors: [{ id: 'operator', name: 'Operator', roleId: 'operator' }],
    entities: domains.map(id => ({ id, scope: 'owner', classification: id === 'clinic' || id === 'government' ? 'restricted' : 'internal' })),
    requirements: domains.map(id => ({ id: `req-${id}`, origin: id === 'custom-research' ? 'explicit' : 'inferred', acceptanceCriteria: [
      `The operator can read an authorized ${id} record.`, ...(id === 'retail' ? ['An open retail record can advance to ready.'] : []),
    ] })),
    acceptanceTests: [
      { id: 'reject-blank-record', requirementId: 'req-retail', criterionIndex: 0, kind: 'form-values', pageId: 'retail-page', sectionId: 'retail-form',
        input: [], expected: { outcome: 'rejected' } },
      { id: 'advance-open-record', requirementId: 'req-retail', criterionIndex: 1, kind: 'workflow-transition',
        tableId: 'retail', transitionId: 'mark-ready', fromState: 'open', expected: { outcome: 'available', toState: 'ready' } },
    ],
    operations: domains.map(id => ({ id: `read-${id}`, summary: `Read authorized ${id} records.`, actorIds: ['operator'], entityIds: [id], requirementIds: [`req-${id}`], dependsOn: [], execution: 'native', transactional: false })),
    rules: domains.map(id => ({ id: `owner-${id}`, summary: `Only the record owner or authorized operator can read ${id}.`, operationIds: [`read-${id}`] })),
    tenancy: { mode: 'single' }, integrations: [],
    privacy: ['clinic', 'government'].map(entityId => ({ entityId, purpose: 'Provide the requested service with synthetic test data.', retentionDays: 365 })),
    decisions: [],
  };
  assert.deepEqual(readProjectSpecification(specification, application), specification);
  const issues = value => projectSpecificationIssues(value, application).join('\n');
  assert.match(issues({ ...specification, secret: 'must-not-pass' }), /Unknown specification property/);
  assert.match(issues({ ...specification, entities: specification.entities.filter(entity => entity.id !== 'factory') }), /Every application table needs/);
  assert.match(issues({ ...specification, actors: [...specification.actors, specification.actors[0]] }), /IDs must be valid and unique/);
  assert.match(issues({ ...specification, operations: specification.operations.map((operation, index) => ({ ...operation, dependsOn: index === 0 ? ['read-restaurant'] : index === 1 ? ['read-retail'] : operation.dependsOn })) }), /Cyclic implementation dependencies/);
  const customOperation = { ...specification.operations[0], execution: 'custom', transactional: false, source: 'return { accepted: true };' };
  assert.deepEqual(readProjectSpecification({ ...specification, operations: specification.operations.map((operation, index) => index ? operation : customOperation) }, application).operations[0], customOperation);
  assert.match(issues({ ...specification, operations: specification.operations.map((operation, index) => index ? operation : { ...customOperation, source: '  ' }) }), /64 KiB release artifact limit/);
  assert.match(issues({ ...specification, operations: specification.operations.map((operation, index) => index ? operation : { ...customOperation, transactional: true }) }), /cannot claim database transaction guarantees/);
  assert.match(issues({ ...specification, operations: specification.operations.map((operation, index) => index ? operation : { ...operation, source: 'not-native' }) }), /Native operations cannot carry custom source/);
  assert.match(issues({ ...specification, operations: specification.operations.map((operation, index) => index ? operation : { ...customOperation, source: 'x'.repeat(65 * 1024) }) }), /64 KiB release artifact limit/);
  assert.match(issues({ ...specification, tenancy: { mode: 'branches', organizationEntityId: 'retail', branchEntityId: 'restaurant' } }), /executable membership policies/);
  assert.match(issues({ ...specification, privacy: specification.privacy.filter(entry => entry.entityId !== 'clinic') }), /Sensitive entities need explicit privacy planning/);
  assert.match(issues({ ...specification, decisions: [{ id: 'conflict-1', kind: 'conflict', summary: 'Two required policies disagree.', operationIds: [], blocking: false }] }), /Unresolved project requirement/);
  assert.match(issues({ ...specification, integrations: [{ id: 'erp', purpose: 'Synchronize approved records.', operationIds: ['read-retail'], scopes: [], activation: 'deferred' }] }), /permission scopes/);
  assert.match(issues({ ...specification, requirements: specification.requirements.map((requirement, index) => index ? requirement : { ...requirement, acceptanceCriteria: [] }) }), /observable acceptance criteria/);
  assert.match(issues({ ...specification, acceptanceTests: [{ ...specification.acceptanceTests[0], criterionIndex: 3 }] }), /existing acceptance criterion index/);
  assert.match(issues({ ...specification, acceptanceTests: [{ ...specification.acceptanceTests[0], input: [{ name: 'password', value: 'fixture-secret' }] }] }), /cannot contain credentials or secret-like values/);
  assert.match(issues({ ...specification, acceptanceTests: [{ ...specification.acceptanceTests[1], tableId: 'missing' }] }), /existing table and declared transition/);
  assert.match(issues({ ...specification, acceptanceTests: [{ ...specification.acceptanceTests[1], fromState: 'closed' }] }), /declared value of the workflow enum field/);
  assert.match(issues({ ...specification, acceptanceTests: [{ ...specification.acceptanceTests[1], expected: { outcome: 'available', toState: 'closed' } }] }), /match the declared transition/);
  assert.match(issues({ ...specification, acceptanceTests: [{ ...specification.acceptanceTests[1], expected: { outcome: 'rejected' } }] }), /outside the transition source/);
  console.log('Project specification regression passed.');
} finally {
  await rm(dir, { recursive: true, force: true });
}
