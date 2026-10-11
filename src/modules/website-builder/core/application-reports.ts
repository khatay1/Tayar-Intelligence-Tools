import type { ApplicationTable } from './application-model';

/** PostgreSQL numeric values stay text so totals never round through JS doubles. */
export function parseApplicationReports(table: ApplicationTable, input: unknown) {
  const reports = table.reports;
  if (!reports?.length || !Array.isArray(input) || input.length !== reports.length) throw new Error('Invalid report response.');
  const seen = new Set<string>();
  for (const row of input) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).length !== 2
      || !Object.prototype.hasOwnProperty.call(row, 'id') || !Object.prototype.hasOwnProperty.call(row, 'value')) throw new Error('Invalid report response.');
    const report = reports.find(report => report.id === row.id);
    if (!report || seen.has(row.id) || (row.value === null ? ['count', 'sum'].includes(report.operation)
      : typeof row.value !== 'string' || row.value.length > 512 || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(row.value)
        || report.operation === 'count' && !/^(?:0|[1-9]\d*)$/.test(row.value))) throw new Error('Invalid report response.');
    seen.add(row.id);
  }
  return reports.map(report => ({ id: report.id, name: report.name, value: input.find(row => row.id === report.id).value as string | null }));
}
