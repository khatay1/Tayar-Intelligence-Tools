import { useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import type { ApplicationReport, ApplicationTable } from '../core/application-model';

export function BuilderApplicationReportsRule({ table, disabled, onSave }: {
  table: ApplicationTable; disabled?: boolean; onSave(value?: ApplicationTable['reports']): void;
}) {
  const l = useLocalizer();
  const [name, setName] = useState('');
  const [operation, setOperation] = useState<ApplicationReport['operation']>('count');
  const [fieldId, setFieldId] = useState(''), [groupId, setGroupId] = useState(''), [dateId, setDateId] = useState('');
  const [unit, setUnit] = useState<NonNullable<ApplicationReport['period']>['unit']>('month');
  const [zone, setZone] = useState('UTC'), [offset, setOffset] = useState(0), [compare, setCompare] = useState(false);
  const fields = table.fields.filter(field => field.type === 'number');
  const groups = table.fields.filter(field => ['text', 'enum', 'boolean', 'uuid', 'reference'].includes(field.type));
  const dates = table.fields.filter(field => ['date', 'datetime'].includes(field.type));
  const reports = table.reports ?? [];
  let validZone = false;
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(0); validZone = zone.length <= 80 && /^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/.test(zone); } catch { /* invalid draft */ }
  const valid = !!name.trim() && (operation === 'count' || fields.some(field => field.id === fieldId))
    && (!groupId || groups.some(field => field.id === groupId))
    && (!dateId || dates.some(field => field.id === dateId) && validZone && Number.isInteger(offset) && offset >= -120 && offset <= 0);
  return <fieldset data-testid="application-reports"><legend>{l('Aggregate reports')}</legend>
    <p>{l('Totals include all records the signed-in user can read. Search and page selection do not change totals.')}</p>
    {reports.map(report => <div key={report.id}><span>{report.name} · {l(report.operation)}{report.fieldId ? ` · ${table.fields.find(field => field.id === report.fieldId)?.name ?? report.fieldId}` : ''}
      {report.groupByFieldId ? ` · ${l('Group by')}: ${table.fields.find(field => field.id === report.groupByFieldId)?.name}` : ''}
      {report.period ? ` · ${l(report.period.unit)} (${report.period.offset}) · ${report.period.timeZone}${report.period.comparePrevious ? ` · ${l('Compare previous period')}` : ''}` : ''}</span>
      <button type="button" disabled={disabled} onClick={() => { const next = reports.filter(item => item.id !== report.id); onSave(next.length ? next : undefined); }}>{l('Remove report')}</button></div>)}
    <label>{l('Report name')}<input disabled={disabled} value={name} maxLength={160} onChange={event => setName(event.target.value)} /></label>
    <label>{l('Calculation')}<select disabled={disabled} value={operation} onChange={event => setOperation(event.target.value as ApplicationReport['operation'])}>
      {(['count', 'sum', 'min', 'max', 'avg'] as const).map(value => <option key={value} value={value}>{l(value)}</option>)}
    </select></label>
    {operation !== 'count' && <label>{l('Numeric field')}<select disabled={disabled} value={fieldId} onChange={event => setFieldId(event.target.value)}>
      <option value="">{l('Select a field')}</option>{fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
    </select></label>}
    <label>{l('Group by')}<select disabled={disabled} value={groupId} onChange={event => setGroupId(event.target.value)}>
      <option value="">{l('No grouping')}</option>{groups.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
    </select></label>
    <label>{l('Report date field')}<select disabled={disabled} value={dateId} onChange={event => setDateId(event.target.value)}>
      <option value="">{l('All dates')}</option>{dates.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
    </select></label>
    {dateId && <>
      <label>{l('Calendar period')}<select disabled={disabled} value={unit} onChange={event => setUnit(event.target.value as typeof unit)}>
        {(['day', 'week', 'month', 'year'] as const).map(value => <option key={value} value={value}>{l(value)}</option>)}
      </select></label>
      <label>{l('Time zone')}<input disabled={disabled} value={zone} maxLength={80} placeholder="Europe/Stockholm" onChange={event => setZone(event.target.value)} /></label>
      <label>{l('Period offset (0 = current)')}<input disabled={disabled} type="number" min={-120} max={0} step={1} value={Number.isFinite(offset) ? offset : ''} onChange={event => setOffset(event.target.value === '' ? NaN : Number(event.target.value))} /></label>
      <label><input disabled={disabled} type="checkbox" checked={compare} onChange={event => setCompare(event.target.checked)} />{l('Compare previous period')}</label>
      <p>{l('Current periods may be incomplete. Comparisons use the entire preceding calendar period.')}</p>
    </>}
    <button type="button" disabled={disabled || reports.length >= 8 || !valid} onClick={() => {
      onSave([...reports, { id: crypto.randomUUID(), name: name.trim(), operation, ...(operation !== 'count' ? { fieldId } : {}),
        ...(groupId ? { groupByFieldId: groupId } : {}), ...(dateId ? { period: { fieldId: dateId, unit, timeZone: zone, offset, comparePrevious: compare } } : {}) }]); setName('');
    }}>{l('Add report')}</button>
  </fieldset>;
}
