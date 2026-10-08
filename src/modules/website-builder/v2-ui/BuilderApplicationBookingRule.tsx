import { useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import type { ApplicationBookingRule, ApplicationTable } from '../core/application-model';

export function BuilderApplicationBookingRule({ table, disabled, onSave }: {
  table: ApplicationTable; disabled?: boolean; onSave(booking?: ApplicationBookingRule): void;
}) {
  const l = useLocalizer();
  const [resource, setResource] = useState(table.booking?.resourceFieldId ?? '');
  const [start, setStart] = useState(table.booking?.startFieldId ?? '');
  const [end, setEnd] = useState(table.booking?.endFieldId ?? '');
  const [status, setStatus] = useState(table.booking?.statusFieldId ?? '');
  const [blocking, setBlocking] = useState(table.booking?.blockingStatuses ?? []);
  const resources = table.fields.filter(field => field.required && ['uuid', 'reference'].includes(field.type));
  const times = table.fields.filter(field => field.required && field.type === 'datetime');
  const statuses = table.fields.filter(field => field.required && field.type === 'enum');
  const statusField = statuses.find(field => field.id === status);
  const valid = resources.some(field => field.id === resource) && times.some(field => field.id === start)
    && times.some(field => field.id === end) && start !== end && (!status || (!!statusField && blocking.length > 0));
  return <fieldset data-testid="application-booking-rule"><legend>{l('Booking conflict protection')}</legend>
    <p>{l('One resource cannot have overlapping bookings. Adjacent times are allowed. Cancelled states can release the time.')}</p>
    <label>{l('Booking resource')}<select disabled={disabled} value={resource} onChange={event => setResource(event.target.value)}>
      <option value="">{l('Select a field')}</option>{resources.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
    </select></label>
    <label>{l('Booking start')}<select disabled={disabled} value={start} onChange={event => setStart(event.target.value)}>
      <option value="">{l('Select a field')}</option>{times.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
    </select></label>
    <label>{l('Booking end')}<select disabled={disabled} value={end} onChange={event => setEnd(event.target.value)}>
      <option value="">{l('Select a field')}</option>{times.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
    </select></label>
    <label>{l('Booking status')}<select disabled={disabled} value={status} onChange={event => {
      setStatus(event.target.value); setBlocking(statuses.find(field => field.id === event.target.value)?.options ?? []);
    }}><option value="">{l('Every booking blocks time')}</option>{statuses.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label>
    {statusField && <fieldset><legend>{l('States that block time')}</legend>{statusField.options?.map(value => <label key={value}>
      <input type="checkbox" disabled={disabled} checked={blocking.includes(value)} onChange={event => setBlocking(current => event.target.checked ? [...current, value] : current.filter(item => item !== value))} />{value}
    </label>)}</fieldset>}
    <button type="button" disabled={disabled || !valid} onClick={() => onSave({ resourceFieldId: resource, startFieldId: start, endFieldId: end,
      ...(status ? { statusFieldId: status, blockingStatuses: blocking } : {}) })}>{l('Save booking rule')}</button>
    {table.booking && <button type="button" disabled={disabled} onClick={() => onSave(undefined)}>{l('Remove booking rule')}</button>}
  </fieldset>;
}
