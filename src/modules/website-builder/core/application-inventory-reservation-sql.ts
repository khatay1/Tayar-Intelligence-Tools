import type { ApplicationDefinition } from './application-model';
import { readApplicationDefinition } from './application-validation';

/**
 * Opt-in inventory reservations on TOP of Tayar's existing counter source of truth.
 * No parallel stock count: the item counter remains authoritative and every
 * existing counter/transaction write is checked against active reservations.
 *
 * Uses the native, owner-scoped single-app backend. Does not support shared
 * organization inventory or per-location stock allocations. The supplied
 * location UUID is an immutable reservation tag, not a per-location balance.
 *
 * This is only a schema compiler/proof until wired through the verified
 * generated application publication and customer runtime path.
 */
export function compileApplicationInventoryReservationSchema(input: ApplicationDefinition, itemTableId: string): string[] {
  const app = readApplicationDefinition(input);
  const index = app.tables.findIndex(table => table.id === itemTableId);
  const table = app.tables[index];
  if (index < 0 || !table?.counter || !table.counter.integer || table.counter.minimum !== 0
    || !app.auth.enabled || !table.permissions.some(p => p.operation === 'read' && p.access === 'owner')
    || !table.permissions.some(p => p.operation === 'update' && p.access === 'owner')) {
    throw new Error('Owner-scoped integer stock counter required.');
  }
  const field = table.fields.find(field => field.id === table.counter!.fieldId)!;
  const product = 'public."app_' + table.key + '"';
  const column = '"' + field.key + '"';
  const ledger = 'private.app_stock_reservations_' + index;
  const reserving = 'app_stock_reserve_' + index;
  const finalizing = 'app_stock_finalize_' + index;
  const floor = 'app_stock_floor_' + index;
  const counter = 'private.app_adjust_counter_' + index;
  const signedIn = "((select auth.uid()) is not null and (((select auth.jwt())->>'is_anonymous')::boolean) is not true)";
  const reserveSql = [
    'create function private.' + reserving + '(item_id uuid, location_id uuid, reservation_id uuid, amount numeric) returns text language plpgsql security definer set search_path = \'\' as $stock_reserve$',
    'declare actor uuid := (select auth.uid()); available numeric; held numeric; prior ' + ledger + '%rowtype;',
    'begin',
    '  if not ' + signedIn + ' or item_id is null or location_id is null or reservation_id is null or amount is null',
    '    or amount <> trunc(amount) or amount <= 0 or amount > 1000000000000 then raise exception \'Stock reservation unavailable\'; end if;',
    '  select p.' + column + ' into available from ' + product + ' p',
    '    where p.id = ' + reserving + '.item_id and p.owner_id = actor for update;',
    '  if not found then raise exception \'Stock reservation unavailable\'; end if;',
    '  select * into prior from ' + ledger + ' r',
    '    where r.actor_id = actor and r.reservation_id = ' + reserving + '.reservation_id for update;',
    '  if found then',
    '    if prior.item_id <> ' + reserving + '.item_id or prior.location_id <> ' + reserving + '.location_id',
    '      or prior.quantity <> amount then raise exception \'Stock reservation identity mismatch\'; end if;',
    "    return 'already-' || prior.status;",
    '  end if;',
    "  select coalesce(sum(r.quantity),0) into held from " + ledger + " r",
    "    where r.actor_id = actor and r.item_id = " + reserving + ".item_id and r.status = 'reserved';",
    '  if available - held < amount then raise exception \'Stock reservation exceeds availability\'; end if;',
    '  insert into ' + ledger + '(actor_id,reservation_id,item_id,location_id,quantity,status)',
    "    values(actor," + reserving + ".reservation_id," + reserving + ".item_id," + reserving + ".location_id,amount,'reserved');",
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
    '  select * into prior from ' + ledger + ' r where r.actor_id = actor and r.reservation_id = ' + finalizing + '.reservation_id for update;',
    "  if not found or prior.item_id <> target then raise exception 'Stock reservation unavailable'; end if;",
    "  if (decision = 'release' and prior.status = 'released') or (decision = 'fulfill' and prior.status = 'fulfilled')", 
    "    then return 'already-' || prior.status; end if;",
    "  if prior.status <> 'reserved' then raise exception 'Stock reservation already settled'; end if;",
    '  update ' + ledger + " r set status = case when decision = 'release' then 'released' else 'fulfilled' end",
    '    where r.actor_id = actor and r.reservation_id = ' + finalizing + '.reservation_id;',
    "  if decision = 'fulfill' then",
    '    perform ' + counter + '(target, -prior.quantity, ' + finalizing + '.reservation_id);',
    '  end if;',
    "  return case when decision = 'release' then 'released' else 'fulfilled' end;",
    'end $stock_finalize$;',
  ].join('\n');
  return [
    'create table ' + ledger + ' (actor_id uuid not null, reservation_id uuid not null,',
    '  item_id uuid not null references ' + product + '(id) on delete restrict, location_id uuid not null,',
    "  quantity numeric not null check (quantity > 0 and quantity <= 1000000000000 and quantity = trunc(quantity)),",
    "  status text not null check (status in ('reserved','released','fulfilled')),",
    '  primary key (actor_id,reservation_id));',
    'alter table ' + ledger + ' enable row level security;',
    'revoke all on ' + ledger + ' from public, anon, authenticated;',
    'create index app_stock_active_' + index + ' on ' + ledger + " (actor_id,item_id) where status = 'reserved';",
    'create function private.' + floor + '() returns trigger language plpgsql security definer set search_path = \'\' as $stock_floor$',
    'begin',
    '  if new.' + column + ' < (select coalesce(sum(r.quantity),0) from ' + ledger,
    "    r where r.actor_id = new.owner_id and r.item_id = new.id and r.status = 'reserved')",
    "    then raise exception 'Stock counter cannot cross reservations'; end if;",
    '  return new;',
    'end $stock_floor$;',
    'create trigger app_stock_reservation_floor_' + index + ' before update on ' + product,
    '  for each row execute function private.' + floor + '();',
    reserveSql,
    finalizeSql,
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
  ];
}
