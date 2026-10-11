import type { ApplicationDefinition } from './application-model';
import { readApplicationDefinition } from './application-validation';
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
export function applicationReportsManifest(input: ApplicationDefinition) {
  return readApplicationDefinition(input).tables.flatMap((table, index) => {
    if (!table.reports?.length) return [];
    const values = table.reports.map(report => {
      const expression = report.operation === 'count' ? 'count(*)' : `${report.operation}("${table.fields.find(field => field.id === report.fieldId)!.key}")`;
      const result = report.operation === 'sum' ? `coalesce(${expression},0)::text` : `${expression}::text`;
      return `jsonb_build_object('id',${literal(report.id)},'value',${result})`;
    }).join(',');
    const source = `\n select jsonb_build_array(${values}) from public."app_${table.key}"
 where (select auth.uid()) is not null and (((select auth.jwt())->>'is_anonymous')::boolean) is not true\n`;
    return [{ name: `app_reports_${index}`, source }];
  });
}
export function compileApplicationReports(input: ApplicationDefinition, index: number, replace = false) {
  const report = applicationReportsManifest(input).find(report => report.name === `app_reports_${index}`);
  if (!report) return [];
  return [`create ${replace ? 'or replace ' : ''}function public.${report.name}() returns jsonb language sql stable security invoker set search_path='' as $report$${report.source}$report$;`,
    `revoke all on function public.${report.name}() from public,anon,authenticated,service_role;`,
    `grant execute on function public.${report.name}() to authenticated;`];
}
