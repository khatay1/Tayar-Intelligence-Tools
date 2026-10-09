import { useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import type { ApplicationField, ApplicationFormula, ApplicationTable } from '../core/application-model';

export function BuilderApplicationFormulaRule({ table, disabled, onSave }: {
  table: ApplicationTable; disabled?: boolean; onSave(fieldId: string, formula: ApplicationFormula | undefined): void;
}) {
  const l = useLocalizer();
  const existing = table.fields.filter(field => field.formula);
  const [targetId, setTargetId] = useState('');
  const [operation, setOperation] = useState<ApplicationFormula['operation']>('sum');
  const [fieldIds, setFieldIds] = useState<string[]>([]);
  const targets = table.fields.filter(field => field.type === 'number' && field.required && field.defaultValue === undefined && !field.formula);
  const sources = table.fields.filter(field => field.type === 'number' && field.required && !field.formula && field.id !== targetId);
  const valid = !!targetId && (operation === 'sum' ? fieldIds.length >= 2 && fieldIds.length <= 20 : fieldIds.length === 2)
    && fieldIds.every(id => sources.some(field => field.id === id));
  const updateSources = (field: ApplicationField, checked: boolean) => setFieldIds(current => checked ? [...current, field.id] : current.filter(id => id !== field.id));
  return <fieldset disabled={disabled}><legend>{l('Calculated field')}</legend>
    {existing.map(field => <div key={field.id}>{field.name}: {l(field.formula!.operation === 'sum' ? 'Sum' : field.formula!.operation === 'subtract' ? 'Subtract' : 'Multiply')}
      <button type="button" disabled={disabled} onClick={() => onSave(field.id, undefined)}>{l('Remove')}</button></div>)}
    <label>{l('Field')}<select value={targetId} onChange={event => { setTargetId(event.target.value); setFieldIds([]); }}>
      <option value="">{l('Select a field')}</option>{targets.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
    </select></label>
    <label>{l('Calculation')}<select value={operation} onChange={event => { setOperation(event.target.value as ApplicationFormula['operation']); setFieldIds([]); }}>
      <option value="sum">{l('Sum')}</option><option value="subtract">{l('Subtract')}</option><option value="multiply">{l('Multiply')}</option>
    </select></label>
    <fieldset><legend>{l('Source fields')}</legend>{sources.map(field => <label key={field.id}><input type="checkbox" checked={fieldIds.includes(field.id)}
      disabled={disabled || (operation !== 'sum' && fieldIds.length >= 2 && !fieldIds.includes(field.id))}
      onChange={event => updateSources(field, event.target.checked)} />{field.name}</label>)}</fieldset>
    <button type="button" disabled={disabled || !valid} onClick={() => onSave(targetId, { operation, fieldIds })}>{l('Save')}</button>
  </fieldset>;
}
