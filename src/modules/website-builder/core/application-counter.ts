import type { ApplicationTable } from './application-model';
export class ApplicationCounterRejected extends Error {
  constructor() { super('The adjustment exceeds the allowed bounds.'); this.name = 'ApplicationCounterRejected'; }
}
export function parseApplicationCounterDelta(table: ApplicationTable, input: unknown) {
  if (!table.counter || !['string', 'number'].includes(typeof input) || !String(input).trim()) throw new Error('Invalid adjustment.');
  const delta = Number(input);
  if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 1e12 || (table.counter.integer && !Number.isSafeInteger(delta))) throw new Error('Invalid adjustment.');
  return delta;
}
