import { useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import type { ApplicationReport, ApplicationTable } from '../core/application-model';

export function BuilderApplicationReportsRule({ table, disabled, onSave }: {
  table: ApplicationTable; disabled?: boolean; onSave(value?: ApplicationTable['reports']): void;
}) {
  const l = useLocalizer();
  const [name, setName] = useState('');
  const [operation, setOperation] = useState<ApplicationReport['operation']>('count');
  const [fieldId, setFieldId] = useState('');
  const fields = table.fields.filter(field => field.type === 'number');
  const reports = table.reports ?? [];
  return <fieldset data-testid="application-reports"><legend>{l('Aggregate reports')}</legend>
    <p>{l('Totals include all records the signed-in user can read. Search and page selection do not change totals.')}</p>
    {reports.map(report => <div key={report.id}><span>{report.name} · {l(report.operation)}{report.fieldId ? ` · ${table.fields.find(field => field.id === report.fieldId)?.name ?? report.fieldId}` : ''}</span>
      <button type="button" disabled={disabled} onClick={() => { const next = reports.filter(item => item.id !== report.id); onSave(next.length ? next : undefined); }}>{l('Remove report')}</button></div>)}
    <label>{l('Report name')}<input disabled={disabled} value={name} maxLength={160} onChange={event => setName(event.target.value)} /></label>
    <label>{l('Calculation')}<select disabled={disabled} value={operation} onChange={event => setOperation(event.target.value as ApplicationReport['operation'])}>
      {(['count', 'sum', 'min', 'max', 'avg'] as const).map(value => <option key={value} value={value}>{l(value)}</option>)}
    </select></label>
    {operation !== 'count' && <label>{l('Numeric field')}<select disabled={disabled} value={fieldId} onChange={event => setFieldId(event.target.value)}>
      <option value="">{l('Select field')}</option>{fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
    </select></label>}
    <button type="button" disabled={disabled || reports.length >= 8 || !name.trim() || operation !== 'count' && !fields.some(field => field.id === fieldId)} onClick={() => {
      onSave([...reports, { id: crypto.randomUUID(), name: name.trim(), operation, ...(operation !== 'count' ? { fieldId } : {}) }]); setName('');
    }}>{l('Add report')}</button>
  </fieldset>;
}
