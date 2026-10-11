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
  return readApplicationDefinition(input).tables.flatMap((table, index) => {
    const rule = table.booking, schedule = rule?.schedule;
    if (!rule || !schedule) return [];
    const key = (id: string) => table.fields.find(field => field.id === id)!.key;
    const start = `new."${key(rule.startFieldId)}"`, end = `new."${key(rule.endFieldId)}"`;
    const allowed = applicationBookingSchedulePredicate(schedule);
    const source = `
declare local_start timestamp; local_end timestamp;
begin
 ${rule.statusFieldId ? `if new."${key(rule.statusFieldId)}" not in (${rule.blockingStatuses!.map(literal).join(',')}) then return new;end if;` : ''}
 if not isfinite(${start}) or not isfinite(${end}) or ${start}>=${end} then return new;end if;
 local_start:=timezone(${literal(schedule.timeZone)},${start});local_end:=timezone(${literal(schedule.timeZone)},${end});
 if ${end}-${start}>make_interval(mins=>${schedule.maxDurationMinutes}) or local_start>=local_end or not(${allowed})
  then raise exception 'Application booking outside schedule' using errcode='23514';end if;
 return new;
end;`;
    return [{ name: `app_booking_schedule_${index}`, table: `app_${table.key}`, timeZone: schedule.timeZone, source }];
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
