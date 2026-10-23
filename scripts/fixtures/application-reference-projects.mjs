export const createApplicationReferenceProjects = () => {
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

  // Broker-owned property catalog, buyer inquiries and computed commission receipts.
  const properties = table('properties', [
    field('listing-reference', 'text', true, { unique: true }),
    field('headline', 'text'),
    field('city', 'text'),
    field('asking-price', 'number'),
    field('listing-status', 'enum', true, { defaultValue: 'draft', options: ['draft', 'listed', 'under-offer', 'sold'] }),
  ], {
    workflow: { fieldId: 'listing-status', transitions: [
      { id: 'publish', label: 'Publish listing', from: ['draft'], to: 'listed', access: 'owner' },
      { id: 'accept-offer', label: 'Accept offer', from: ['listed'], to: 'under-offer', access: 'owner' },
      { id: 'mark-sold', label: 'Mark sold', from: ['under-offer'], to: 'sold', access: 'owner' },
    ] },
  });
  const buyerInquiries = table('buyer-inquiries', [
    field('inquiry-property', 'reference', true, { key: 'property', referenceTableId: 'properties' }),
    field('buyer-email', 'text'),
    field('message', 'text', false),
    field('inquiry-status', 'enum', true, { defaultValue: 'new', options: ['new', 'contacted', 'closed'] }),
  ]);
  const brokerageDeals = table('brokerage-deals', [
    field('deal-property', 'reference', true, { key: 'property', referenceTableId: 'properties' }),
    field('sale-price', 'number'),
    field('commission-rate', 'number'),
    field('commission-amount', 'number', true, { formula: { operation: 'multiply', fieldIds: ['sale-price', 'commission-rate'] } }),
  ]);

  const references = [
    { domain: 'retail', definition: app(products, retailOrders, retailLines), expected: /app_create_transaction_1/, feature: { capability: 'transaction', tableId: 'orders', action: 'transact' } },
    { domain: 'restaurant', definition: app(menu, restaurantOrders), expected: /app_transition_workflow_1/, feature: { capability: 'workflow', tableId: 'kitchen-tickets', action: 'transition' } },
    { domain: 'school', definition: app(students, assessments), expected: /"total_score"/, feature: { capability: 'formula', tableId: 'assessments', action: null } },
    { domain: 'clinic', definition: app(clinicians, appointments), expected: /app_booking/, feature: { capability: 'booking', tableId: 'appointments', action: 'create' } },
    { domain: 'government', definition: app(cases), expected: /app_workflow_guard/, feature: { capability: 'workflow', tableId: 'permit-cases', action: 'transition' } },
    { domain: 'factory', definition: app(materials, workOrders, issues), expected: /app_create_transaction_1/, feature: { capability: 'transaction', tableId: 'work-orders', action: 'transact' } },
    { domain: 'custom-research', definition: app(samples), expected: /"metadata" jsonb/, feature: { capability: 'workflow', tableId: 'research-samples', action: 'transition' } },
    { domain: 'real-estate', definition: app(properties, buyerInquiries, brokerageDeals), expected: /app_workflow_guard/,
      feature: { capability: 'workflow', tableId: 'properties', action: 'transition' } },
  ];
  return references;
};
