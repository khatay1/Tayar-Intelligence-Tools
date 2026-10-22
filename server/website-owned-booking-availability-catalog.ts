import type { ApplicationDefinition } from '../src/modules/website-builder/core/application-model';
import { applicationBookingAvailabilityManifest } from '../src/modules/website-builder/core/application-booking-availability-sql';
const sql = `select n.nspname as schema,p.proname as name,p.prosrc as source,p.prosecdef as security_definer,p.proconfig as configuration,
 p.provolatile as volatility,p.prokind as kind,pg_get_function_result(p.oid) as result,
 pg_get_function_identity_arguments(p.oid) as arguments,l.lanname as language,r.rolname as owner,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
join pg_roles r on r.oid=p.proowner where n.nspname in ('public','private') and left(p.proname,22)='app_booking_available_'`;
export async function verifyOwnedBookingAvailabilityCatalog(app: ApplicationDefinition, query: (sql: string) => Promise<unknown>) {
  try {
    const manifest = applicationBookingAvailabilityManifest(app); if (!manifest.length) return true;
    const rows = await query(sql); if (!Array.isArray(rows) || rows.length !== manifest.length) return false;
    const seen = new Set<string>();
    for (const row of rows) {
      const expected = manifest.find(item => item.name === row?.name && item.schema === row.schema);
      const identity = `${row?.schema}.${row?.name}`;
      if (!expected || seen.has(identity) || row.source !== expected.source || row.security_definer !== expected.definer
        || row.volatility !== 's' || row.kind !== 'f' || row.result !== 'boolean'
        || row.arguments !== expected.arguments.replace(/,/g, ', ').replace(/timestamptz/g, 'timestamp with time zone')
        || row.language !== expected.language || row.owner !== 'postgres' || row.anon_execute !== false || row.authenticated_execute !== true || row.service_execute !== false
        || !Array.isArray(row.configuration) || row.configuration.length !== 1 || !['search_path=', 'search_path=""'].includes(row.configuration[0])) return false;
      seen.add(identity);
    }
    return true;
  } catch { return false; }
}
