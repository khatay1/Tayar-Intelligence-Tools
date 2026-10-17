import type { ApplicationDefinition } from './application-model';
import { compileApplicationStockLocationsSchema } from './application-stock-locations-sql';
import { applicationInventoryReservationTarget } from './application-inventory-reservation-target';

/**
 * Opt-in inventory reservations on TOP of Tayar's existing counter source of truth.
 * No parallel stock count: the item counter remains authoritative and every
 * existing counter/transaction write is checked against active reservations.
 * Reservations expire after a server-owned 15-minute TTL; expiry is applied
 * lazily while holding the item lock, without requiring pg_cron to free stock.
 * Receipts remain immutable and do not renew when a request ID is replayed.
 *
 * Uses the native owner-scoped single-app backend. Without stockLocations the
 * supplied location UUID is an immutable tag. With stockLocations, the existing
 * counter belongs to one immutable item/warehouse level and reserve requires
 * that exact warehouse. Shared organization inventory and transfers are absent.
 */
export function compileApplicationInventoryReservationSchema(input: ApplicationDefinition, itemTableId: string): string[] {
  const { app, index, table } = applicationInventoryReservationTarget(input, itemTableId);
  const field = table.fields.find(field => field.id === table.counter!.fieldId)!;
  const product = 'public."app_' + table.key + '"';
  const column = '"' + field.key + '"';
  const ledger = 'private.app_stock_reservations_' + index;
  const reserving = 'app_stock_reserve_' + index;
  const finalizing = 'app_stock_finalize_' + index;
  const checking = 'app_stock_available_' + index;
  const floor = 'app_stock_floor_' + index;
  const counter = 'private.app_adjust_counter_' + index;
  const locationColumn = table.stockLocations ? table.fields.find(field => field.id === table.stockLocations!.locationFieldId)!.key : null;
  const signedIn = "((select auth.uid()) is not null and (((select auth.jwt())->>'is_anonymous')::boolean) is not true)";
  const reserveSql = [
    'create function private.' + reserving + '(item_id uuid, location_id uuid, reservation_id uuid, amount numeric) returns text language plpgsql security definer set search_path = \'\' as $stock_reserve$',
    'declare actor uuid := (select auth.uid()); available numeric; held numeric; prior ' + ledger + '%rowtype;',
    'begin',
    '  if not ' + signedIn + ' or item_id is null or location_id is null or reservation_id is null or amount is null',
    '    or amount <> trunc(amount) or amount <= 0 or amount > 1000000000000 then raise exception \'Stock reservation unavailable\'; end if;',
    '  select p.' + column + ' into available from ' + product + ' p',
    '    where p.id = ' + reserving + '.item_id and p.owner_id = actor'
      + (locationColumn ? ' and p."' + locationColumn + '" = ' + reserving + '.location_id' : '') + ' for update;',
    '  if not found then raise exception \'Stock reservation unavailable\'; end if;',
    // The product lock makes expiry and reallocation atomic with every
    // competing reserve/finalize operation for this owner/item.
    '  update ' + ledger + " r set status = 'expired'",
    '    where r.actor_id = actor and r.item_id = ' + reserving + '.item_id',
    "      and r.status = 'reserved' and r.expires_at <= statement_timestamp();",
    '  select * into prior from ' + ledger + ' r',
    '    where r.actor_id = actor and r.reservation_id = ' + reserving + '.reservation_id for update;',
    '  if found then',
    '    if prior.item_id <> ' + reserving + '.item_id or prior.location_id <> ' + reserving + '.location_id',
    '      or prior.quantity <> amount then raise exception \'Stock reservation identity mismatch\'; end if;',
    "    return 'already-' || prior.status;",
    '  end if;',
    "  select coalesce(sum(r.quantity),0) into held from " + ledger + " r",
    "    where r.actor_id = actor and r.item_id = " + reserving + ".item_id and r.status = 'reserved'",
    '      and r.expires_at > statement_timestamp();',
    '  if available - held < amount then raise exception \'Stock reservation exceeds availability\'; end if;',
    '  insert into ' + ledger + '(actor_id,reservation_id,item_id,location_id,quantity,status,expires_at)',
    "    values(actor," + reserving + ".reservation_id," + reserving + ".item_id," + reserving + ".location_id,amount,'reserved',",
    "      statement_timestamp() + interval '15 minutes');",
    "  return 'reserved';",
    'end $stock_reserve$;',
  ].join('\n');
  const finalizeSql = [
    'create function private.' + finalizing + '(reservation_id uuid, decision text) returns text language plpgsql security definer set search_path = \'\' as $stock_finalize$',
    'declare actor uuid := (select auth.uid()); target uuid; prior ' + ledger + '%rowtype;',
    'begin',
    "  if not " + signedIn + " or reservation_id is null or decision not in ('release','fulfill') or decision is null",
    "    then raise exception 'Stock reservation unavailable'; end if;",
    '  select r.item_id into target from ' + ledger + ' r where r.actor_id = actor and r.reservation_id = ' + finalizing + '.reservation_id;',
    "  if not found then raise exception 'Stock reservation unavailable'; end if;",
    '  perform 1 from ' + product + ' p where p.id = target and p.owner_id = actor for update;',
    "  if not found then raise exception 'Stock reservation unavailable'; end if;",
    '  update ' + ledger + " r set status = 'expired'",
    "    where r.actor_id = actor and r.item_id = target and r.status = 'reserved'",
    '      and r.expires_at <= statement_timestamp();',
    '  select * into prior from ' + ledger + ' r where r.actor_id = actor and r.reservation_id = ' + finalizing + '.reservation_id for update;',
    "  if not found or prior.item_id <> target then raise exception 'Stock reservation unavailable'; end if;",
    "  if (decision = 'release' and prior.status = 'released') or (decision = 'fulfill' and prior.status = 'fulfilled')", 
    "    then return 'already-' || prior.status; end if;",
    "  if prior.status = 'expired' then return 'already-expired'; end if;",
    "  if prior.status <> 'reserved' then raise exception 'Stock reservation already settled'; end if;",
    '  update ' + ledger + " r set status = case when decision = 'release' then 'released' else 'fulfilled' end",
    '    where r.actor_id = actor and r.reservation_id = ' + finalizing + '.reservation_id;',
    "  if decision = 'fulfill' then",
    // The stock receipt is client-chosen and may already name an ordinary
    // counter request. Only the locked terminal stock status provides replay
    // protection here; every first fulfillment needs a fresh internal debit.
    '    if ' + counter + "(target, -prior.quantity, pg_catalog.gen_random_uuid()) is distinct from 'adjusted' then",
    "      raise exception 'Stock fulfillment debit unavailable';",
    '    end if;',
    '  end if;',
    "  return case when decision = 'release' then 'released' else 'fulfilled' end;",
    'end $stock_finalize$;',
  ].join('\n');
  // Owner-only availability is a hint; locked reservation is authoritative.
  const availabilitySql = [
    'create function private.' + checking + '(item_id uuid) returns numeric language plpgsql security definer set search_path = \'\' as $stock_available$',
    'declare actor uuid := (select auth.uid()); available numeric;',
    'begin',
    '  if not ' + signedIn + ' or item_id is null then raise exception \'Stock availability unavailable\'; end if;',
    '  select p.' + column + ' - coalesce((select sum(r.quantity) from ' + ledger + ' r',
    "    where r.actor_id = actor and r.item_id = p.id and r.status = 'reserved'",
    '      and r.expires_at > statement_timestamp()),0) into available',
    '    from ' + product + ' p where p.id = ' + checking + '.item_id and p.owner_id = actor;',
    '  if not found then raise exception \'Stock availability unavailable\'; end if;',
    '  return available;',
    'end $stock_available$;',
  ].join('\n');
  return [
    ...compileApplicationStockLocationsSchema(app, itemTableId),
    'create table ' + ledger + ' (actor_id uuid not null, reservation_id uuid not null,',
    '  item_id uuid not null references ' + product + '(id) on delete restrict, location_id uuid not null,',
    "  quantity numeric not null check (quantity > 0 and quantity <= 1000000000000 and quantity = trunc(quantity)),",
    "  status text not null check (status in ('reserved','released','fulfilled','expired')),",
    '  expires_at timestamptz not null,',
    '  primary key (actor_id,reservation_id));',
    'alter table ' + ledger + ' enable row level security;',
    'revoke all on ' + ledger + ' from public, anon, authenticated;',
    'create index app_stock_active_' + index + ' on ' + ledger + " (actor_id,item_id) where status = 'reserved';",
    'create function private.' + floor + '() returns trigger language plpgsql security definer set search_path = \'\' as $stock_floor$',
    'begin',
    '  if new.' + column + ' < (select coalesce(sum(r.quantity),0) from ' + ledger,
    "    r where r.actor_id = new.owner_id and r.item_id = new.id and r.status = 'reserved'",
    '      and r.expires_at > statement_timestamp())',
    "    then raise exception 'Stock counter cannot cross reservations'; end if;",
    '  return new;',
    'end $stock_floor$;',
    'revoke all on function private.' + floor + '() from public,anon,authenticated;',
    'create trigger app_stock_reservation_floor_' + index + ' before update on ' + product,
    '  for each row execute function private.' + floor + '();',
    reserveSql,
    finalizeSql,
    availabilitySql,
    'revoke all on function private.' + reserving + '(uuid,uuid,uuid,numeric) from public,anon;',
    'grant execute on function private.' + reserving + '(uuid,uuid,uuid,numeric) to authenticated;',
    'revoke all on function private.' + finalizing + '(uuid,text) from public,anon;',
    'grant execute on function private.' + finalizing + '(uuid,text) to authenticated;',
    'create function public.' + reserving + '(item_id uuid, location_id uuid, reservation_id uuid, amount numeric) returns text language sql security invoker set search_path = \'\' as $stock_public$ select private.' + reserving + '(item_id,location_id,reservation_id,amount) $stock_public$;',
    'create function public.' + finalizing + '(reservation_id uuid, decision text) returns text language sql security invoker set search_path = \'\' as $stock_public$ select private.' + finalizing + '(reservation_id,decision) $stock_public$;',
    'revoke all on function public.' + reserving + '(uuid,uuid,uuid,numeric) from public,anon;',
    'revoke all on function public.' + finalizing + '(uuid,text) from public,anon;',
    'grant execute on function public.' + reserving + '(uuid,uuid,uuid,numeric) to authenticated;',
    'grant execute on function public.' + finalizing + '(uuid,text) to authenticated;',
    'revoke all on function private.' + checking + '(uuid) from public,anon;',
    'grant execute on function private.' + checking + '(uuid) to authenticated;',
    'create function public.' + checking + '(item_id uuid) returns numeric language sql security invoker set search_path = \'\' as $stock_public$ select private.' + checking + '(item_id) $stock_public$;',
    'revoke all on function public.' + checking + '(uuid) from public,anon;',
    'grant execute on function public.' + checking + '(uuid) to authenticated;'
  ];
}
