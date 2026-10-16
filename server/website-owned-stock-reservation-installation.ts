import type { ApplicationDefinition } from '../src/modules/website-builder/core/application-model';
import { assertInfrastructureConnection, type InfrastructureConnection } from '../src/modules/website-builder/core/application-infrastructure-connections';
import { compileApplicationInventoryReservationSchema } from '../src/modules/website-builder/core/application-inventory-reservation-sql';
import { createOwnedSupabaseReadOnlyQuery } from './website-owned-supabase-catalog';
import { verifyOwnedStockReservationCatalog } from './website-owned-stock-reservation-catalog';
import { createBoundedOwnedStockCatalogFetcher } from './website-owned-stock-reservation-catalog-transport';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const projectRef = /^[a-z]{20}$/;

/**
 * Read-only attestation of an OPTIONAL stock SQL installation already present
 * in the exact customer-owned Supabase project. It never installs SQL, changes
 * stock, invokes a reservation, or asserts that the customer UI can use it.
 *
 * The caller must supply owner-authorized, freshly read server-owned connection
 * metadata and the OAuth token for THAT connection from encrypted custody.
 * A spoofed project snapshot or public/backend URL is not accepted as scope.
 * This is not the main customer application release-readiness gate.
 */
export async function verifyOwnedStockReservationInstallation(input: {
  ownerId: string;
  projectId: string;
  environment: 'preview' | 'production';
  connectionId: string;
  connectionVersion: number;
  itemTableId: string;
  definition: ApplicationDefinition;
  accessToken: string;
  readConnection(): Promise<InfrastructureConnection | null>;
  isCurrent(): Promise<boolean>;
  fetcher?: typeof fetch;
}): Promise<boolean> {
  try {
    if (typeof window !== 'undefined'
      || !uuid.test(input.ownerId) || !uuid.test(input.projectId) || !uuid.test(input.connectionId)
      || !['preview', 'production'].includes(input.environment)
      || !Number.isSafeInteger(input.connectionVersion) || input.connectionVersion < 1
      || typeof input.accessToken !== 'string' || input.accessToken.length < 1 || input.accessToken.length > 4096
      || /[\r\n]/.test(input.accessToken)
      || typeof input.itemTableId !== 'string' || !input.itemTableId
      || !await input.isCurrent()) return false;

    // Validate owner-only integer counter and exact item-table reference before
    // contacting any provider; unsafe definitions fail without network traffic.
    if (!compileApplicationInventoryReservationSchema(input.definition, input.itemTableId).length) return false;
    const first = await input.readConnection();
    if (!first) return false;
    assertInfrastructureConnection(first);
    if (first.id !== input.connectionId || first.version !== input.connectionVersion
      || first.ownerId !== input.ownerId || first.projectId !== input.projectId
      || first.environment !== input.environment || first.provider !== 'supabase'
      || first.status !== 'ready' || first.operationId !== null
      || !first.targetId || !projectRef.test(first.targetId)
      || !first.permissions.includes('database:read')) return false;

    const captured = JSON.stringify(first);
    if (!await input.isCurrent()) return false;
    // This query is intentionally constructed from the server-owned targetId,
    // never from a caller-supplied hostname or editable project configuration.
    const query = createOwnedSupabaseReadOnlyQuery({
      projectRef: first.targetId, accessToken: input.accessToken,
      fetcher: createBoundedOwnedStockCatalogFetcher(input.fetcher),
    });
    if (!await verifyOwnedStockReservationCatalog(input.definition, input.itemTableId, query)) return false;

    const last = await input.readConnection();
    if (!last || !await input.isCurrent()) return false;
    assertInfrastructureConnection(last);
    return JSON.stringify(last) === captured;
  } catch {
    // Fail closed. Do not expose SQL, OAuth errors, provider output or secrets.
    return false;
  }
}
