import { parseApplicationCounterDelta } from './application-counter';
import { parseApplicationTransactionLines } from './application-transaction';
import { applicationWorkflowTransition, availableApplicationWorkflowTransitions } from './application-workflow';
import { readApplicationDefinition } from './application-validation';
import type { ApplicationDefinition } from './application-model';
import { compileApplicationDataView, dataViewAllows, parseApplicationDataViewValues, type ApplicationDataViewBinding } from './application-data-view';
import type { createApplicationDataRuntime } from './application-data-runtime';
import { createDurableApplicationFormSubmission } from './application-form-runtime';
import { expandApplicationBookingRecurrence } from './application-booking-recurrence';
import { applicationOrganizationContext, bindApplicationOrganizationInput } from './application-organization-context';

type Runtime = Pick<ReturnType<typeof createApplicationDataRuntime>, 'auth' | 'list' | 'createOnce' | 'update' | 'remove' | 'adjustCounter' | 'createTransaction' | 'transitionWorkflow'> & { stockReservations?: ReturnType<typeof createApplicationDataRuntime>['stockReservations']; bookingAvailable?: ReturnType<typeof createApplicationDataRuntime>['bookingAvailable']; reports?: ReturnType<typeof createApplicationDataRuntime>['reports']; createBookingSeries?: ReturnType<typeof createApplicationDataRuntime>['createBookingSeries']; files?: ReturnType<typeof createApplicationDataRuntime>['files']; payments?: ReturnType<typeof createApplicationDataRuntime>['payments'] };
const rowId = (id: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('Invalid record identity.');
  return id;
};
type StockHold = { version: 1; itemId: string; locationId: string; reservationId: string; quantity: number;
  phase: 'reserve' | 'held' | 'release' | 'fulfill' };
function validStockHold(value: unknown, itemId: string): value is StockHold {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const hold = value as Record<string, unknown>;
  return Object.keys(hold).sort().join(',') === 'itemId,locationId,phase,quantity,reservationId,version'
    && hold.version === 1 && hold.itemId === itemId
    && typeof hold.locationId === 'string' && rowId(hold.locationId) === hold.locationId
    && typeof hold.reservationId === 'string' && rowId(hold.reservationId) === hold.reservationId
    && typeof hold.quantity === 'number' && Number.isSafeInteger(hold.quantity) && hold.quantity > 0 && hold.quantity <= 1_000_000_000_000
    && ['reserve', 'held', 'release', 'fulfill'].includes(String(hold.phase));
}

type StockTransfer = { version: 1; sourceId: string; destinationId: string; requestId: string; quantity: number };
function validStockTransfer(value: unknown, sourceId: string): value is StockTransfer {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const receipt = value as Record<string, unknown>;
  return Object.keys(receipt).sort().join(',') === 'destinationId,quantity,requestId,sourceId,version'
    && receipt.version === 1 && receipt.sourceId === sourceId
    && typeof receipt.destinationId === 'string' && rowId(receipt.destinationId) === receipt.destinationId && receipt.destinationId !== sourceId
    && typeof receipt.requestId === 'string' && rowId(receipt.requestId) === receipt.requestId
    && typeof receipt.quantity === 'number' && Number.isSafeInteger(receipt.quantity) && receipt.quantity > 0 && receipt.quantity <= 1_000_000_000_000;
}

/** No persistent row cache. Re-check live identity/roles on every action and after
 * each response; a stale account cannot display data fetched by a previous one. */
export function createApplicationDataViewController(definition: ApplicationDefinition, binding: ApplicationDataViewBinding,
  runtime: Runtime, randomUUID: () => string, durableScope?: {
    keyPrefix: string; storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>; crypto: Pick<Crypto, 'randomUUID' | 'subtle'>;
    organizationId?: string;
  }) {
  const app = readApplicationDefinition(definition);
  const compiled = compileApplicationDataView(app, binding);
  const organization = applicationOrganizationContext(app, compiled.table, durableScope?.organizationId);
  const organizationFilter = organization ? [{ field: organization.fieldKey, operator: 'eq' as const, value: organization.id }] : [];
  let owner: string | undefined, disposed = false, writing = false;
  let pending: { fingerprint: string; requestId: string } | undefined;
  let submission: ReturnType<typeof createDurableApplicationFormSubmission> | undefined;
  const stockKey = (id: string) => `${durableScope!.keyPrefix}:stock:${owner}:${compiled.table.id}:${rowId(id)}`;
  function readStock(id: string): StockHold | null {
    if (!durableScope || !owner) throw new Error('Stock reservation is unavailable.');
    const stored = durableScope.storage.getItem(stockKey(id));
    if (stored === null) return null;
    let parsed: unknown;
    try { parsed = JSON.parse(stored); } catch { throw new Error('Stock receipt is unavailable.'); }
    if (!validStockHold(parsed, id)) throw new Error('Stock receipt is unavailable.');
    return parsed;
  }
  function saveStock(id: string, hold: StockHold | null) {
    if (!durableScope) throw new Error('Stock reservation is unavailable.');
    if (hold) durableScope.storage.setItem(stockKey(id), JSON.stringify(hold));
    else durableScope.storage.removeItem(stockKey(id));
  }
  const transferKey = (id: string) => `${durableScope!.keyPrefix}:stock-transfer:${owner}:${compiled.table.id}:${rowId(id)}`;
  function readTransfer(id: string): StockTransfer | null {
    if (!durableScope || !owner) throw new Error('Stock transfer is unavailable.');
    const raw = durableScope.storage.getItem(transferKey(id));
    if (raw === null) return null;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new Error('Stock transfer receipt is unavailable.'); }
    if (!validStockTransfer(parsed, id)) throw new Error('Stock transfer receipt is unavailable.');
    return parsed;
  }
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
    return compiled.binding.actions.filter(action => dataViewAllows(compiled.table, action === 'attachments' || action === 'pay' || action === 'refund' || action === 'stock-availability' || action === 'stock-reservation' || action === 'stock-transfer' ? 'read' : action === 'adjust' || action === 'transition' ? 'update' : action === 'transact' ? 'create' : action, user, roles)
      && (action !== 'stock-availability' && action !== 'stock-reservation' && action !== 'stock-transfer' || !!runtime.stockReservations)
      && (action !== 'stock-reservation' && action !== 'stock-transfer' || !!durableScope)
      && (!(action === 'pay' || action === 'refund') || runtime.payments?.available)
      && (action !== 'refund' || !!compiled.table.payment && roles.includes(compiled.table.payment.refundRoleId)));
  }
  async function fileWritesAllowed() {
    const user = await identity(), roles = await runtime.auth.currentRoles(); await identity();
    return dataViewAllows(compiled.table, 'update', user, roles);
  }
  async function write(action: ApplicationDataViewBinding['actions'][number], execute: () => Promise<unknown>) {
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
    async stockTransferState(id: string) {
      if (!(await permissions()).includes('stock-transfer')) throw new Error('Stock transfer is unavailable.');
      return readTransfer(rowId(id));
    },
    async stockTransferOptions(productId: string, locationId: string, page = 0) {
      if (!(await permissions()).includes('stock-transfer') || !compiled.table.stockLocations
        || !Number.isSafeInteger(page) || page < 0 || page > 100_000) throw new Error('Stock transfer is unavailable.');
      const rule = compiled.table.stockLocations;
      const item = compiled.table.fields.find(field => field.id === rule.itemFieldId)!;
      const location = compiled.table.fields.find(field => field.id === rule.locationFieldId)!;
      const text = compiled.table.fields.find(field => field.type === 'text');
      const rows = await runtime.list(compiled.table.id, { limit: 21, offset: page * 20, sort: {field:'id',direction:'asc'}, filters: [
        ...organizationFilter, {field:item.key,operator:'eq',value:rowId(productId)}, {field:location.key,operator:'neq',value:rowId(locationId)},
      ] });
      await identity();
      if (!Array.isArray(rows)) throw new Error('Stock destinations are unavailable.');
      const valid = rows.filter(row => row[item.key] === productId && row[location.key] !== locationId);
      return {hasNext: rows.length > 20, options: valid.slice(0,20).map(row => ({id:rowId(String(row.id)),
        label: `${text ? String(row[text.key] ?? '').slice(0,160) + ' — ' : ''}${String(row[location.key]).slice(0,120)}`}))};
    },
    async stockTransfer(id: string, destinationId: string, quantity: number) {
      const source = rowId(id), destination = rowId(destinationId);
      if (source === destination || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1_000_000_000_000) throw new Error('Invalid stock transfer.');
      let result: 'transferred' | 'already-transferred' | undefined;
      await write('stock-transfer', async () => {
        if (!durableScope || !runtime.stockReservations) throw new Error('Stock transfer is unavailable.');
        let receipt = readTransfer(source);
        if (receipt && (receipt.destinationId !== destination || receipt.quantity !== quantity)) throw new Error('Resolve the existing stock transfer before changing its destination or quantity.');
        if (!receipt) {
          receipt = {version:1,sourceId:source,destinationId:destination,requestId:rowId(randomUUID()),quantity};
          durableScope.storage.setItem(transferKey(source),JSON.stringify(receipt));
        }
        result = await runtime.stockReservations(compiled.table.id,owner!).transfer(source,destination,receipt.requestId,quantity);
        durableScope.storage.removeItem(transferKey(source));
      });
      return result!;
    },
    async stockAvailable(id: string) {
      if (!(await permissions()).includes('stock-availability') || !runtime.stockReservations) throw new Error('Stock availability is unavailable.');
      const result = await runtime.stockReservations(compiled.table.id, owner!).available(rowId(id));
      await identity();
      return result;
    },
    async stockState(id: string) {
      if (!(await permissions()).includes('stock-reservation')) throw new Error('Stock reservation is unavailable.');
      return readStock(rowId(id));
    },
    async stockReserve(id: string, location: string, quantity: number) {
      const item = rowId(id), locationId = rowId(location);
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1_000_000_000_000) throw new Error('Invalid stock quantity.');
      let receipt: 'reserved' | 'already-reserved' | 'already-expired' | undefined;
      await write('stock-reservation', async () => {
        if (!runtime.stockReservations || !durableScope) throw new Error('Stock reservation is unavailable.');
        let hold = readStock(item);
        if (hold && (hold.phase !== 'reserve' || hold.locationId !== locationId || hold.quantity !== quantity))
          throw new Error('Resolve the existing stock receipt before starting a different reservation.');
        if (!hold) {
          hold = { version: 1, itemId: item, locationId, reservationId: rowId(randomUUID()), quantity, phase: 'reserve' };
          saveStock(item, hold); // Persist the idempotency key before the network request.
        }
        receipt = await runtime.stockReservations(compiled.table.id, owner!).reserve(item, locationId, hold.reservationId, quantity);
        if (receipt === 'already-expired') saveStock(item, null);
        else saveStock(item, { ...hold, phase: 'held' });
      });
      return receipt!;
    },
    async stockSettle(id: string, decision: 'release' | 'fulfill') {
      const item = rowId(id);
      if (decision !== 'release' && decision !== 'fulfill') throw new Error('Invalid stock decision.');
      let receipt: 'released' | 'fulfilled' | 'already-released' | 'already-fulfilled' | 'already-expired' | undefined;
      await write('stock-reservation', async () => {
        if (!runtime.stockReservations) throw new Error('Stock settlement is unavailable.');
        const hold = readStock(item);
        if (!hold || (hold.phase !== 'held' && hold.phase !== decision)) throw new Error('Stock receipt must be confirmed before settlement.');
        saveStock(item, { ...hold, phase: decision }); // A lost response must retry the same decision.
        receipt = await runtime.stockReservations(compiled.table.id, owner!).settle(hold.reservationId, decision);
        saveStock(item, null);
      });
      return receipt!;
    },
    async bookingAvailable(values: Record<string, unknown>) {
      if (!(await permissions()).includes('create') || !runtime.bookingAvailable) throw new Error('Booking availability is unavailable.');
      try {
        const result = await runtime.bookingAvailable(compiled.table.id, bindApplicationOrganizationInput(values, organization), owner!);
        await identity(); return result;
      } catch (error) {
        try { await identity(); } catch { /* Close on account changes. */ }
        throw error;
      }
    },
    async reports() {
      await permissions();
      if (!runtime.reports || !compiled.table.reports?.length) throw new Error('Reports are unavailable.');
      try {
      const result = await runtime.reports(compiled.table.id, owner!, organization?.id);
        await identity(); return result;
      } catch (error) {
        // Also close the view when the runtime detects a post-response account
        // switch before it can return the report payload.
        try { await identity(); } catch { /* identity() marks the view closed */ }
        throw error;
      }
    },
    async paymentStatus(id: string) {
      const actions = await permissions();
      if (!actions.some(action => action === 'pay' || action === 'refund') || !runtime.payments) throw new Error('Payment status is unavailable.');
      const status = await runtime.payments.status(compiled.table.id, rowId(id), owner!);
      await identity(); return status;
    },
    async pay(id: string) {
      const recordId = rowId(id);
      let url: string | undefined;
      await write('pay', async () => {
        if (!runtime.payments) throw new Error('Checkout is unavailable.');
        // One checkout identity per frozen order, including other tabs/pages
        // and a cleared browser session. The server owns the reservation.
        url = await runtime.payments.checkout(compiled.table.id, recordId, recordId, owner!);
      });
      return url!;
    },
    async refund(id: string, amount: number) {
      const recordId = rowId(id);
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > 99_999_999_999) throw new Error('Invalid refund amount.');
      await write('refund', async () => {
        if (!durableScope || !runtime.payments) throw new Error('Durable refund is unavailable.');
        submission = createDurableApplicationFormSubmission({ tableId: compiled.table.id, values: () => ({ recordId, amount }) }, {
          createOnce: async (_tableId, _payload, requestId) => {
            await runtime.payments!.refund(compiled.table.id, recordId, requestId, amount, owner!);
            return 'created';
          },
        }, { key: `${durableScope.keyPrefix}:refund:${owner}`, storage: durableScope.storage, crypto: durableScope.crypto });
        if (await submission.submit([]) !== 'confirmed') throw new Error('Refund outcome is uncertain. Retry the same amount.');
      });
    },
    closed() { return disposed; },
    dispose() { disposed = true; pending = undefined; submission?.dispose(); },
    async load(page = 0, query = '', filterValue = '') {
      if (!Number.isSafeInteger(page) || page < 0 || page > 100_000 || typeof query !== 'string' || query.length > 200
        || (query && !compiled.search) || typeof filterValue !== 'string'
        || (filterValue && (!compiled.filter || !compiled.filter.options?.includes(filterValue)))) throw new Error('Invalid data view query.');
      await permissions();
      const rows = await runtime.list(compiled.table.id, {
        limit: compiled.binding.pageSize + 1, offset: page * compiled.binding.pageSize,
        // Treat SQL wildcard characters as literal search text.
        filters: [...organizationFilter,
          ...(filterValue && compiled.filter ? [{ field: compiled.filter.key, operator: 'eq' as const, value: filterValue }] : []),
          ...(query && compiled.search ? [{ field: compiled.search.key, operator: 'ilike' as const, value: `%${query.replace(/[\\%_]/g, '\\$&')}%` }] : [])],
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
      const targetOrganization = applicationOrganizationContext(app, target, durableScope?.organizationId);
      const label = target.fields.find(field => field.type === 'text');
      if (query && !label) throw new Error('This relationship has no searchable label.');
      const rows = await runtime.list(target.id, { limit: 21, offset: page * 20,
        sort: label ? { field: label.key, direction: 'asc' } : { field: 'id', direction: 'asc' },
        filters: [...(targetOrganization ? [{ field: targetOrganization.fieldKey, operator: 'eq' as const, value: targetOrganization.id }] : []),
          ...(query && label ? [{ field: label.key, operator: 'ilike' as const, value: `%${query.replace(/[\\%_]/g, '\\$&')}%` }] : [])],
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
      const targetOrganization = applicationOrganizationContext(app, target, durableScope?.organizationId);
      const user = await identity(), roles = await runtime.auth.currentRoles(); await identity();
      if (!dataViewAllows(target, 'read', user, roles)) throw new Error('Transaction items are not accessible.');
      const label = target.fields.find(field => field.type === 'text');
      if (query && !label) throw new Error('Transaction items have no searchable label.');
      const rows = await runtime.list(target.id, { limit: 21, offset: page * 20,
        sort: label ? { field: label.key, direction: 'asc' } : { field: 'id', direction: 'asc' },
        filters: [...(targetOrganization ? [{ field: targetOrganization.fieldKey, operator: 'eq' as const, value: targetOrganization.id }] : []),
          ...(query && label ? [{ field: label.key, operator: 'ilike' as const, value: `%${query.replace(/[\\%_]/g, '\\$&')}%` }] : [])],
      }) as unknown;
      await identity();
      if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row) || typeof row.id !== 'string')) throw new Error('Invalid transaction item response.');
      return { options: rows.slice(0, 20).map(row => ({ id: rowId(row.id), label: label && typeof row[label.key] === 'string' && row[label.key] ? row[label.key] as string : row.id as string })), hasNext: rows.length > 20, searchable: !!label };
    },
    async create(input: Record<string, unknown>) {
      if (writing || disposed) throw new Error('A record operation is unavailable.');
      const values = parseApplicationDataViewValues(compiled.table, bindApplicationOrganizationInput(input, organization), true);
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
    async recur(input: Record<string, unknown>, repeat: unknown) {
      const values = parseApplicationDataViewValues(compiled.table, bindApplicationOrganizationInput(input, organization), true);
      expandApplicationBookingRecurrence(compiled.table, values, repeat);
      await write('create', async () => {
        if (!durableScope || !runtime.createBookingSeries) throw new Error('Durable booking series is unavailable.');
        submission = createDurableApplicationFormSubmission({ tableId: compiled.table.id, values: () => ({ values, repeat }) }, {
          createOnce: (_table, _payload, requestId) => runtime.createBookingSeries!(compiled.table.id, values, repeat, requestId, owner!),
        }, { key: `${durableScope.keyPrefix}:booking-series:${owner}`, storage: durableScope.storage, crypto: durableScope.crypto });
        if (await submission.submit([]) !== 'confirmed') throw new Error('Booking series outcome is uncertain. Keep the same values and retry.');
      });
    },
    async update(id: string, input: Record<string, unknown>) {
      if (organization && Object.prototype.hasOwnProperty.call(input, organization.fieldKey)) throw new Error('The organization scope cannot be changed.');
      const values = parseApplicationDataViewValues(compiled.table, bindApplicationOrganizationInput(input, organization), false);
      if (organization) delete values[organization.fieldKey];
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
      const values = parseApplicationDataViewValues(compiled.table, bindApplicationOrganizationInput(input, organization), true);
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
