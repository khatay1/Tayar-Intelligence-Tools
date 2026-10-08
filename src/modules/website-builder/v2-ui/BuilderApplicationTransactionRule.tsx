import { useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import type { ApplicationTable, ApplicationTransactionRule } from '../core/application-model';

export function BuilderApplicationTransactionRule({ table, tables, disabled, onSave }: {
  table: ApplicationTable; tables: ApplicationTable[]; disabled?: boolean; onSave(value?: ApplicationTransactionRule): void;
}) {
  const l = useLocalizer(), saved = table.transaction;
  const [itemTableId, setItemTable] = useState(saved?.itemTableId ?? '');
  const [lineTableId, setLineTable] = useState(saved?.lineTableId ?? '');
  const [lineTransactionFieldId, setParentField] = useState(saved?.lineTransactionFieldId ?? '');
  const [lineItemFieldId, setItemField] = useState(saved?.lineItemFieldId ?? '');
  const [lineQuantityFieldId, setQuantityField] = useState(saved?.lineQuantityFieldId ?? '');
  const [counterDirection, setDirection] = useState<ApplicationTransactionRule['counterDirection']>(saved?.counterDirection ?? 'decrement');
  const itemTables = tables.filter(candidate => candidate.id !== table.id && candidate.counter);
  const lineTables = tables.filter(candidate => candidate.id !== table.id && candidate.id !== itemTableId);
  const line = lineTables.find(candidate => candidate.id === lineTableId);
  const parentFields = line?.fields.filter(field => field.type === 'reference' && field.required && field.referenceTableId === table.id) ?? [];
  const itemFields = line?.fields.filter(field => field.type === 'reference' && field.required && field.referenceTableId === itemTableId) ?? [];
  const quantities = line?.fields.filter(field => field.type === 'number' && field.required) ?? [];
  const valid = !!itemTables.find(candidate => candidate.id === itemTableId) && !!line
    && !!parentFields.find(field => field.id === lineTransactionFieldId) && !!itemFields.find(field => field.id === lineItemFieldId)
    && !!quantities.find(field => field.id === lineQuantityFieldId) && new Set([lineTransactionFieldId, lineItemFieldId, lineQuantityFieldId]).size === 3;
  return <fieldset><legend>{l('Atomic multi-item transaction')}</legend>
    <p>{l('Create one parent record and its line items while updating every selected quantity in one protected operation.')}</p>
    <label>{l('Item table')}<select disabled={disabled} value={itemTableId} onChange={event => { setItemTable(event.target.value); setLineTable(''); }}><option value="">{l('Select a table')}</option>{itemTables.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label>
    <label>{l('Line table')}<select disabled={disabled || !itemTableId} value={lineTableId} onChange={event => { setLineTable(event.target.value); setParentField(''); setItemField(''); setQuantityField(''); }}><option value="">{l('Select a table')}</option>{lineTables.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label>
    <label>{l('Parent reference field')}<select disabled={disabled || !line} value={lineTransactionFieldId} onChange={event => setParentField(event.target.value)}><option value="">{l('Select a field')}</option>{parentFields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label>
    <label>{l('Item reference field')}<select disabled={disabled || !line} value={lineItemFieldId} onChange={event => setItemField(event.target.value)}><option value="">{l('Select a field')}</option>{itemFields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label>
    <label>{l('Line quantity field')}<select disabled={disabled || !line} value={lineQuantityFieldId} onChange={event => setQuantityField(event.target.value)}><option value="">{l('Select a field')}</option>{quantities.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label>
    <label>{l('Quantity direction')}<select disabled={disabled} value={counterDirection} onChange={event => setDirection(event.target.value as ApplicationTransactionRule['counterDirection'])}><option value="decrement">{l('Decrease')}</option><option value="increment">{l('Increase')}</option></select></label>
    <button type="button" disabled={disabled || !valid} onClick={() => onSave({ itemTableId, lineTableId, lineTransactionFieldId, lineItemFieldId, lineQuantityFieldId, counterDirection })}>{l('Save transaction rule')}</button>
    {saved && <button type="button" disabled={disabled} onClick={() => onSave(undefined)}>{l('Remove transaction rule')}</button>}
  </fieldset>;
}
