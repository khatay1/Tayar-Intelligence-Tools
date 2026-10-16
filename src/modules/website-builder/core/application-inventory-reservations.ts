/**
 * Opt-in, pure inventory reservation planning for generated applications.
 *
 * Inventory levels are scoped to one item and one location. The split between
 * stocked, reserved, and incoming quantities follows the MIT-licensed Medusa
 * inventory model (medusajs/medusa, packages/modules/inventory/src/models,
 * reviewed at 906433ac6b1d5ec3cc23f88c8297d29fa87427fd).
 * Copyright (c) 2021 Medusajs. MIT notice must be retained if upstream source
 * is subsequently copied; the implementation below is original Tayar code.
 *
 * This module DOES NOT persist inventory, authorize actors, execute customer
 * actions, or handle concurrent requests. A server transaction must lock the
 * exact (tenant, item, location) row, authorize the actor, atomically persist
 * mutations and unique reservation receipts, and verify all affected rows.
 */

export const INVENTORY_QUANTITY_LIMIT = 1_000_000_000_000;

export interface ApplicationInventoryLevel {
  stocked: number;
  reserved: number;
  incoming: number;
}

export type ApplicationInventoryMovement =
  | { kind: 'reserve' | 'release' | 'fulfill' | 'receive' | 'expect' | 'cancel-incoming'; quantity: number }
  | { kind: 'adjust-stock'; delta: number };

export class ApplicationInventoryRejected extends Error {
  constructor() {
    super('Inventory operation unavailable.');
    this.name = 'ApplicationInventoryRejected';
  }
}

function quantity(value: unknown, allowZero = false): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
    && value >= (allowZero ? 0 : 1) && value <= INVENTORY_QUANTITY_LIMIT;
}

/** Never trust an unsigned client-side balance as authoritative stock. */
export function readApplicationInventoryLevel(value: unknown): ApplicationInventoryLevel {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApplicationInventoryRejected();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !['stocked', 'reserved', 'incoming'].includes(key))
    || !quantity(row.stocked, true) || !quantity(row.reserved, true)
    || !quantity(row.incoming, true) || row.reserved > row.stocked) {
    throw new ApplicationInventoryRejected();
  }
  return { stocked: row.stocked, reserved: row.reserved, incoming: row.incoming };
}

export function availableApplicationInventory(value: unknown): number {
  const level = readApplicationInventoryLevel(value);
  return level.stocked - level.reserved;
}

/**
 * Pure preflight for an already-authorized, locked inventory location.
 * Rejection is atomic at the caller: no mutation or partial result is emitted.
 * Incoming units never count as available until physically received.
 */
export function planApplicationInventoryMovement(
  current: unknown,
  movement: ApplicationInventoryMovement,
): ApplicationInventoryLevel {
  const level = readApplicationInventoryLevel(current);
  if (!movement || typeof movement !== 'object' || Array.isArray(movement)) throw new ApplicationInventoryRejected();
  let next: ApplicationInventoryLevel;
  if (movement.kind === 'adjust-stock') {
    if (Object.keys(movement).some(key => !['kind', 'delta'].includes(key))
      || !Number.isSafeInteger(movement.delta) || movement.delta === 0
      || Math.abs(movement.delta) > INVENTORY_QUANTITY_LIMIT) throw new ApplicationInventoryRejected();
    next = { ...level, stocked: level.stocked + movement.delta };
  } else {
    if (Object.keys(movement).some(key => !['kind', 'quantity'].includes(key))
      || !quantity(movement.quantity)) throw new ApplicationInventoryRejected();
    const value = movement.quantity;
    switch (movement.kind) {
      case 'reserve':
        next = { ...level, reserved: level.reserved + value }; break;
      case 'release':
        next = { ...level, reserved: level.reserved - value }; break;
      case 'fulfill':
        next = { ...level, stocked: level.stocked - value, reserved: level.reserved - value }; break;
      case 'receive':
        // Received inventory must first have been declared incoming.
        next = { ...level, incoming: level.incoming - value, stocked: level.stocked + value }; break;
      case 'expect':
        next = { ...level, incoming: level.incoming + value }; break;
      case 'cancel-incoming':
        next = { ...level, incoming: level.incoming - value }; break;
      default:
        throw new ApplicationInventoryRejected();
    }
  }
  return readApplicationInventoryLevel(next);
}
