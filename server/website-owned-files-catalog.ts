import type { ApplicationDefinition } from '../src/modules/website-builder/core/application-model';
import { applicationFilesManifest } from '../src/modules/website-builder/core/application-files-sql';

type Query = (sql: string) => Promise<unknown>;
type Row = Record<string, unknown>;
const bucketsSql = `select id, name, public, file_size_limit, allowed_mime_types from storage.buckets where left(id,10)='app_files_'`;
const functionsSql = `select p.proname as name, p.prosrc as source, p.prosecdef as security_definer,
  p.provolatile as volatility,p.prokind as kind,l.lanname as language,p.proconfig as configuration,r.rolname as owner,
  pg_get_function_identity_arguments(p.oid) as arguments,pg_get_function_result(p.oid) as result,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
join pg_roles r on r.oid=p.proowner where n.nspname='private' and left(p.proname,10)='app_files_'`;
const policiesSql = `select c.relrowsecurity as rls,p.polname as name,p.polcmd::text as command,p.polpermissive as permissive,
  array(select case when role_oid=0 then 'public' else (select rolname from pg_roles where oid=role_oid) end from unnest(p.polroles) role_oid order by 1) as roles,
  pg_get_expr(p.polqual,p.polrelid) as using_expression,pg_get_expr(p.polwithcheck,p.polrelid) as check_expression
from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_policy p on p.polrelid=c.oid
where n.nspname='storage' and c.relname='objects' and left(p.polname,10)='app_files_'`;
const row = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);

/** Restrictive guards apply even when a customer has a broad permissive policy.
 * Exact invoker bodies and direct-call policies are checked before publishing. */
export async function verifyOwnedFilesCatalog(app: ApplicationDefinition, query: Query): Promise<boolean> {
  try {
    const expected = applicationFilesManifest(app);
    if (!expected.length) return true;
    const [buckets, functions, policies] = await Promise.all([query(bucketsSql), query(functionsSql), query(policiesSql)]);
    if (!Array.isArray(buckets) || !Array.isArray(functions) || !Array.isArray(policies)
      || buckets.length !== expected.length || functions.length !== expected.length
      || policies.length !== expected.reduce((sum, item) => sum + item.policies.length, 0)) return false;
    for (const item of expected) {
      const bucket = buckets.filter(value => row(value) && value.id === item.bucket), fn = functions.filter(value => row(value) && value.name === item.name);
      if (bucket.length !== 1 || fn.length !== 1) return false;
      const b = bucket[0], f = fn[0];
      if (b.name !== item.bucket || b.public !== false || Number(b.file_size_limit) !== item.rule.maxBytes
        || !Array.isArray(b.allowed_mime_types) || [...b.allowed_mime_types].sort().join(',') !== [...item.rule.mimeTypes].sort().join(',')) return false;
      if (f.source !== item.source || f.security_definer !== false || f.volatility !== 's' || f.kind !== 'f' || f.language !== 'plpgsql'
        || f.owner !== 'postgres' || f.result !== 'boolean'
        || f.arguments !== 'object_bucket text, object_name text, object_owner text, action text, restrictive boolean'
        || f.anon_execute !== true || f.authenticated_execute !== true
        || !Array.isArray(f.configuration) || f.configuration.length !== 1 || !['search_path=', 'search_path=""'].includes(f.configuration[0])) return false;
      for (const policy of item.policies) {
        const found = policies.filter(value => row(value) && value.name === policy.name);
        if (found.length !== 1) return false;
        const p = found[0];
        if (p.rls !== true || p.command !== ({ SELECT: 'r', INSERT: 'a', DELETE: 'd', UPDATE: 'w' } as const)[policy.command]
          || p.permissive !== policy.permissive || !Array.isArray(p.roles) || p.roles.join(',') !== policy.roles.join(',')
          || p.using_expression !== policy.using || p.check_expression !== policy.check) return false;
      }
    }
    return true;
  } catch { return false; }
}
