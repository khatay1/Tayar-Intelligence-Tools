import type { ApplicationReport, ApplicationTable } from './application-model';

type ReportValue = string | null;
export interface ApplicationReportResult {
  id: string; name: string; value: ReportValue; previousValue?: ReportValue;
  groups?: Array<{ key: string | null; value: ReportValue; previousValue?: ReportValue }>;
  truncated?: boolean;
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const shape = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join(',') === keys.sort().join(',');
function validValue(report: ApplicationReport, value: unknown): value is ReportValue {
  return value === null ? !['count', 'sum'].includes(report.operation)
    : typeof value === 'string' && value.length <= 512 && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)
      && (report.operation !== 'count' || /^(?:0|[1-9]\d*)$/.test(value));
}
/** PostgreSQL numeric values stay text; bounded groups explicitly disclose truncation. */
export function parseApplicationReports(table: ApplicationTable, input: unknown): ApplicationReportResult[] {
  const reports = table.reports;
  if (!reports?.length || !Array.isArray(input) || input.length !== reports.length) throw new Error('Invalid report response.');
  const seen = new Set<string>();
  for (const row of input) {
    if (!object(row)) throw new Error('Invalid report response.');
    const report = reports.find(report => report.id === row.id), comparison = report?.period?.comparePrevious;
    const keys = ['id', 'value', ...(comparison ? ['previousValue'] : []), ...(report?.groupByFieldId ? ['groups', 'truncated'] : [])];
    if (!report || seen.has(report.id) || !shape(row, keys) || !validValue(report, row.value)
      || comparison && !validValue(report, row.previousValue)) throw new Error('Invalid report response.');
    if (report.groupByFieldId) {
      if (!Array.isArray(row.groups) || row.groups.length > 100 || typeof row.truncated !== 'boolean'
        || row.truncated && row.groups.length !== 100) throw new Error('Invalid report response.');
      const groups = new Set<string | null>();
      for (const group of row.groups) {
        if (!object(group) || !shape(group, ['key', 'value', ...(comparison ? ['previousValue'] : [])])
          || group.key !== null && (typeof group.key !== 'string' || group.key.length > 20000)
          || groups.has(group.key as string | null) || !validValue(report, group.value)
          || comparison && !validValue(report, group.previousValue)) throw new Error('Invalid report response.');
        groups.add(group.key as string | null);
      }
    }
    seen.add(report.id);
  }
  return reports.map(report => ({ ...input.find(row => row.id === report.id), name: report.name }));
}

/** Exact decimal subtraction for period deltas; never pass money through Number. */
export function applicationReportDifference(current: ReportValue, previous: ReportValue): ReportValue {
  if (current === null || previous === null) return null;
  const scale = Math.max(current.split('.')[1]?.length ?? 0, previous.split('.')[1]?.length ?? 0);
  const integer = (value: string) => {
    const negative = value.startsWith('-'), [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
    return BigInt(whole + fraction.padEnd(scale, '0')) * (negative ? -1n : 1n);
  };
  const result = integer(current) - integer(previous), sign = result < 0 ? '-' : '';
  const digits = (result < 0 ? -result : result).toString().padStart(scale + 1, '0');
  return sign + (scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits);
}
