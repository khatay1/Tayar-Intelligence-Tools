import type { ApplicationDefinition } from './application-model';
import { readApplicationDefinition } from './application-validation';
import { compileInitialApplicationSchema } from './application-schema-sql';
import { compileApplicationInventoryReservationSchema } from './application-inventory-reservation-sql';

/**
 * An independent, opt-in SQL package for a NEW isolated customer database.
 *
 * The main generated-app model, migration machinery and embedded runtime are
 * deliberately unchanged. Callers must still provide authenticated customer
 * backend provisioning, install transactionally, verify installed SQL and
 * grants, and independently arrange browser/server actions before advertising
 * stock reservations to end users. This does not migrate a live project.
 */
export function compileInitialApplicationStockReservationPackage(
  input: ApplicationDefinition,
  itemTableId: string,
): string[] {
  const application = readApplicationDefinition(input);
  const installation = compileApplicationInventoryReservationSchema(application, itemTableId);
  const initial = compileInitialApplicationSchema(application);
  return application.tables.find(table => table.id === itemTableId)?.stockReservations
    ? initial : [...initial, ...installation];
}
