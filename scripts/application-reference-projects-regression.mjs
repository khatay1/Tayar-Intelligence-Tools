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
  ].join('\n'));
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { readApplicationDefinition: validate, compileInitialApplicationSchema: compile } = (await import(pathToFileURL(outfile))).default;
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
    { domain: 'retail', definition: app(products, retailOrders, retailLines), expected: /app_create_transaction_1/ },
    { domain: 'restaurant', definition: app(menu, restaurantOrders), expected: /app_transition_workflow_1/ },
    { domain: 'school', definition: app(students, assessments), expected: /"total_score"/ },
    { domain: 'clinic', definition: app(clinicians, appointments), expected: /app_booking/ },
    { domain: 'government', definition: app(cases), expected: /app_workflow_guard/ },
    { domain: 'factory', definition: app(materials, workOrders, issues), expected: /app_create_transaction_1/ },
    { domain: 'custom-research', definition: app(samples), expected: /"metadata" jsonb/ },
  ];

  for (const reference of references) {
    assert.doesNotThrow(() => validate(reference.definition), `${reference.domain} definition should satisfy the native application contract`);
    const schema = compile(reference.definition).join('\n');
    assert.match(schema, /enable row level security/, `${reference.domain} tables keep RLS enabled`);
    assert.match(schema, /owner_id = \(select auth\.uid\(\)\)/, `${reference.domain} owner data is isolated`);
    assert.match(schema, reference.expected, `${reference.domain} emits its expected native backend behavior`);
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
