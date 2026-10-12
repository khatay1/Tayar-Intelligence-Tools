import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-reference-projects-'));
try {
  const entry = join(dir, 'reference-projects.ts'), outfile = join(dir, 'reference-projects.cjs');
  await writeFile(entry, [
    `export { readApplicationDefinition } from ${JSON.stringify(resolve('src/modules/website-builder/core/application-validation'))};`,
    `export { compileInitialApplicationSchema } from ${JSON.stringify(resolve('src/modules/website-builder/core/application-schema-sql'))};`,
    `export { prepareGeneratedApplication } from ${JSON.stringify(resolve('src/modules/website-builder/core/editor-generated-application'))};`,
    `export { buildApplicationRequirementCoverage } from ${JSON.stringify(resolve('src/modules/website-builder/core/application-requirements'))};`,
  ].join('\n'));
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile, alias: { '@': resolve('src') } });
  const { readApplicationDefinition: validate, compileInitialApplicationSchema: compile,
    prepareGeneratedApplication, buildApplicationRequirementCoverage } = (await import(pathToFileURL(outfile))).default;
  const field = (id, type, required = true, extra = {}) => ({ id, key: id.replaceAll('-', '_'), name: id, type, required, ...extra });
  const permissions = (operations = ['read', 'create', 'update']) => operations.map(operation => ({ operation, access: 'owner' }));
  const table = (id, fields, options = {}) => ({ id, key: id.replaceAll('-', '_'), name: id, fields, permissions: permissions(), ...options });
  const auth = { enabled: true, signUpEnabled: false, emailVerificationRequired: true };
  const roles = [{ id: 'reviewer', name: 'Reviewer' }];
  const app = (...tables) => ({ version: 1, auth, roles, pageAccess: [], tables });

  const products = table('products', [field('sku', 'text', true, { unique: true }), field('quantity', 'number', true, { defaultValue: 0 })],
    { permissions: [{ operation: 'read', access: 'owner' }, { operation: 'update', access: 'owner' }], counter: { fieldId: 'quantity', minimum: 0, integer: true } });
  const retailOrders = table('orders', [field('reference', 'text'), field('note', 'text')], {
    permissions: [{ operation: 'read', access: 'owner' }, { operation: 'create', access: 'owner' }],
    transaction: { itemTableId: 'products', lineTableId: 'order-lines', lineTransactionFieldId: 'line-order', lineItemFieldId: 'line-product', lineQuantityFieldId: 'line-quantity', counterDirection: 'decrement' },
  });
  const retailLines = table('order-lines', [field('line-order', 'reference', true, { referenceTableId: 'orders' }), field('line-product', 'reference', true, { referenceTableId: 'products' }), field('line-quantity', 'number')], { permissions: [{ operation: 'read', access: 'owner' }] });

  const menu = table('menu-items', [field('item-name', 'text'), field('available', 'number', true, { defaultValue: 40 })], {
    permissions: [{ operation: 'read', access: 'owner' }, { operation: 'update', access: 'owner' }],
  });
  const restaurantOrders = table('kitchen-tickets', [field('ticket-number', 'text'), field('state', 'enum', true, { defaultValue: 'queued', options: ['queued', 'cooking', 'ready'] }), field('menu-item', 'reference', true, { referenceTableId: 'menu-items' })], {
    workflow: { fieldId: 'state', transitions: [{ id: 'start-cooking', label: 'Start cooking', from: ['queued'], to: 'cooking', access: 'owner' },
      { id: 'mark-ready', label: 'Mark ready', from: ['cooking'], to: 'ready', access: 'role', roleId: 'reviewer', effects: [{ operation: 'related', referenceFieldId: 'menu-item', fieldId: 'available', change: { operation: 'increment', amount: -1 } }] }] },
  });

  const students = table('students', [field('student-number', 'text', true, { unique: true }), field('display-name', 'text'), field('grade-level', 'enum', true, { defaultValue: 'year-1', options: ['year-1', 'year-2'] })], {
    permissions: [{ operation: 'read', access: 'owner' }, { operation: 'create', access: 'owner' }, { operation: 'update', access: 'role', roleId: 'reviewer' }],
  });
  const assessments = table('assessments', [field('student', 'reference', true, { referenceTableId: 'students' }), field('coursework-score', 'number', true), field('exam-score', 'number', true),
    field('total-score', 'number', true, { formula: { operation: 'sum', fieldIds: ['coursework-score', 'exam-score'] } })]);

  const clinicians = table('clinicians', [field('clinician-name', 'text')], { permissions: [{ operation: 'read', access: 'owner' }] });
  const appointments = table('appointments', [field('patient-reference', 'text'), field('clinician', 'reference', true, { referenceTableId: 'clinicians' }),
    field('starts-at', 'datetime'), field('ends-at', 'datetime'), field('status', 'enum', true, { defaultValue: 'scheduled', options: ['scheduled', 'cancelled'] })], {
    booking: { resourceFieldId: 'clinician', startFieldId: 'starts-at', endFieldId: 'ends-at', statusFieldId: 'status', blockingStatuses: ['scheduled'],
      schedule: { timeZone: 'Europe/Stockholm', weekly: [{ day: 1, startMinute: 540, endMinute: 1020 }], maxDurationMinutes: 240 } },
  });

  const cases = table('permit-cases', [field('case-reference', 'text', true, { unique: true }), field('applicant-label', 'text'),
    field('state', 'enum', true, { defaultValue: 'submitted', options: ['submitted', 'approved', 'rejected'] })], {
    workflow: { fieldId: 'state', transitions: [{ id: 'approve', label: 'Approve', from: ['submitted'], to: 'approved', access: 'role', roleId: 'reviewer' },
      { id: 'reject', label: 'Reject', from: ['submitted'], to: 'rejected', access: 'role', roleId: 'reviewer' }] },
    attachments: { maxBytes: 1048576, mimeTypes: ['application/pdf'] },
  });

  const materials = table('materials', [field('material-code', 'text', true, { unique: true }), field('on-hand', 'number', true, { defaultValue: 0 })], {
    permissions: [{ operation: 'read', access: 'owner' }, { operation: 'update', access: 'owner' }], counter: { fieldId: 'on-hand', minimum: 0, integer: true },
  });
  const workOrders = table('work-orders', [field('batch-reference', 'text'), field('quantity', 'number')], {
    permissions: [{ operation: 'read', access: 'owner' }, { operation: 'create', access: 'owner' }],
    transaction: { itemTableId: 'materials', lineTableId: 'material-issues', lineTransactionFieldId: 'issue-work-order', lineItemFieldId: 'issue-material', lineQuantityFieldId: 'issue-quantity', counterDirection: 'decrement' },
  });
  const issues = table('material-issues', [field('issue-work-order', 'reference', true, { referenceTableId: 'work-orders' }), field('issue-material', 'reference', true, { referenceTableId: 'materials' }), field('issue-quantity', 'number')], { permissions: [{ operation: 'read', access: 'owner' }] });

  const samples = table('research-samples', [field('sample-code', 'text', true, { unique: true }), field('metadata', 'json', false), field('condition', 'enum', true, { defaultValue: 'received', options: ['received', 'analysed', 'archived'] })], {
    workflow: { fieldId: 'condition', transitions: [{ id: 'analyse', label: 'Analyse', from: ['received'], to: 'analysed', access: 'owner' },
      { id: 'archive', label: 'Archive', from: ['analysed'], to: 'archived', access: 'role', roleId: 'reviewer' }] },
  });

  const references = [
    { domain: 'retail', definition: app(products, retailOrders, retailLines), expected: /app_create_transaction_1/, feature: { capability: 'transaction', tableId: 'orders', action: 'transact' } },
    { domain: 'restaurant', definition: app(menu, restaurantOrders), expected: /app_transition_workflow_1/, feature: { capability: 'workflow', tableId: 'kitchen-tickets', action: 'transition' } },
    { domain: 'school', definition: app(students, assessments), expected: /"total_score"/, feature: { capability: 'formula', tableId: 'assessments', action: null } },
    { domain: 'clinic', definition: app(clinicians, appointments), expected: /app_booking/, feature: { capability: 'booking', tableId: 'appointments', action: 'create' } },
    { domain: 'government', definition: app(cases), expected: /app_workflow_guard/, feature: { capability: 'files', tableId: 'permit-cases', action: 'attachments' } },
    { domain: 'factory', definition: app(materials, workOrders, issues), expected: /app_create_transaction_1/, feature: { capability: 'transaction', tableId: 'work-orders', action: 'transact' } },
    { domain: 'custom-research', definition: app(samples), expected: /"metadata" jsonb/, feature: { capability: 'workflow', tableId: 'research-samples', action: 'transition' } },
  ];

  for (const reference of references) {
    assert.doesNotThrow(() => validate(reference.definition), `${reference.domain} definition should satisfy the native application contract`);
    const schema = compile(reference.definition).join('\n');
    assert.match(schema, /enable row level security/, `${reference.domain} tables keep RLS enabled`);
    assert.match(schema, /owner_id = \(select auth\.uid\(\)\)/, `${reference.domain} owner data is isolated`);
    assert.match(schema, reference.expected, `${reference.domain} emits its expected native backend behavior`);

    const table = reference.definition.tables[0];
    const pageId = `${reference.domain}-overview`;
    const featureTable = reference.definition.tables.find(item => item.id === reference.feature.tableId);
    assert.ok(featureTable, `${reference.domain} primary feature table exists`);
    const page = { id: pageId, name: 'Overview', slug: 'overview', sections: reference.definition.tables.map(item => ({
      id: `${reference.domain}-${item.id}-records`, type: 'features', title: item.name,
      applicationDataView: { tableId: item.id, columns: item.fields.map(field => field.id),
        actions: item.transaction ? ['transact'] : item.workflow ? ['transition'] : item.attachments ? ['attachments']
          : item.booking ? ['create'] : [], pageSize: 10 },
    })) };
    const featureAction = reference.feature.action;
    const featureEvidence = reference.feature.capability === 'formula'
      ? `formula:${featureTable.id}` : `${reference.feature.capability}:${featureTable.id}`;
    const requirements = [
      { id: 'account-access', summary: 'Users can securely access their workspace.', capability: 'auth', evidence: ['auth'] },
      { id: 'overview-page', summary: 'Users can open the project overview.', capability: 'page', evidence: ['page:overview'] },
      { id: 'records-view', summary: `Users can read ${reference.domain} records.`, capability: 'records', evidence: [`view:${table.id}:read`] },
      { id: `primary-${reference.feature.capability}`, summary: `Users can use the ${reference.feature.capability} capability in ${reference.domain}.`,
        capability: reference.feature.capability, evidence: [featureEvidence] },
    ];
    const projectSpecification = {
      version: 1, intent: `Create a secure ${reference.domain} application with an overview and owner-scoped records.`,
      actors: [{ id: 'user', name: 'Project user' }],
      entities: reference.definition.tables.map(item => ({ id: item.id, scope: 'owner',
        classification: ['clinic', 'government'].includes(reference.domain) ? 'restricted'
          : reference.domain === 'school' || reference.domain === 'custom-research' ? 'confidential' : 'internal' })),
      requirements: requirements.map(item => ({ id: item.id, origin: 'explicit', acceptanceCriteria: [`${item.summary} The current generated project provides its declared implementation.`] })),
      operations: [
        { id: 'authenticate', summary: 'Authenticate the project user.', actorIds: ['user'], entityIds: [], requirementIds: ['account-access'], dependsOn: [], execution: 'native', transactional: false },
        { id: 'open-overview', summary: 'Open the generated overview page.', actorIds: ['user'], entityIds: [], requirementIds: ['overview-page'], dependsOn: ['authenticate'], execution: 'native', transactional: false },
        { id: 'read-records', summary: `Read owner-scoped ${reference.domain} records.`, actorIds: ['user'], entityIds: [table.id], requirementIds: ['records-view'], dependsOn: ['authenticate', 'open-overview'], execution: 'native', transactional: false },
        { id: `use-primary-${reference.feature.capability}`, summary: `Use the declared ${reference.feature.capability} capability.`, actorIds: ['user'],
          entityIds: [featureTable.id], requirementIds: [`primary-${reference.feature.capability}`], dependsOn: ['authenticate', 'open-overview'],
          execution: 'native', transactional: ['transaction', 'workflow'].includes(reference.feature.capability) },
      ],
      rules: [{ id: 'owner-scoped-records', summary: 'Users can read only records allowed by the declared owner policy.', operationIds: ['read-records'] }],
      tenancy: { mode: 'single' }, integrations: [],
      privacy: reference.definition.tables.filter(() => ['clinic', 'government', 'school', 'custom-research'].includes(reference.domain))
        .map(item => ({ entityId: item.id, purpose: `Operate the ${reference.domain} application.`, retentionDays: 365 })),
      decisions: [],
    };
    const prepared = prepareGeneratedApplication({ projectKind: 'application', application: structuredClone(reference.definition), requirements, projectSpecification }, [page],
      `Create a secure ${reference.domain} application with a project overview and record access.`, new Set(), true);
    assert.doesNotThrow(() => validate(prepared), `${reference.domain} generated application remains valid`);
    const coverage = buildApplicationRequirementCoverage(prepared, [page]);
    assert.equal(coverage.length, requirements.length, `${reference.domain} reports every requirement`);
    assert.ok(coverage.every(row => row.deliveryStatus === 'contract-verified' && row.tests.every(test => test.result === 'passed')),
      `${reference.domain} requirement coverage is current: ${JSON.stringify(coverage)}`);
    const featureCoverage = coverage.find(row => row.requirementId === `primary-${reference.feature.capability}`);
    assert.equal(featureCoverage?.tests[0]?.id, `contract:${featureEvidence}`);
    assert.equal(featureCoverage?.deliveryStatus, 'contract-verified',
      `${reference.domain} primary capability is backed by its compiled data view: ${JSON.stringify(featureCoverage)}`);
    const unboundFeaturePage = structuredClone(page);
    const featureSection = unboundFeaturePage.sections.find(section => section.applicationDataView.tableId === featureTable.id);
    if (featureAction) featureSection.applicationDataView.actions = featureSection.applicationDataView.actions.filter(action => action !== featureAction);
    else featureSection.applicationDataView.columns = featureSection.applicationDataView.columns.filter(id => id !== featureTable.fields.find(field => field.formula)?.id);
    const unboundCoverage = buildApplicationRequirementCoverage(prepared, [unboundFeaturePage]);
    assert.equal(unboundCoverage.find(row => row.requirementId === `primary-${reference.feature.capability}`)?.deliveryStatus, 'blocked',
      `${reference.domain} missing primary feature binding blocks coverage`);
    assert.deepEqual(prepared.requirements.specification, projectSpecification, `${reference.domain} retains its validated project specification`);

    const brokenPage = structuredClone(page);
    brokenPage.sections[0].applicationDataView.tableId = 'missing-table';
    assert.throws(() => prepareGeneratedApplication({ projectKind: 'application', application: structuredClone(reference.definition), requirements, projectSpecification },
      [brokenPage], `Create a secure ${reference.domain} application`, new Set(), true), /data view|table|invalid/i,
    `${reference.domain} rejects an unbound record view before applying the application`);
  }

  const generatedOnly = { ...references[0].definition, tables: references[0].definition.tables.map(item => ({ ...item })) };
  generatedOnly.tables[0].permissions = generatedOnly.tables[0].permissions.filter(rule => rule.operation !== 'update');
  assert.throws(() => validate(generatedOnly), /transaction|counter/i, 'unsafe transaction permissions fail closed');
  const invalidBookingResource = { ...references[3].definition, tables: references[3].definition.tables.map(item => ({ ...item, fields: item.fields.map(field => ({ ...field })) })) };
  invalidBookingResource.tables[1].fields[1].type = 'text';
  assert.throws(() => validate(invalidBookingResource), /booking|resource|reference|field/i, 'invalid clinic booking resources fail closed');
  console.log(`PASS ${references.length} synthetic reference application contracts: retail, restaurant, school, clinic, government, factory, custom research`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
