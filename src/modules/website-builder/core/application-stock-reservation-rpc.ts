import type { ApplicationDefinition } from './application-model';
import { applicationInventoryReservationTarget } from './application-inventory-reservation-target';

/**
 * Browser-neutral RPC contract for the optional dedicated customer Supabase
 * stock package. This module NEVER constructs a credential, reads OAuth custody
 * or enables a generated application's inventory feature by itself.
 * The caller must supply its pre-existing customer-authenticated Supabase RPC
 * bridge only after separately verifying installation and runtime readiness.
 *
 * Stock belongs to an individual authenticated record owner. Location IDs are
 * reservation labels, NOT separate warehouse allocations. The database's
 * locked reserve/finalize calls, not available(), authorize all changes.
 */
export interface ApplicationStockRpcBridge {
  rpc(name: string, args: Record<string, string | number>): Promise<{
    data: unknown;
    error: unknown;
  }>;
}
export class ApplicationStockRpcRejected extends Error {
  constructor() {
    super('Customer inventory action unavailable.');
    this.name = 'ApplicationStockRpcRejected';
  }
}
export type StockReserveReceipt = 'reserved' | 'already-reserved' | 'already-expired';
export type StockSettlementReceipt = 'released' | 'fulfilled' | 'already-released' | 'already-fulfilled' | 'already-expired';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bound = 1_000_000_000_000;
function identifier(value: unknown): string {
  if (typeof value !== 'string' || !uuid.test(value)) throw new ApplicationStockRpcRejected();
  return value.toLowerCase();
}
function integer(value: unknown, positive: boolean): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)
    || value < (positive ? 1 : 0) || value > bound) throw new ApplicationStockRpcRejected();
  return value;
}

export function createApplicationStockReservationRpc(
  definition: ApplicationDefinition, itemTableId: string, bridge: ApplicationStockRpcBridge,
) {
  if (!bridge || typeof bridge.rpc !== 'function') throw new ApplicationStockRpcRejected();
  let index: number;
  try {
    index = applicationInventoryReservationTarget(definition, itemTableId).index;
  } catch { throw new ApplicationStockRpcRejected(); }
  async function invoke(name: string, args: Record<string, string | number>): Promise<unknown> {
    try {
      const response = await bridge.rpc(name, args);
      if (!response || response.error != null) throw new Error();
      return response.data;
    } catch {
      // Never reveal a customer token, provider output, SQL error or row ID.
      throw new ApplicationStockRpcRejected();
    }
  }
  return Object.freeze({
    async available(itemId: string): Promise<number> {
      const result = await invoke('app_stock_available_' + index, { item_id: identifier(itemId) });
      return integer(result, false);
    },
    async reserve(itemId: string, locationId: string, reservationId: string, quantity: number): Promise<StockReserveReceipt> {
      const result = await invoke('app_stock_reserve_' + index, {
        item_id: identifier(itemId), location_id: identifier(locationId),
        reservation_id: identifier(reservationId), amount: integer(quantity, true),
      });
      if (result !== 'reserved' && result !== 'already-reserved' && result !== 'already-expired')
        throw new ApplicationStockRpcRejected();
      return result;
    },
    async settle(reservationId: string, decision: 'release' | 'fulfill'): Promise<StockSettlementReceipt> {
      if (decision !== 'release' && decision !== 'fulfill') throw new ApplicationStockRpcRejected();
      const result = await invoke('app_stock_finalize_' + index, {
        reservation_id: identifier(reservationId), decision,
      });
      const expected = decision === 'release'
        ? ['released', 'already-released', 'already-expired']
        : ['fulfilled', 'already-fulfilled', 'already-expired'];
      if (!expected.includes(result as string)) throw new ApplicationStockRpcRejected();
      return result as StockSettlementReceipt;
    },
  });
}
