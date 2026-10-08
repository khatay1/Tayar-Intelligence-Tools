import { useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import type { ApplicationCounterRule, ApplicationTable } from '../core/application-model';
export function BuilderApplicationCounterRule({ table, disabled, onSave }: { table: ApplicationTable; disabled?: boolean; onSave(value?: ApplicationCounterRule): void }) {
  const l = useLocalizer();
  const [fieldId, setField] = useState(table.counter?.fieldId ?? '');
  const [minimum, setMinimum] = useState(String(table.counter?.minimum ?? 0));
  const [maximum, setMaximum] = useState(table.counter?.maximum === undefined ? '' : String(table.counter.maximum));
  const [integer, setInteger] = useState(table.counter?.integer ?? true);
  const fields = table.fields.filter(field => field.type === 'number' && field.required);
  const field = fields.find(field => field.id === fieldId), min = Number(minimum), max = Number(maximum);
  const valid = !!field && minimum.trim() !== '' && Number.isFinite(min) && Math.abs(min) <= 1e12 && field.defaultValue === min
    && (!integer || Number.isSafeInteger(min)) && (!maximum.trim() || (Number.isFinite(max) && max >= min && Math.abs(max) <= 1e12 && (!integer || Number.isSafeInteger(max))));
  return <fieldset><legend>{l('Atomic quantity adjustments')}</legend>
    <p>{l('Use for stock, quotas or points. New records start at the minimum; changes use a protected adjustment.')}</p>
    <label>{l('Quantity field')}<select disabled={disabled} value={fieldId} onChange={event => setField(event.target.value)}><option value="">{l('Select a field')}</option>{fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label>
    <label>{l('Minimum quantity')}<input type="number" step="any" disabled={disabled} value={minimum} onChange={event => setMinimum(event.target.value)} /></label>
    <label>{l('Maximum quantity (optional)')}<input type="number" step="any" disabled={disabled} value={maximum} onChange={event => setMaximum(event.target.value)} /></label>
    <label><input type="checkbox" disabled={disabled} checked={integer} onChange={event => setInteger(event.target.checked)} />{l('Whole numbers only')}</label>
    <p>{l('Set the quantity field default to the minimum before saving.')}</p>
    <button type="button" disabled={disabled || !valid} onClick={() => onSave({ fieldId, minimum: min, integer, ...(maximum.trim() ? { maximum: max } : {}) })}>{l('Save quantity rule')}</button>
    {table.counter && <button type="button" disabled={disabled} onClick={() => onSave(undefined)}>{l('Remove quantity rule')}</button>}
  </fieldset>;
}
