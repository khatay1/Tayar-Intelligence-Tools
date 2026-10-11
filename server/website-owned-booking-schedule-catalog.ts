import type { ApplicationDefinition } from '../src/modules/website-builder/core/application-model';
import { applicationBookingScheduleManifest } from '../src/modules/website-builder/core/application-booking-schedule-sql';
const sql = `select p.proname as name,p.prosrc as source,p.prosecdef as security_definer,p.proconfig as configuration,
 p.provolatile as volatility,p.prokind as kind,pg_get_function_result(p.oid) as result,
 exists(select 1 from pg_timezone_names zone where zone.name=__ZONE_CASE__) as time_zone_available,
 pg_get_function_identity_arguments(p.oid) as arguments,l.lanname as language,r.rolname as owner,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute,
 t.relname as table_name,g.tgname as trigger_name,g.tgenabled as enabled,g.tgtype as type,g.tgargs as trigger_arguments
from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
join pg_roles r on r.oid=p.proowner left join pg_trigger g on g.tgfoid=p.oid and not g.tgisinternal
left join pg_class t on t.oid=g.tgrelid left join pg_namespace tn on tn.oid=t.relnamespace
where n.nspname='public' and left(p.proname,21)='app_booking_schedule_' and(tn.nspname='public' or tn.nspname is null)`;

/** Verify invoker trigger bodies and attachment, rather than accepting saved
 * revision metadata as evidence that working hours are enforced. */
export async function verifyOwnedBookingScheduleCatalog(app: ApplicationDefinition, query: (sql: string) => Promise<unknown>) {
  try {
    const manifest = applicationBookingScheduleManifest(app); if (!manifest.length) return true;
    const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
    const zones = `case p.proname ${manifest.map(item => `when ${literal(item.name)} then ${literal(item.timeZone)}`).join(' ')} end`;
    const rows = await query(sql.replace('__ZONE_CASE__', zones)); if (!Array.isArray(rows) || rows.length !== manifest.length) return false;
    const seen = new Set<string>();
    for (const row of rows) {
      const expected = manifest.find(item => item.name === row?.name);
      if (!expected || seen.has(row.name) || row.time_zone_available !== true || row.source !== expected.source || row.security_definer !== false
        || row.volatility !== 'v' || row.kind !== 'f' || row.result !== 'trigger' || row.arguments !== '' || row.language !== 'plpgsql'
        || row.owner !== 'postgres' || row.anon_execute !== false || row.authenticated_execute !== false || row.service_execute !== false
        || !Array.isArray(row.configuration) || row.configuration.length !== 1 || !['search_path=', 'search_path=""'].includes(row.configuration[0])
        || row.table_name !== expected.table || row.trigger_name !== expected.name || row.enabled !== 'O' || row.type !== 23 || row.trigger_arguments !== '\\x') return false;
      seen.add(row.name);
    }
    return true;
  } catch { return false; }
}
