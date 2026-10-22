import type { ApplicationBookingSchedule, ApplicationDefinition } from './application-model';
import { readApplicationDefinition } from './application-validation';
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;

/** Shared wall-time predicate for the write guard and the availability probe. */
export function applicationBookingSchedulePredicate(schedule: ApplicationBookingSchedule) {
  const windows = schedule.weekly.map(window => `(extract(isodow from local_start)=${window.day}
      and local_start>=local_start::date+make_interval(mins=>${window.startMinute})
      and local_end<=local_start::date+make_interval(mins=>${window.endMinute}))`).join(' or ');
  const allowed = schedule.exceptions?.length ? `(case local_start::date ${schedule.exceptions.map(exception =>
      `when ${literal(exception.date)}::date then (${exception.windows.map(window => `(local_start>=local_start::date+make_interval(mins=>${window.startMinute}) and local_end<=local_start::date+make_interval(mins=>${window.endMinute}))`).join(' or ') || 'false'})`).join(' ')} else (${windows}) end)` : windows;
  return allowed;
}
export function applicationBookingScheduleManifest(input: ApplicationDefinition) {
  const app = readApplicationDefinition(input);
  return app.tables.flatMap((table, index) => {
    const rule = table.booking, schedule = rule?.schedule;
    const organization = table.fields.find(field => field.id === table.organizationFieldId);
    if (!rule || !schedule && !organization) return [];
    const key = (id: string) => table.fields.find(field => field.id === id)!.key;
    const start = `new."${key(rule.startFieldId)}"`, end = `new."${key(rule.endFieldId)}"`;
    // Check every resource on writes, including nonblocking states. The
    // advisory availability probe cannot authorize a direct insert or update.
    const resources = organization ? [rule.resourceFieldId, ...(rule.additionalResourceFieldIds ?? [])].map(id => {
      const field = table.fields.find(field => field.id === id)!;
      const target = app.tables.find(candidate => candidate.id === field.referenceTableId)!;
      const targetOrganization = target.fields.find(candidate => candidate.id === target.organizationFieldId);
      const scope = target.id === app.tenancy?.organizationTableId ? 'r.id' : `r."${targetOrganization!.key}"`;
      return `if not exists(select 1 from public."app_${target.key}" r where r.id=new."${field.key}" and ${scope}=new."${organization.key}") then raise exception 'Application booking resource outside organization' using errcode='23514';end if;`;
    }).join('\n ') : '';
    const source = `
declare local_start timestamp; local_end timestamp;
begin
 ${resources ? `${resources}\n ` : ''}${schedule ? `${rule.statusFieldId ? `if new."${key(rule.statusFieldId)}" not in (${rule.blockingStatuses!.map(literal).join(',')}) then return new;end if;` : ''}
 if not isfinite(${start}) or not isfinite(${end}) or ${start}>=${end} then return new;end if;
 local_start:=timezone(${literal(schedule.timeZone)},${start});local_end:=timezone(${literal(schedule.timeZone)},${end});
 if ${end}-${start}>make_interval(mins=>${schedule.maxDurationMinutes}) or local_start>=local_end or not(${applicationBookingSchedulePredicate(schedule)})
  then raise exception 'Application booking outside schedule' using errcode='23514';end if;` : ''}
 return new;
end;`;
    return [{ name: `app_booking_schedule_${index}`, table: `app_${table.key}`, timeZone: schedule?.timeZone ?? 'UTC', source }];
  });
}
export function compileApplicationBookingSchedule(input: ApplicationDefinition, index: number) {
  const rule = applicationBookingScheduleManifest(input).find(rule => rule.name === `app_booking_schedule_${index}`);
  if (!rule) return [];
  return [
    `create function public.${rule.name}() returns trigger language plpgsql security invoker set search_path='' as $schedule$${rule.source}$schedule$;`,
    `revoke all on function public.${rule.name}() from public,anon,authenticated,service_role;`,
    `create trigger ${rule.name} before insert or update on public."${rule.table}" for each row execute function public.${rule.name}();`,
  ];
}
