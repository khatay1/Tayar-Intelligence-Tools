import type { ApplicationDefinition, ApplicationPermission } from './application-model';
import { readApplicationDefinition } from './application-validation';
import { applicationBookingSchedulePredicate } from './application-booking-schedule-sql';
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
const access = (rule: ApplicationPermission | undefined, owner?: string): string => !rule ? 'false'
  : rule.access === 'role' ? `private.app_has_role(${literal(rule.roleId!)})`
  : rule.access === 'owner' && owner ? `${owner}=auth.uid()` : 'true';

/** A narrowly authorized occupancy projection. It deliberately returns no row,
 * owner, status, count or booking identity, including for RLS-hidden conflicts. */
export function applicationBookingAvailabilityManifest(input: ApplicationDefinition) {
  const app = readApplicationDefinition(input);
  return app.tables.flatMap((table, index) => {
    const rule = table.booking;
    if (!rule || !table.permissions.some(permission => permission.operation === 'create')) return [];
    const key = (id: string) => table.fields.find(field => field.id === id)!.key;
    const resources = [rule.resourceFieldId, ...(rule.additionalResourceFieldIds ?? [])];
    const resourceChecks = resources.map((id, slot) => {
      const field = table.fields.find(field => field.id === id)!;
      if (field.type !== 'reference') return '';
      const target = app.tables.find(candidate => candidate.id === field.referenceTableId)!;
      return `if not exists(select 1 from public."app_${target.key}" r where r.id=($1)[${slot + 1}] and (${access(target.permissions.find(permission => permission.operation === 'read'), 'r.owner_id')})) then return null;end if;`;
    }).join('\n');
    const schedule = rule.schedule;
    const source = `
declare local_start timestamp;local_end timestamp;
begin
 if auth.uid() is null or (auth.jwt()->>'is_anonymous')::boolean is true
  or not exists(select 1 from auth.users where id=auth.uid() and is_anonymous is not true)
  or not(${access(table.permissions.find(permission => permission.operation === 'create'))}) then return null;end if;
 if coalesce(array_ndims(resources),0)<>1 or array_lower(resources,1)<>1 or cardinality(resources)<>${resources.length}
  or array_position(resources,null) is not null or starts_at is null or ends_at is null
  or not isfinite(starts_at) or not isfinite(ends_at) or starts_at>=ends_at
  or ends_at-starts_at>interval '24 hours' then return null;end if;
 ${resourceChecks}
 ${schedule ? `local_start:=timezone(${literal(schedule.timeZone)},starts_at);local_end:=timezone(${literal(schedule.timeZone)},ends_at);
 if ends_at-starts_at>make_interval(mins=>${schedule.maxDurationMinutes}) or local_start>=local_end or not(${applicationBookingSchedulePredicate(schedule)}) then return false;end if;` : ''}
 return not exists(select 1 from public."app_${table.key}" b where
  (${resources.map((id, slot) => `b."${key(id)}"=($1)[${slot + 1}]`).join(' or ')})
  ${rule.statusFieldId ? `and b."${key(rule.statusFieldId)}" in (${rule.blockingStatuses!.map(literal).join(',')})` : ''}
  and tstzrange(b."${key(rule.startFieldId)}",b."${key(rule.endFieldId)}",'[)') && tstzrange($2,$3,'[)'));
end;`;
    const name = `app_booking_available_${index}`;
    return [{ name, schema: 'private', source, language: 'plpgsql', definer: true },
      { name, schema: 'public', source: ` select private.${name}(resources,starts_at,ends_at); `, language: 'sql', definer: false }];
  });
}
export function compileApplicationBookingAvailability(input: ApplicationDefinition, index: number) {
  const manifest = applicationBookingAvailabilityManifest(input).filter(item => item.name === `app_booking_available_${index}`);
  return [...(manifest.length ? ['grant usage on schema private to authenticated;'] : []), ...manifest.flatMap(item => [
    `create or replace function ${item.schema}.${item.name}(resources uuid[],starts_at timestamptz,ends_at timestamptz) returns boolean language ${item.language} stable security ${item.definer ? 'definer' : 'invoker'} set search_path='' as $availability$${item.source}$availability$;`,
    `revoke all on function ${item.schema}.${item.name}(uuid[],timestamptz,timestamptz) from public,anon,authenticated,service_role;`,
    `grant execute on function ${item.schema}.${item.name}(uuid[],timestamptz,timestamptz) to authenticated;`,
  ])];
}
