import type { ApplicationDefinition } from './application-model';
import { applicationInventoryReservationTarget } from './application-inventory-reservation-target';

/** Initial installation only. Stock is the existing level-row counter, never a
 * second item total. Immutable dimensions prevent moving stock by editing a row.
 * Both references are checked under a key-share lock against the same owner. */
export function compileApplicationStockLocationsSchema(input: ApplicationDefinition, itemTableId: string): string[] {
  const { app, table, index } = applicationInventoryReservationTarget(input, itemTableId);
  const rule = table.stockLocations;
  if (!rule) return [];
  const item = table.fields.find(field => field.id === rule.itemFieldId)!;
  const location = table.fields.find(field => field.id === rule.locationFieldId)!;
  const catalog = app.tables.find(target => target.id === item.referenceTableId)!;
  const warehouses = app.tables.find(target => target.id === location.referenceTableId)!;
  const guard = 'app_stock_location_guard_' + index;
  return [
    ...[catalog, warehouses].map(target => `create unique index if not exists app_stock_owner_identity_${app.tables.indexOf(target)} on public."app_${target.key}" (id,owner_id);`),
    `alter table public."app_${table.key}" add constraint app_stock_item_owner_${index} foreign key ("${item.key}",owner_id) references public."app_${catalog.key}" (id,owner_id) on delete restrict;`,
    `alter table public."app_${table.key}" add constraint app_stock_location_owner_${index} foreign key ("${location.key}",owner_id) references public."app_${warehouses.key}" (id,owner_id) on delete restrict;`,
    `alter table public."app_${table.key}" add constraint app_stock_location_unique_${index} unique (owner_id,"${item.key}","${location.key}");`,
    `create function private.${guard}() returns trigger language plpgsql security definer set search_path = '' as $stock_location$
begin
  if tg_op = 'UPDATE' then
    if new."${item.key}" is distinct from old."${item.key}" or new."${location.key}" is distinct from old."${location.key}" then
      raise exception 'Stock location identity is immutable';
    end if;
  end if;
  perform 1 from public."app_${catalog.key}" t where t.id = new."${item.key}" and t.owner_id = new.owner_id for key share;
  if not found then raise exception 'Stock item unavailable'; end if;
  perform 1 from public."app_${warehouses.key}" t where t.id = new."${location.key}" and t.owner_id = new.owner_id for key share;
  if not found then raise exception 'Stock location unavailable'; end if;
  return new;
end $stock_location$;`,
    `revoke all on function private.${guard}() from public,anon,authenticated;`,
    `create trigger app_stock_location_guard_${index} before insert or update on public."app_${table.key}"
      for each row execute function private.${guard}();`,
  ];
}
