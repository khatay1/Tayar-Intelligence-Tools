import { useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import type { ApplicationPaymentRule, ApplicationRole, ApplicationTable } from '../core/application-model';

export function BuilderApplicationPaymentRule({ table, tables, roles, disabled, onSave }: {
  table: ApplicationTable; tables: ApplicationTable[]; roles: ApplicationRole[];
  disabled?: boolean; onSave(value?: ApplicationPaymentRule): void;
}) {
  const l = useLocalizer(), saved = table.payment;
  const [currency, setCurrency] = useState(saved?.currency ?? 'sek');
  const [itemUnitAmountFieldId, setPrice] = useState(saved?.itemUnitAmountFieldId ?? '');
  const [refundRoleId, setRole] = useState(saved?.refundRoleId ?? '');
  const item = tables.find(candidate => candidate.id === table.transaction?.itemTableId);
  const prices = item?.fields.filter(field => field.type === 'number' && field.required
    && !field.formula && field.id !== item.counter?.fieldId) ?? [];
  const valid = table.transaction?.counterDirection === 'decrement' && /^[a-z]{3}$/.test(currency)
    && prices.some(field => field.id === itemUnitAmountFieldId) && roles.some(role => role.id === refundRoleId);
  return <fieldset><legend>{l('Stripe order payments')}</legend>
    <p>{l('Prices use minor units: 100 means 1.00 SEK. Refunds require the selected role.')}</p>
    <p>{l('Payment setup is saved here. Publishing requires the verified order payment runtime.')}</p>
    <label>{l('Currency code')}<input disabled={disabled} value={currency} maxLength={3}
      onChange={event => setCurrency(event.target.value.toLowerCase())} /></label>
    <label>{l('Item price field')}<select disabled={disabled || !item} value={itemUnitAmountFieldId}
      onChange={event => setPrice(event.target.value)}><option value="">{l('Select a field')}</option>
      {prices.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label>
    <label>{l('Refund role')}<select disabled={disabled} value={refundRoleId} onChange={event => setRole(event.target.value)}>
      <option value="">{l('Select a role')}</option>{roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
    <button type="button" disabled={disabled || !valid} onClick={() => onSave({ provider: 'stripe', currency,
      itemUnitAmountFieldId, refundRoleId })}>{l('Save payment rule')}</button>
    {saved && <button type="button" disabled={disabled} onClick={() => onSave(undefined)}>{l('Remove payment rule')}</button>}
  </fieldset>;
}
