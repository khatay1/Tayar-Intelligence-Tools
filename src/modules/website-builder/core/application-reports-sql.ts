import type { ApplicationDefinition, ApplicationReport, ApplicationTable } from './application-model';
import { readApplicationDefinition } from './application-validation';
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
const authenticated = "(select auth.uid()) is not null and (((select auth.jwt())->>'is_anonymous')::boolean) is not true";
function aggregate(table: ApplicationTable, report: ApplicationReport) {
  const expression = report.operation === 'count' ? 'count(*)' : `${report.operation}("${table.fields.find(field => field.id === report.fieldId)!.key}")`;
  return report.operation === 'sum' ? `coalesce(${expression},0)::text` : `${expression}::text`;
}
function reportExpression(table: ApplicationTable, report: ApplicationReport) {
  const period = report.period, expression = aggregate(table, report), compared = period?.comparePrevious;
  const where = (offset: number) => {
    if (!period) return 'true';
    const field = table.fields.find(field => field.id === period.fieldId)!;
    const boundary = (delta: number) => {
      const local = `(date_trunc(${literal(period.unit)},timezone(${literal(period.timeZone)},current_timestamp))+${delta}*interval '1 ${period.unit}')`;
      return field.type === 'date' ? `${local}::date` : `timezone(${literal(period.timeZone)},${local})`;
    };
    return `"${field.key}">=${boundary(offset)} and "${field.key}"<${boundary(offset + 1)}`;
  };
  const current = where(period?.offset ?? 0), previous = where((period?.offset ?? 0) - 1);
  const properties = [`'id',${literal(report.id)}`, `'value',(select ${expression} from readable where ${current})`];
  if (compared) properties.push(`'previousValue',(select ${expression} from readable where ${previous})`);
  if (report.groupByFieldId) {
    const key = `"${table.fields.find(field => field.id === report.groupByFieldId)!.key}"::text`;
    const missing = ['sum', 'count'].includes(report.operation) ? "'0'::text" : 'null::text';
    const group = (filter: string) => `select ${key} as key,${expression} as value from readable where ${filter} group by ${key}`;
    // Group both period results together rather than full-joining null keys.
    const merged = compared
      ? `select key,coalesce(max(value) filter(where period=0),${missing}) as value,coalesce(max(value) filter(where period=1),${missing}) as previous_value
        from (select g.*,0 as period from (${group(current)}) g union all select g.*,1 as period from (${group(previous)}) g) combined group by key`
      : group(current);
    const row = `jsonb_build_object('key',key,'value',value${compared ? ",'previousValue',previous_value" : ''})`;
    properties.push(`'groups',(select coalesce(jsonb_agg(${row} order by key collate "C" nulls last),'[]'::jsonb) from (select * from (${merged}) grouped order by key collate "C" nulls last limit 100) bounded)`,
      `'truncated',(select count(*)>100 from (select key from (${merged}) grouped limit 101) overflow)`);
  }
  return `jsonb_build_object(${properties.join(',')})`;
}
export function applicationReportsManifest(input: ApplicationDefinition) {
  const app = readApplicationDefinition(input);
  return app.tables.flatMap((table, index) => {
    if (!table.reports?.length) return [];
    const organization = table.fields.find(field => field.id === table.organizationFieldId);
    const scope = organization
      ? ` and "${organization.key}"=requested_organization and (select private.app_has_organization_access(requested_organization))`
      : '';
    const source = table.reports.some(report => report.period || report.groupByFieldId)
      ? `\n with readable as materialized(select * from public."app_${table.key}" where ${authenticated}${scope})
 select jsonb_build_array(${table.reports.map(report => reportExpression(table, report)).join(',')})\n`
      : `\n select jsonb_build_array(${table.reports.map(report => `jsonb_build_object('id',${literal(report.id)},'value',${aggregate(table, report)})`).join(',')}) from public."app_${table.key}"
 where ${authenticated}${scope}\n`;
    return [{ name: `app_reports_${index}`, source, arguments: organization ? 'requested_organization uuid' : '' }];
  });
}
export function compileApplicationReports(input: ApplicationDefinition, index: number, replace = false) {
  const report = applicationReportsManifest(input).find(report => report.name === `app_reports_${index}`);
  if (!report) return [];
  return [`create ${replace ? 'or replace ' : ''}function public.${report.name}(${report.arguments}) returns jsonb language sql stable security invoker set search_path='' as $report$${report.source}$report$;`,
    `revoke all on function public.${report.name}(${report.arguments ? 'uuid' : ''}) from public,anon,authenticated,service_role;`,
    `grant execute on function public.${report.name}(${report.arguments ? 'uuid' : ''}) to authenticated;`];
}
