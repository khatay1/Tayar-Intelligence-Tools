import type { ApplicationDefinition } from './application-model';
import { applicationInventoryReservationTarget } from './application-inventory-reservation-target';

/** One locked database transaction owns the receipt and both counter legs.
 * Browser request IDs never share the counter's internal debit/credit keys. */
export function compileApplicationStockTransferSchema(input: ApplicationDefinition, tableId: string): string[] {
  const { table, index } = applicationInventoryReservationTarget(input, tableId);
  if (!table.stockLocations) return [];
  const item = table.fields.find(field => field.id === table.stockLocations!.itemFieldId)!;
  const location = table.fields.find(field => field.id === table.stockLocations!.locationFieldId)!;
  const levels = 'public."app_' + table.key + '"';
  const ledger = 'private.app_stock_transfers_' + index;
  const transfer = 'app_stock_transfer_' + index;
  return [
    `create table ${ledger} (actor_id uuid not null,request_id uuid not null,
      source_id uuid not null references ${levels}(id) on delete restrict,
      destination_id uuid not null references ${levels}(id) on delete restrict,
      quantity numeric not null check (quantity > 0 and quantity <= 1000000000000 and quantity = trunc(quantity)),
      check (source_id <> destination_id),primary key(actor_id,request_id));`,
    `alter table ${ledger} enable row level security;`,
    `revoke all on ${ledger} from public,anon,authenticated;`,
    `create function private.${transfer}(source_id uuid, destination_id uuid, request_id uuid, amount numeric) returns text language plpgsql security definer set search_path = '' as $stock_transfer$
declare actor uuid := (select auth.uid()); locked integer; claimed uuid;
  source_row ${levels}%rowtype; destination_row ${levels}%rowtype; prior ${ledger}%rowtype;
begin
  if actor is null or (((select auth.jwt())->>'is_anonymous')::boolean) is true
    or source_id is null or destination_id is null or source_id = destination_id or request_id is null
    or amount is null or amount <> trunc(amount) or amount <= 0 or amount > 1000000000000 then
    raise exception 'Stock transfer unavailable';
  end if;
  perform 1 from ${levels} t where t.owner_id = actor and t.id in (${transfer}.source_id,${transfer}.destination_id)
    order by t.id for update;
  get diagnostics locked = row_count;
  if locked <> 2 then raise exception 'Stock transfer unavailable'; end if;
  select * into strict source_row from ${levels} t where t.id = ${transfer}.source_id and t.owner_id = actor;
  select * into strict destination_row from ${levels} t where t.id = ${transfer}.destination_id and t.owner_id = actor;
  if source_row."${item.key}" <> destination_row."${item.key}"
    or source_row."${location.key}" = destination_row."${location.key}" then
    raise exception 'Stock transfer unavailable';
  end if;
  insert into ${ledger}(actor_id,request_id,source_id,destination_id,quantity)
    values(actor,${transfer}.request_id,${transfer}.source_id,${transfer}.destination_id,amount)
    on conflict on constraint app_stock_transfers_${index}_pkey do nothing returning app_stock_transfers_${index}.request_id into claimed;
  if claimed is null then
    select * into strict prior from ${ledger} r where r.actor_id = actor and r.request_id = ${transfer}.request_id;
    if prior.source_id <> ${transfer}.source_id or prior.destination_id <> ${transfer}.destination_id or prior.quantity <> amount then
      raise exception 'Stock transfer identity mismatch';
    end if;
    return 'already-transferred';
  end if;
  if private.app_adjust_counter_${index}(${transfer}.source_id,-amount,pg_catalog.gen_random_uuid()) is distinct from 'adjusted' then
    raise exception 'Stock transfer counters unavailable';
  end if;
  if private.app_adjust_counter_${index}(${transfer}.destination_id,amount,pg_catalog.gen_random_uuid()) is distinct from 'adjusted' then
    raise exception 'Stock transfer counters unavailable';
  end if;
  return 'transferred';
end $stock_transfer$;`,
    `revoke all on function private.${transfer}(uuid,uuid,uuid,numeric) from public,anon;`,
    `grant execute on function private.${transfer}(uuid,uuid,uuid,numeric) to authenticated;`,
    `create function public.${transfer}(source_id uuid, destination_id uuid, request_id uuid, amount numeric) returns text language sql security invoker set search_path = '' as $stock_transfer$ select private.${transfer}(source_id,destination_id,request_id,amount) $stock_transfer$;`,
    `revoke all on function public.${transfer}(uuid,uuid,uuid,numeric) from public,anon;`,
    `grant execute on function public.${transfer}(uuid,uuid,uuid,numeric) to authenticated;`,
  ];
}
