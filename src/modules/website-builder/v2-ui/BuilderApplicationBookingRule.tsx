import { useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization-cms';
import type { ApplicationBookingRule, ApplicationTable } from '../core/application-model';
import { validApplicationBookingSchedule } from '../core/application-booking-schedule';
import { BuilderApplicationBookingSchedule } from './BuilderApplicationBookingSchedule';
import { validBookingRecurrenceRule } from '../core/application-booking-recurrence';

export function BuilderApplicationBookingRule({ table, disabled, onSave }: {
  table: ApplicationTable; disabled?: boolean; onSave(booking?: ApplicationBookingRule): void;
}) {
  const l = useLocalizer();
  const [resource, setResource] = useState(table.booking?.resourceFieldId ?? '');
  const [extras, setExtras] = useState(table.booking?.additionalResourceFieldIds ?? []);
  const [start, setStart] = useState(table.booking?.startFieldId ?? '');
  const [end, setEnd] = useState(table.booking?.endFieldId ?? '');
  const [status, setStatus] = useState(table.booking?.statusFieldId ?? '');
  const [blocking, setBlocking] = useState(table.booking?.blockingStatuses ?? []);
  const [waiting, setWaiting] = useState(table.booking?.waitlistStatus ?? '');
  const [schedule, setSchedule] = useState(table.booking?.schedule);
  const [recurrence, setRecurrence] = useState(table.booking?.recurrence);
  const resources = table.fields.filter(field => field.required && ['uuid', 'reference'].includes(field.type));
  const times = table.fields.filter(field => field.required && field.type === 'datetime');
  const statuses = table.fields.filter(field => field.required && field.type === 'enum');
  const statusField = statuses.find(field => field.id === status);
  const selectedResources = [resources.find(field => field.id === resource), ...extras.map(id => resources.find(field => field.id === id))];
  const validExtras = !extras.length || extras.length <= 4 && selectedResources.every(field => field?.type === 'reference')
    && new Set(selectedResources.map(field => field?.referenceTableId)).size === selectedResources.length;
  const valid = resources.some(field => field.id === resource) && times.some(field => field.id === start)
    && times.some(field => field.id === end) && start !== end && (!status || (!!statusField && blocking.length > 0))
    && validExtras && (!schedule || validApplicationBookingSchedule(schedule))
    && (!waiting || !!statusField?.options?.includes(waiting) && !blocking.includes(waiting) && table.workflow?.fieldId !== status)
    && (!recurrence || validBookingRecurrenceRule(recurrence) && (!schedule || recurrence.timeZone === schedule.timeZone));
  return <fieldset data-testid="application-booking-rule"><legend>{l('Booking conflict protection')}</legend>
    <p>{l('One resource cannot have overlapping bookings. Adjacent times are allowed. Cancelled states can release the time.')}</p>
    <label>{l('Booking resource')}<select disabled={disabled} value={resource} onChange={event => { setResource(event.target.value); setExtras([]); }}>
      <option value="">{l('Select a field')}</option>{resources.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
    </select></label>
    <fieldset disabled={disabled}><legend>{l('Additional booking resources')}</legend>
      <p>{l('Each resource type uses a separate referenced table. All selected resources reserve the same interval atomically.')}</p>
      {resources.filter(field => field.id !== resource && field.type === 'reference').map(field => <label key={field.id}>
        <input type="checkbox" checked={extras.includes(field.id)} disabled={!extras.includes(field.id) && (extras.length >= 4
          || selectedResources.some(selected => selected?.type !== 'reference' || selected.referenceTableId === field.referenceTableId))}
          onChange={event => setExtras(current => event.target.checked ? [...current, field.id] : current.filter(id => id !== field.id))} />{field.name}
      </label>)}
    </fieldset>
    <label>{l('Booking start')}<select disabled={disabled} value={start} onChange={event => setStart(event.target.value)}>
      <option value="">{l('Select a field')}</option>{times.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
    </select></label>
    <label>{l('Booking end')}<select disabled={disabled} value={end} onChange={event => setEnd(event.target.value)}>
      <option value="">{l('Select a field')}</option>{times.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
    </select></label>
    <label>{l('Booking status')}<select disabled={disabled} value={status} onChange={event => {
      setStatus(event.target.value); setWaiting(''); setBlocking(statuses.find(field => field.id === event.target.value)?.options ?? []);
    }}><option value="">{l('Every booking blocks time')}</option>{statuses.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label>
    {statusField && <fieldset><legend>{l('States that block time')}</legend>{statusField.options?.map(value => <label key={value}>
      <input type="checkbox" disabled={disabled} checked={blocking.includes(value)} onChange={event => setBlocking(current => event.target.checked ? [...current, value] : current.filter(item => item !== value))} />{value}
    </label>)}</fieldset>}
    {statusField && table.workflow?.fieldId !== status && <label>{l('Waiting list status')}<select disabled={disabled} value={waiting} onChange={event => setWaiting(event.target.value)}>
      <option value="">{l('No waiting list')}</option>{statusField.options?.filter(value => !blocking.includes(value)).map(value => <option key={value} value={value}>{value}</option>)}
    </select></label>}
    <BuilderApplicationBookingSchedule value={schedule} disabled={disabled} onChange={setSchedule} />
    <fieldset disabled={disabled}><legend>{l('Recurring bookings')}</legend>
      <label><input type="checkbox" checked={!!recurrence} onChange={event => setRecurrence(event.target.checked ? { timeZone: schedule?.timeZone ?? 'Europe/Stockholm', maxOccurrences: 12 } : undefined)} />{l('Allow daily and weekly booking series')}</label>
      {recurrence && <>
        <label>{l('Booking time zone')}<input value={recurrence.timeZone} maxLength={80} onChange={event => setRecurrence({ ...recurrence, timeZone: event.target.value })} /></label>
        <label>{l('Maximum occurrences')}<input type="number" min={2} max={52} step={1} value={recurrence.maxOccurrences} onChange={event => setRecurrence({ ...recurrence, maxOccurrences: Number(event.target.value) })} /></label>
        <p>{l('Series use local calendar time and save all appointments together. The zone must match working hours. Ambiguous or nonexistent times are rejected.')}</p>
      </>}
    </fieldset>
    <button type="button" disabled={disabled || !valid} onClick={() => onSave({ resourceFieldId: resource, startFieldId: start, endFieldId: end,
      ...(schedule ? { schedule } : {}),
      ...(extras.length ? { additionalResourceFieldIds: extras } : {}),
      ...(waiting ? { waitlistStatus: waiting } : {}),
      ...(recurrence ? { recurrence } : {}),
      ...(status ? { statusFieldId: status, blockingStatuses: blocking } : {}) })}>{l('Save booking rule')}</button>
    {table.booking && <button type="button" disabled={disabled} onClick={() => onSave(undefined)}>{l('Remove booking rule')}</button>}
  </fieldset>;
}
