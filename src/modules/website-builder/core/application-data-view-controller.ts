import { parseApplicationCounterDelta } from './application-counter';
import { parseApplicationTransactionLines } from './application-transaction';
import { applicationWorkflowTransition, availableApplicationWorkflowTransitions } from './application-workflow';
import { readApplicationDefinition } from './application-validation';
import type { ApplicationDefinition } from './application-model';
import { compileApplicationDataView, dataViewAllows, parseApplicationDataViewValues, type ApplicationDataViewBinding } from './application-data-view';
import type { createApplicationDataRuntime } from './application-data-runtime';
import { createDurableApplicationFormSubmission } from './application-form-runtime';

type Runtime = Pick<ReturnType<typeof createApplicationDataRuntime>, 'auth' | 'list' | 'createOnce' | 'update' | 'remove' | 'adjustCounter' | 'createTransaction' | 'transitionWorkflow'> & { files?: ReturnType<typeof createApplicationDataRuntime>['files'] };
const rowId = (id: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('Invalid record identity.');
  return id;
};

/** No persistent row cache. Re-check live identity/roles on every action and after
 * each response; a stale account cannot display data fetched by a previous one. */
export function createApplicationDataViewController(definition: ApplicationDefinition, binding: ApplicationDataViewBinding,
  runtime: Runtime, randomUUID: () => string, durableScope?: {
    keyPrefix: string; storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>; crypto: Pick<Crypto, 'randomUUID' | 'subtle'>;
  }) {
  const app = readApplicationDefinition(definition);
  const compiled = compileApplicationDataView(app, binding);
  let owner: string | undefined, disposed = false, writing = false;
  let pending: { fingerprint: string; requestId: string } | undefined;
  let submission: ReturnType<typeof createDurableApplicationFormSubmission> | undefined;
  async function identity() {
    if (disposed) throw new Error('Data view is closed.');
    const user = await runtime.auth.currentUser();
    if (!user || user.is_anonymous || (owner && owner !== user.id) || disposed) { disposed = true; pending = undefined; throw new Error('Data view identity changed. Reload and sign in.'); }
    owner ??= user.id;
    return user;
  }
  async function permissions() {
    const user = await identity(), roles = await runtime.auth.currentRoles();
    await identity();
    if (!dataViewAllows(compiled.table, 'read', user, roles)) { disposed = true; pending = undefined; throw new Error('Data view access is not permitted.'); }
    return compiled.binding.actions.filter(action => dataViewAllows(compiled.table, action === 'attachments' ? 'read' : action === 'adjust' || action === 'transition' ? 'update' : action === 'transact' ? 'create' : action, user, roles));
  }
  async function fileWritesAllowed() {
    const user = await identity(), roles = await runtime.auth.currentRoles(); await identity();
    return dataViewAllows(compiled.table, 'update', user, roles);
  }
  async function write(action: 'create' | 'update' | 'delete' | 'adjust' | 'transact' | 'transition' | 'attachments', execute: () => Promise<unknown>) {
    if (writing) throw new Error('A record operation is already in progress.');
    writing = true;
    try {
      if (!(await permissions()).includes(action)) throw new Error('Record operation is not permitted.');
      if (action === 'attachments' && !(await fileWritesAllowed())) throw new Error('Attachment writes are not permitted.');
      await execute(); await identity();
    } finally { writing = false; }
  }
  return {
    ...compiled,
    permissions,
    closed() { return disposed; },
    dispose() { disposed = true; pending = undefined; submission?.dispose(); },
    async load(page = 0, query = '') {
      if (!Number.isSafeInteger(page) || page < 0 || page > 100_000 || typeof query !== 'string' || query.length > 200
        || (query && !compiled.search)) throw new Error('Invalid data view query.');
      await permissions();
      const rows = await runtime.list(compiled.table.id, {
        limit: compiled.binding.pageSize + 1, offset: page * compiled.binding.pageSize,
        // Treat SQL wildcard characters as literal search text.
        filters: query && compiled.search ? [{ field: compiled.search.key, operator: 'ilike', value: `%${query.replace(/[\\%_]/g, '\\$&')}%` }] : [],
      }) as unknown;
      await identity();
      if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row) || typeof row.id !== 'string')) throw new Error('Invalid data view response.');
      return { rows: rows.slice(0, compiled.binding.pageSize) as Record<string, unknown>[], hasNext: rows.length > compiled.binding.pageSize };
    },
    async referenceOptions(fieldId: string, page = 0, query = '') {
      if (!Number.isSafeInteger(page) || page < 0 || page > 100_000 || typeof query !== 'string' || query.length > 200) throw new Error('Invalid relationship query.');
      const field = compiled.table.fields.find(field => field.id === fieldId);
      const target = field?.type === 'reference' ? app.tables.find(table => table.id === field.referenceTableId) : undefined;
      if (!target) throw new Error('Unknown relationship.');
      const user = await identity(), roles = await runtime.auth.currentRoles();
      await identity();
      if (!dataViewAllows(target, 'read', user, roles)) throw new Error('Related records are not accessible.');
      const label = target.fields.find(field => field.type === 'text');
      if (query && !label) throw new Error('This relationship has no searchable label.');
      const rows = await runtime.list(target.id, { limit: 21, offset: page * 20,
        sort: label ? { field: label.key, direction: 'asc' } : { field: 'id', direction: 'asc' },
        filters: query && label ? [{ field: label.key, operator: 'ilike', value: `%${query.replace(/[\\%_]/g, '\\$&')}%` }] : [],
      }) as unknown;
      await identity();
      if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row) || typeof row.id !== 'string')) throw new Error('Invalid relationship response.');
      return { options: rows.slice(0, 20).map(row => ({ id: rowId(row.id), label: label && typeof row[label.key] === 'string' && row[label.key] ? row[label.key] as string : row.id as string })), hasNext: rows.length > 20, searchable: !!label };
    },
    workflowTransitions(row: Record<string, unknown>) {
      const field = compiled.table.workflow && compiled.table.fields.find(field => field.id === compiled.table.workflow!.fieldId);
      return field ? availableApplicationWorkflowTransitions(compiled.table, row[field.key]) : [];
    },
    async transactionItemOptions(page = 0, query = '') {
      const rule = compiled.table.transaction;
      if (!rule || !Number.isSafeInteger(page) || page < 0 || page > 100_000 || typeof query !== 'string' || query.length > 200) throw new Error('Invalid transaction item query.');
      const target = app.tables.find(table => table.id === rule.itemTableId)!;
      const user = await identity(), roles = await runtime.auth.currentRoles(); await identity();
      if (!dataViewAllows(target, 'read', user, roles)) throw new Error('Transaction items are not accessible.');
      const label = target.fields.find(field => field.type === 'text');
      if (query && !label) throw new Error('Transaction items have no searchable label.');
      const rows = await runtime.list(target.id, { limit: 21, offset: page * 20,
        sort: label ? { field: label.key, direction: 'asc' } : { field: 'id', direction: 'asc' },
        filters: query && label ? [{ field: label.key, operator: 'ilike', value: `%${query.replace(/[\\%_]/g, '\\$&')}%` }] : [],
      }) as unknown;
      await identity();
      if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row) || typeof row.id !== 'string')) throw new Error('Invalid transaction item response.');
      return { options: rows.slice(0, 20).map(row => ({ id: rowId(row.id), label: label && typeof row[label.key] === 'string' && row[label.key] ? row[label.key] as string : row.id as string })), hasNext: rows.length > 20, searchable: !!label };
    },
    async create(input: Record<string, unknown>) {
      if (writing || disposed) throw new Error('A record operation is unavailable.');
      const values = parseApplicationDataViewValues(compiled.table, input, true);
      const fingerprint = JSON.stringify(values);
      if (!pending || pending.fingerprint !== fingerprint) pending = { fingerprint, requestId: rowId(randomUUID()) };
      const requestId = pending.requestId;
      await write('create', async () => {
        if (!durableScope) return runtime.createOnce(compiled.table.id, values, requestId, owner);
        submission = createDurableApplicationFormSubmission({ tableId: compiled.table.id, values: () => values }, {
          createOnce: (tableId, payload, id) => runtime.createOnce(tableId, payload, id, owner),
        },
          { key: `${durableScope.keyPrefix}:${owner}`, storage: durableScope.storage, crypto: durableScope.crypto });
        if (await submission.submit([]) !== 'confirmed') throw new Error('Application submission outcome is uncertain.');
      });
      pending = undefined;
    },
    async update(id: string, input: Record<string, unknown>) {
      const values = parseApplicationDataViewValues(compiled.table, input, false);
      await write('update', () => runtime.update(compiled.table.id, rowId(id), values, owner));
    },
    async adjust(id: string, input: unknown) {
      const recordId = rowId(id), delta = parseApplicationCounterDelta(compiled.table, input);
      if (!durableScope || !runtime.adjustCounter) throw new Error('Durable adjustment is unavailable.');
      await write('adjust', async () => {
        submission = createDurableApplicationFormSubmission({ tableId: compiled.table.id, values: () => ({ recordId, delta }) }, {
          createOnce: (_tableId, _payload, requestId) => runtime.adjustCounter(compiled.table.id, recordId, delta, requestId, owner!),
        }, { key: `${durableScope.keyPrefix}:adjust:${owner}`, storage: durableScope.storage, crypto: durableScope.crypto });
        if (await submission.submit([]) !== 'confirmed') throw new Error('Counter outcome is uncertain. Keep the adjustment and retry.');
      });
    },
    async transition(id: string, transitionId: string) {
      const recordId = rowId(id);
      applicationWorkflowTransition(compiled.table, transitionId);
      if (!durableScope || !runtime.transitionWorkflow) throw new Error('Durable workflow transition is unavailable.');
      await write('transition', async () => {
        submission = createDurableApplicationFormSubmission({ tableId: compiled.table.id, values: () => ({ recordId, transitionId }) }, {
          createOnce: (_tableId, _payload, requestId) => runtime.transitionWorkflow(compiled.table.id, recordId, transitionId, requestId, owner!),
        }, { key: `${durableScope.keyPrefix}:workflow:${owner}`, storage: durableScope.storage, crypto: durableScope.crypto });
        if (await submission.submit([]) !== 'confirmed') throw new Error('Workflow outcome is uncertain. Keep the action and retry.');
      });
    },
    async transact(input: Record<string, unknown>, lines: unknown) {
      const rule = compiled.table.transaction;
      if (!rule || !durableScope || !runtime.createTransaction) throw new Error('Durable transaction is unavailable.');
      const item = app.tables.find(table => table.id === rule.itemTableId)!;
      const values = parseApplicationDataViewValues(compiled.table, input, true);
      const parsed = parseApplicationTransactionLines(compiled.table, item, lines);
      await write('transact', async () => {
        submission = createDurableApplicationFormSubmission({ tableId: compiled.table.id, values: () => ({ attributes: values, lines: parsed }) }, {
          createOnce: async (_tableId, _payload, requestId) => (await runtime.createTransaction(compiled.table.id, values, parsed, requestId, owner!)).status,
        }, { key: `${durableScope.keyPrefix}:transaction:${owner}`, storage: durableScope.storage, crypto: durableScope.crypto });
        if (await submission.submit([]) !== 'confirmed') throw new Error('Transaction outcome is uncertain. Keep the same transaction and retry.');
      });
    },
    fileWritesAllowed,
    async listFiles(id: string, page = 0) {
      await permissions();
      if (!compiled.binding.actions.includes('attachments') || !runtime.files) throw new Error('Attachments are unavailable.');
      const result = await runtime.files.list(compiled.table.id, rowId(id).toLowerCase(), owner!, page);
      await identity(); return result;
    },
    async downloadFile(id: string, fileId: string) {
      await permissions();
      if (!compiled.binding.actions.includes('attachments') || !runtime.files) throw new Error('Attachments are unavailable.');
      const result = await runtime.files.download(compiled.table.id, rowId(id).toLowerCase(), fileId, owner!);
      await identity(); return result;
    },
    async uploadFile(id: string, fileId: string, file: Blob) {
      await write('attachments', async () => {
        if (!runtime.files) throw new Error('Attachments are unavailable.');
        await runtime.files.upload(compiled.table.id, rowId(id).toLowerCase(), fileId, file, owner!);
      });
    },
    async removeFile(id: string, fileId: string) {
      await write('attachments', async () => {
        if (!runtime.files) throw new Error('Attachments are unavailable.');
        await runtime.files.remove(compiled.table.id, rowId(id).toLowerCase(), fileId, owner!);
      });
    },
    async remove(id: string) { await write('delete', () => runtime.remove(compiled.table.id, rowId(id), owner)); },
  };
}
