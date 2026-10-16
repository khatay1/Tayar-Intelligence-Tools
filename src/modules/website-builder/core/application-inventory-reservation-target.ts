import type { ApplicationDefinition } from './application-model';
import { readApplicationDefinition } from './application-validation';

/** Shared stock eligibility check. Kept separate from SQL generation so browser
 * RPC callers do not bundle database installation statements. */
export function applicationInventoryReservationTarget(input: ApplicationDefinition, itemTableId: string) {
  const app = readApplicationDefinition(input);
  const index = app.tables.findIndex(table => table.id === itemTableId);
  const table = app.tables[index];
  const ownerOnly = table && (['read', 'update'] as const).every(operation => {
    const permissions = table.permissions.filter(p => p.operation === operation);
    return permissions.length > 0 && permissions.every(p => p.access === 'owner');
  });
  if (index < 0 || !table?.counter || !table.counter.integer || table.counter.minimum !== 0
    || !app.auth.enabled || !ownerOnly) {
    throw new Error('Owner-scoped integer stock counter required.');
  }
  return { app, index, table };
}
