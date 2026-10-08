import type { ApplicationDefinition } from './application-model';
import { compileApplicationDataView, dataViewAllows, parseApplicationDataViewValues, type ApplicationDataViewBinding } from './application-data-view';
import type { createApplicationDataRuntime } from './application-data-runtime';
import { createDurableApplicationFormSubmission } from './application-form-runtime';

type Runtime = Pick<ReturnType<typeof createApplicationDataRuntime>, 'auth' | 'list' | 'createOnce' | 'update' | 'remove'>;
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
  const compiled = compileApplicationDataView(definition, binding);
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
    return compiled.binding.actions.filter(action => dataViewAllows(compiled.table, action, user, roles));
  }
  async function write(action: 'create' | 'update' | 'delete', execute: () => Promise<unknown>) {
    if (writing) throw new Error('A record operation is already in progress.');
    writing = true;
    try {
      if (!(await permissions()).includes(action)) throw new Error('Record operation is not permitted.');
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
    async remove(id: string) { await write('delete', () => runtime.remove(compiled.table.id, rowId(id), owner)); },
  };
}
