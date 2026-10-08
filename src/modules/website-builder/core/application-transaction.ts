import type { ApplicationTable } from './application-model';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class ApplicationTransactionRejected extends Error {
  constructor(public readonly reason: 'bounds' | 'unavailable') {
    super(reason === 'bounds' ? 'A transaction item exceeds its allowed bounds.' : 'The transaction is unavailable.');
    this.name = 'ApplicationTransactionRejected';
  }
}

export interface ApplicationTransactionLine { itemId: string; quantity: number }

export function parseApplicationTransactionLines(table: ApplicationTable, itemTable: ApplicationTable, input: unknown): ApplicationTransactionLine[] {
  if (!table.transaction || !itemTable.counter || table.transaction.itemTableId !== itemTable.id || !Array.isArray(input) || input.length < 1 || input.length > 100) {
    throw new Error('Invalid transaction items.');
  }
  const counter = itemTable.counter;
  const seen = new Set<string>();
  return input.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['itemId', 'quantity'].includes(key))) throw new Error('Invalid transaction item.');
    const row = value as Record<string, unknown>, itemId = typeof row.itemId === 'string' ? row.itemId.toLowerCase() : '';
    const quantity = typeof row.quantity === 'number' ? row.quantity : Number(row.quantity);
    if (!uuid.test(itemId) || seen.has(itemId) || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1e12
      || (counter.integer && !Number.isSafeInteger(quantity))) throw new Error('Invalid transaction item.');
    seen.add(itemId);
    return { itemId, quantity };
  });
}
