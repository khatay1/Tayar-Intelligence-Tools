import { useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import type { ApplicationDefinition } from '../core/application-model';
import { compileApplicationCreateForm, type ApplicationCreateFormBinding } from '../core/application-form-runtime';
import type { WebsiteSection } from '../core/types';

interface Props {
  section: WebsiteSection;
  application: ApplicationDefinition;
  disabled: boolean;
  onChange(binding: ApplicationCreateFormBinding | undefined): void;
}

/** Mapping is saved through the same native section operation as other manual/AI
 * edits. The compiler validates the complete candidate before it can be saved. */
export function BuilderApplicationFormMapping({ section, application, disabled, onChange }: Props) {
  const l = useLocalizer();
  const saved = section.applicationFormBinding;
  const [tableId, setTableId] = useState(saved?.tableId ?? '');
  const [fields, setFields] = useState<Record<string, string>>(() => Object.fromEntries(saved?.fields.map(field => [field.formFieldId, field.tableFieldId]) ?? []));
  const [error, setError] = useState('');
  const tables = application.tables.filter(table => table.permissions.some(rule => rule.operation === 'create'));
  const table = tables.find(item => item.id === tableId);
  const formFields = section.formFields ?? [];
  const binding: ApplicationCreateFormBinding = { operation: 'create', tableId,
    fields: formFields.map(field => ({ formFieldId: field.id, tableFieldId: fields[field.id] ?? '' })) };
  let valid = false;
  if (table && formFields.length) {
    try { compileApplicationCreateForm(application, section, binding); valid = true; } catch { /* Explain at Save without exposing internals. */ }
  }
  return <details className="builder-v2-card builder-v2-card--nested" data-testid="application-form-mapping">
    <summary>{l('Application form data')}</summary>
    <p>{l('Bound forms require secure application publishing before they can accept records.')}</p>
    <label>{l('Target table')}
      <select aria-label={l('Target table')} value={tableId} disabled={disabled} onChange={event => {
        const next = tables.find(item => item.id === event.target.value);
        setTableId(next?.id ?? ''); setError('');
        setFields(Object.fromEntries(formFields.map(field => [field.id, next?.fields.find(item => item.key === field.name)?.id ?? ''])));
      }}>
        <option value="">{l('Select a table')}</option>
        {tables.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
    {table && <div className="builder-v2-grid">
      {formFields.map(field => <label key={field.id}>{field.label}
        <select aria-label={`${l('Field')}: ${field.label}`} value={fields[field.id] ?? ''} disabled={disabled} onChange={event => {
          setFields(current => ({ ...current, [field.id]: event.target.value })); setError('');
        }}>
          <option value="">{l('Select a field')}</option>
          {table.fields.filter(item => !item.formula && item.id !== table.workflow?.fieldId).map(item => <option key={item.id} value={item.id}>{item.name} · {item.type}</option>)}
        </select>
      </label>)}
    </div>}
    {error && <p role="alert">{error}</p>}
    <div className="builder-v2-grid">
      <button type="button" disabled={disabled || !valid} onClick={() => { try {
        compileApplicationCreateForm(application, section, binding);
        onChange(binding); setError('');
      } catch { setError(l('Match every form field to a compatible application field.')); } }}>{l('Save data binding')}</button>
      {saved && <button type="button" disabled={disabled} onClick={() => { onChange(undefined); setTableId(''); setFields({}); setError(''); }}>{l('Remove data binding')}</button>}
    </div>
  </details>;
}
