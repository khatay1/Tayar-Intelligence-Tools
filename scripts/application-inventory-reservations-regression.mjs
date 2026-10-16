import assert from 'node:assert/strict';
import {
  ApplicationInventoryRejected, availableApplicationInventory,
  planApplicationInventoryMovement as plan, readApplicationInventoryLevel as read,
} from '../src/modules/website-builder/core/application-inventory-reservations.ts';

const initial = Object.freeze({ stocked: 10, reserved: 2, incoming: 5 });
assert.equal(availableApplicationInventory(initial), 8);
const reserved = plan(initial, { kind: 'reserve', quantity: 7 });
assert.deepEqual(reserved, { stocked: 10, reserved: 9, incoming: 5 });
assert.deepEqual(initial, { stocked: 10, reserved: 2, incoming: 5 }, 'input is not mutated');
assert.equal(availableApplicationInventory(reserved), 1);
assert.deepEqual(plan(reserved, { kind: 'release', quantity: 4 }), { stocked: 10, reserved: 5, incoming: 5 });
assert.deepEqual(plan(reserved, { kind: 'fulfill', quantity: 9 }), { stocked: 1, reserved: 0, incoming: 5 });
assert.deepEqual(plan(initial, { kind: 'receive', quantity: 4 }), { stocked: 14, reserved: 2, incoming: 1 });
assert.deepEqual(plan(initial, { kind: 'expect', quantity: 4 }), { stocked: 10, reserved: 2, incoming: 9 });
assert.deepEqual(plan(initial, { kind: 'cancel-incoming', quantity: 5 }), { stocked: 10, reserved: 2, incoming: 0 });
assert.deepEqual(plan(initial, { kind: 'adjust-stock', delta: -8 }), { stocked: 2, reserved: 2, incoming: 5 });

for (const m of [
  { kind: 'reserve', quantity: 9 },     // Oversell despite incoming stock.
  { kind: 'release', quantity: 3 },     // Releasing someone else's stock.
  { kind: 'fulfill', quantity: 3 },     // Fulfill must hold a reservation.
  { kind: 'receive', quantity: 6 },     // No invented incoming stock.
  { kind: 'cancel-incoming', quantity: 6 },
  { kind: 'adjust-stock', delta: -9 },  // Cannot remove reserved stock.
  { kind: 'expect', quantity: 1e12 },  // Quantity bound after addition.
  { kind: 'reserve', quantity: 0 }, { kind: 'reserve', quantity: -1 },
  { kind: 'reserve', quantity: 1.5 }, { kind: 'reserve', quantity: Infinity },
  { kind: 'reserve', quantity: NaN }, { kind: 'reserve', quantity: '3' },
  { kind: 'reserve', quantity: 1, extra: 'x' }, { kind: 'unknown', quantity: 1 },
  { kind: 'adjust-stock', delta: 0 }, { kind: 'adjust-stock', delta: '1' },
  { kind: 'adjust-stock', delta: Number.MAX_SAFE_INTEGER },
  null, [], {},
]) assert.throws(() => plan(initial, m), ApplicationInventoryRejected);

for (const bad of [
  null, [], {}, { stocked: -1, reserved: 0, incoming: 0 },
  { stocked: 1, reserved: 2, incoming: 0 },
  { stocked: 1, reserved: 0, incoming: 1.5 },
  { stocked: 1, reserved: 0, incoming: 0, tenantId: 'foreign' },
  { stocked: Number.MAX_SAFE_INTEGER, reserved: 0, incoming: 0 },
  { stocked: 1, reserved: 0, incoming: '0' },
]) assert.throws(() => read(bad), ApplicationInventoryRejected);

// Separate locations remain separate immutable snapshots. Location scoping,
// locking, authorization and idempotent receipts belong to PostgreSQL later.
const locations = new Map([['store', initial], ['warehouse', { stocked: 1, reserved: 0, incoming: 0 }]]);
locations.set('store', plan(locations.get('store'), { kind: 'reserve', quantity: 8 }));
assert.equal(availableApplicationInventory(locations.get('store')), 0);
assert.equal(availableApplicationInventory(locations.get('warehouse')), 1);
assert.deepEqual(plan({ stocked: 1e12, reserved: 0, incoming: 0 }, { kind: 'adjust-stock', delta: -1 }),
  { stocked: 1e12 - 1, reserved: 0, incoming: 0 });
console.log('application inventory reservation pure-domain regressions: passed');
