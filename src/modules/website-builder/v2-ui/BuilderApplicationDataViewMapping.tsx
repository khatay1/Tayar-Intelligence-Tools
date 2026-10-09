import { useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import type { ApplicationDefinition } from '../core/application-model';
import { compileApplicationDataView, type ApplicationDataViewBinding } from '../core/application-data-view';
import type { WebsiteSection } from '../core/types';

export function BuilderApplicationDataViewMapping({ section, application, disabled, onChange }: {
  section: WebsiteSection; application: ApplicationDefinition; disabled: boolean;
  onChange(value: ApplicationDataViewBinding | undefined): void;
}) {
  const l = useLocalizer(), saved = section.applicationDataView;
  const [tableId, setTableId] = useState(saved?.tableId ?? '');
  const [columns, setColumns] = useState<string[]>(saved?.columns ?? []);
  const [actions, setActions] = useState<ApplicationDataViewBinding['actions']>(saved?.actions ?? []);
  const [pageSize, setPageSize] = useState(saved?.pageSize ?? 10);
  const [searchFieldId, setSearchFieldId] = useState(saved?.searchFieldId ?? '');
  const [error, setError] = useState('');
  const tables = application.tables.filter(table => table.permissions.some(rule => rule.operation === 'read'));
  const table = tables.find(table => table.id === tableId);
  const binding: ApplicationDataViewBinding = { tableId, columns, actions, pageSize, ...(searchFieldId ? { searchFieldId } : {}) };
  let valid = false;
  try { compileApplicationDataView(application, binding); valid = true; } catch { /* Validate before Save. */ }
  return <details className="builder-v2-card builder-v2-card--nested" data-testid="application-data-view-mapping">
    <summary>{l('Application data view')}</summary>
    <p>{l('Records load after secure application publishing and sign-in. Database permissions control every action.')}</p>
    <label>{l('Target table')}<select value={tableId} disabled={disabled} onChange={event => {
      const next = tables.find(table => table.id === event.target.value); setTableId(next?.id ?? '');
      setColumns(next?.fields.map(field => field.id) ?? []); setActions([]); setSearchFieldId(''); setError('');
    }}><option value="">{l('Select a table')}</option>{tables.map(table => <option key={table.id} value={table.id}>{table.name}</option>)}</select></label>
    {table && <>
      <fieldset disabled={disabled}><legend>{l('Visible columns')}</legend>{table.fields.map(field => <label key={field.id}>
        <input type="checkbox" checked={columns.includes(field.id)} onChange={event => {
          setColumns(current => event.target.checked ? [...current, field.id] : current.filter(id => id !== field.id));
          if (!event.target.checked && searchFieldId === field.id) setSearchFieldId('');
        }} />{field.name}
      </label>)}</fieldset>
      <fieldset disabled={disabled}><legend>{l('Allowed actions')}</legend>{(['create', 'update', 'delete', 'adjust', 'transact', 'transition'] as const).map(action => <label key={action}>
        <input type="checkbox" checked={actions.includes(action)} disabled={disabled || !table.permissions.some(rule => rule.operation === (action === 'adjust' || action === 'transition' ? 'update' : action === 'transact' ? 'create' : action)) || (action === 'adjust' && !table.counter) || (action === 'transact' && !table.transaction) || (action === 'transition' && !table.workflow)} onChange={event => setActions(current => event.target.checked ? [...current, action] : current.filter(value => value !== action))} />
        {l(action === 'create' ? 'Add record' : action === 'update' ? 'Edit record' : action === 'adjust' ? 'Adjust quantity' : action === 'transact' ? 'Create transaction' : action === 'transition' ? 'Workflow' : 'Delete record')}
      </label>)}</fieldset>
      <label>{l('Search column')}<select value={searchFieldId} disabled={disabled} onChange={event => setSearchFieldId(event.target.value)}>
        <option value="">{l('None')}</option>{table.fields.filter(field => field.type === 'text' && columns.includes(field.id)).map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
      </select></label>
      <label>{l('Records per page')}<input type="number" min={1} max={50} value={pageSize} disabled={disabled} onChange={event => setPageSize(Number(event.target.value))} /></label>
    </>}
    {error && <p role="alert">{error}</p>}
    <div className="builder-v2-grid"><button type="button" disabled={disabled || !valid} onClick={() => {
      try { compileApplicationDataView(application, binding); onChange(binding); setError(''); }
      catch { setError(l('Select valid columns and actions permitted by the table.')); }
    }}>{l('Save data view')}</button>{saved && <button type="button" disabled={disabled} onClick={() => onChange(undefined)}>{l('Remove data view')}</button>}</div>
  </details>;
}
