import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-booking-acceptance-'));
try {
  const entry = join(dir, 'entry.ts');
  await writeFile(entry, ['application-validation', 'project-specification', 'application-requirements', 'application-acceptance-tests']
    .map(name => `export * from ${JSON.stringify(resolve(`src/modules/website-builder/core/${name}`))};`).join('\n'));
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'test.cjs') });
  const { readApplicationDefinition, projectSpecificationIssues, projectAcceptanceInstant,
    buildApplicationRequirementCoverage, runApplicationAcceptanceTest, formatApplicationRequirementCoverage } = createRequire(import.meta.url)(join(dir, 'test.cjs'));
  const table = { id: 'appointments', key: 'appointments', name: 'Appointments', fields: [
    { id: 'resource', key: 'resource_id', name: 'Resource', type: 'uuid', required: true },
    { id: 'start', key: 'starts_at', name: 'Starts', type: 'datetime', required: true },
    { id: 'end', key: 'ends_at', name: 'Ends', type: 'datetime', required: true },
  ], permissions: ['read', 'create'].map(operation => ({ operation, access: 'owner' })),
  booking: { resourceFieldId: 'resource', startFieldId: 'start', endFieldId: 'end', schedule: {
    timeZone: 'Europe/Stockholm', maxDurationMinutes: 60,
    weekly: [1, 2, 3].map(day => ({ day, startMinute: 540, endMinute: 1020 })),
    exceptions: [{ date: '2026-10-20', windows: [] }, { date: '2026-10-21', windows: [{ startMinute: 720, endMinute: 840 }] }],
  } } };
  const cases = [
    ['working-hours', 0, '2026-10-19T08:00:00.000Z', '2026-10-19T08:30:00.000Z', true],
    ['outside-hours', 0, '2026-10-19T05:00:00.000Z', '2026-10-19T05:30:00.000Z', false],
    ['closing-boundary', 0, '2026-10-19T14:30:00.000Z', '2026-10-19T15:00:00.000Z', true],
    ['too-long', 1, '2026-10-19T08:00:00.000Z', '2026-10-19T09:30:00.000Z', false],
    ['reversed', 1, '2026-10-19T08:30:00.000Z', '2026-10-19T08:00:00.000Z', false],
    ['closed-date', 2, '2026-10-20T08:00:00.000Z', '2026-10-20T08:30:00.000Z', false],
    ['special-hours', 2, '2026-10-21T10:00:00.000Z', '2026-10-21T10:30:00.000Z', true],
    ['replaced-weekly-hours', 2, '2026-10-21T08:00:00.000Z', '2026-10-21T08:30:00.000Z', false],
    ['after-dst-opening', 3, '2026-10-26T08:00:00.000Z', '2026-10-26T08:30:00.000Z', true],
    ['before-dst-adjusted-opening', 3, '2026-10-26T07:00:00.000Z', '2026-10-26T07:30:00.000Z', false],
  ];
  const application = {
    version: 1, roles: [], auth: { enabled: true, signUpEnabled: false, emailVerificationRequired: true }, pageAccess: [], tables: [table],
    requirements: { version: 1, request: 'Check declared booking hours.', items: [
      { id: 'schedule', summary: 'Intervals obey the declared booking schedule.', capability: 'booking', evidence: ['booking:appointments'] },
    ], specification: {
      version: 1, intent: 'Check booking interval policy using synthetic instants.', actors: [{ id: 'owner', name: 'Owner' }],
      entities: [{ id: table.id, scope: 'owner', classification: 'internal' }],
      requirements: [{ id: 'schedule', origin: 'explicit', acceptanceCriteria: [
        'Intervals fit the declared weekly hours.', 'Intervals have a positive duration within the maximum.',
        'Date exceptions replace ordinary weekly hours.', 'Weekly hours use the declared time zone across a DST change.',
      ] }],
      acceptanceTests: cases.map(([id, criterionIndex, startsAt, endsAt, withinSchedule]) => ({
        id, requirementId: 'schedule', criterionIndex, kind: 'booking-schedule', tableId: table.id, startsAt, endsAt, expected: { withinSchedule },
      })),
      operations: [{ id: 'check-schedule', summary: 'Evaluate the declared interval policy.', actorIds: ['owner'], entityIds: [table.id],
        requirementIds: ['schedule'], dependsOn: [], execution: 'native', transactional: false }],
      rules: [], tenancy: { mode: 'single' }, integrations: [], privacy: [], decisions: [],
    } },
  };
  const pages = [{ id: 'appointments-page', slug: 'appointments', sections: [{ id: 'appointments-view', type: 'features',
    applicationDataView: { tableId: table.id, columns: ['resource', 'start', 'end'], actions: ['create'], pageSize: 10 } }] }];
  assert.doesNotThrow(() => readApplicationDefinition(application));
  const row = buildApplicationRequirementCoverage(application, pages)[0];
  assert.equal(row.deliveryStatus, 'contract-verified', JSON.stringify(row));
  assert.equal(row.tests.length, cases.length + 1);
  assert.ok(row.tests.every(test => test.result === 'passed'));
  assert.match(row.tests[1].detail, /authorization, resource availability, conflicts and persistence are not exercised/);
  const report = formatApplicationRequirementCoverage([row]).join('\n');
  assert.ok(!report.includes(cases[0][2]), 'Coverage reports omit acceptance fixture values');

  const specification = application.requirements.specification;
  const firstTest = specification.acceptanceTests[0];
  const issues = test => projectSpecificationIssues({ ...specification, acceptanceTests: [test] }, application).join('\n');
  for (const invalid of ['2026-02-30T08:00:00.000Z', '2026-10-19T08:00:00Z', '2026-10-19T08:00:00.000+02:00', 'not-a-date', '', null]) {
    assert.match(issues({ ...firstTest, startsAt: invalid }), /canonical UTC instants/);
    assert.equal(runApplicationAcceptanceTest(application, pages, { ...firstTest, startsAt: invalid, expected: { withinSchedule: false } }).result, 'failed',
      'Malformed fixtures cannot count as a successful negative schedule test');
  }
  assert.equal(projectAcceptanceInstant('1970-01-01T00:00:00.000Z'), 0);
  assert.match(issues({ ...firstTest, tableId: 'missing' }), /valid declared booking schedule/);
  assert.match(issues({ ...firstTest, expected: { withinSchedule: 'true' } }), /must be a boolean/);
  assert.match(issues({ ...firstTest, expected: { withinSchedule: true, persisted: true } }), /Unknown specification property/);
  const wrongExpected = structuredClone(application);
  wrongExpected.requirements.specification.acceptanceTests[0].expected.withinSchedule = false;
  assert.deepEqual(projectSpecificationIssues(wrongExpected.requirements.specification, wrongExpected), []);
  assert.equal(buildApplicationRequirementCoverage(wrongExpected, pages)[0].tests[1].result, 'failed', 'The runner executes the policy rather than trusting expected results');
  for (const schedule of [undefined, { ...table.booking.schedule, timeZone: 'Invalid/Zone' }, { ...table.booking.schedule, maxDurationMinutes: 0 }]) {
    const stale = structuredClone(application);
    stale.tables[0].booking.schedule = schedule;
    assert.ok(projectSpecificationIssues(stale.requirements.specification, stale).some(issue => /valid declared booking schedule/.test(issue)));
    assert.equal(runApplicationAcceptanceTest(stale, pages, { ...firstTest, expected: { withinSchedule: false } }).result, 'failed');
  }
  const changed = structuredClone(application);
  changed.tables[0].booking.schedule.weekly[0].startMinute = 660;
  assert.equal(buildApplicationRequirementCoverage(changed, pages)[0].deliveryStatus, 'blocked', 'Editing the current schedule invalidates stale passing expectations');
  const unrelated = structuredClone(application);
  unrelated.requirements.items[0] = { ...unrelated.requirements.items[0], capability: 'auth', evidence: ['auth'] };
  const unrelatedRow = buildApplicationRequirementCoverage(unrelated, pages)[0];
  assert.equal(unrelatedRow.tests[0].result, 'passed');
  assert.ok(unrelatedRow.tests.slice(1).every(test => test.result === 'failed'), 'Schedule tests cannot prove authentication');
  const otherTarget = structuredClone(application);
  const otherTable = { ...structuredClone(table), id: 'other', key: 'other' };
  otherTable.fields.forEach(field => { field.id = `other-${field.id}`; });
  otherTable.booking = { ...otherTable.booking, resourceFieldId: 'other-resource', startFieldId: 'other-start', endFieldId: 'other-end' };
  otherTarget.tables.push(otherTable);
  otherTarget.requirements.specification.entities.push({ id: 'other', scope: 'owner', classification: 'internal' });
  otherTarget.requirements.items[0].evidence = ['booking:other'];
  assert.doesNotThrow(() => readApplicationDefinition(otherTarget));
  const otherPages = [...pages, { id: 'other-page', slug: 'other', sections: [{ id: 'other-view', type: 'features',
    applicationDataView: { ...pages[0].sections[0].applicationDataView, tableId: 'other', columns: otherTable.fields.map(field => field.id) } }] }];
  const otherRow = buildApplicationRequirementCoverage(otherTarget, otherPages)[0];
  assert.equal(otherRow.tests[0].result, 'passed');
  assert.ok(otherRow.tests.slice(1).every(test => test.result === 'failed'), 'Schedule evidence is bound to the declared booking table');
  console.log('PASS booking schedule acceptance: weekly hours, duration, exceptions, DST, current-target evidence and invalid-fixture rejection; no database write');
} finally {
  await rm(dir, { recursive: true, force: true });
}
