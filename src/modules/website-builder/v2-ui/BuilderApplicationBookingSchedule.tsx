import { useLocalizer } from '@/lib/ui-localization-cms';
import type { ApplicationBookingSchedule } from '../core/application-model';
import { validApplicationBookingSchedule } from '../core/application-booking-schedule';
export function BuilderApplicationBookingSchedule({ value, disabled, onChange }: {
  value?: ApplicationBookingSchedule; disabled?: boolean; onChange(value?: ApplicationBookingSchedule): void;
}) {
  const l = useLocalizer();
  const time = (minute: number) => `${String(Math.floor((minute % 1440) / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  const minute = (input: string, end: boolean) => {
    if (!/^\d{2}:\d{2}$/.test(input)) return NaN;
    const [hour, minutes] = input.split(':').map(Number); return hour * 60 + minutes || (end ? 1440 : 0);
  };
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return <fieldset disabled={disabled} data-testid="application-booking-schedule"><legend>{l('Booking working hours')}</legend>
    <label><input type="checkbox" checked={!!value} onChange={event => onChange(event.target.checked
      ? { timeZone: 'Europe/Stockholm', maxDurationMinutes: 120, weekly: [1, 2, 3, 4, 5].map(day => ({ day, startMinute: 540, endMinute: 1020 })) } : undefined)} />{l('Restrict bookings to working hours')}</label>
    {value && <>
      <p>{l('Hours use the selected time zone. Midnight as an end means the end of that day. Cancelled states release the time.')}</p>
      <label>{l('Booking time zone')}<input value={value.timeZone} maxLength={80} placeholder="Europe/Stockholm" onChange={event => onChange({ ...value, timeZone: event.target.value })} /></label>
      <label>{l('Maximum booking duration (minutes)')}<input type="number" min={1} max={1440} step={1} value={value.maxDurationMinutes} onChange={event => onChange({ ...value, maxDurationMinutes: Number(event.target.value) })} /></label>
      {value.weekly.map((window, index) => {
        const update = (patch: Partial<typeof window>) => onChange({ ...value, weekly: value.weekly.map((item, other) => other === index ? { ...item, ...patch } : item) });
        return <div key={index} className="builder-v2-grid">
          <label>{l('Working day')}<select value={window.day} onChange={event => update({ day: Number(event.target.value) })}>{days.map((day, dayIndex) => <option key={day} value={dayIndex + 1}>{l(day)}</option>)}</select></label>
          <label>{l('Opening time')}<input type="time" value={Number.isFinite(window.startMinute) ? time(window.startMinute) : ''} onChange={event => update({ startMinute: minute(event.target.value, false) })} /></label>
          <label>{l('Closing time')}<input type="time" value={Number.isFinite(window.endMinute) ? time(window.endMinute) : ''} onChange={event => update({ endMinute: minute(event.target.value, true) })} /></label>
          <button type="button" onClick={() => onChange({ ...value, weekly: value.weekly.filter((_, other) => other !== index) })}>{l('Remove working period')}</button>
        </div>;
      })}
      <button type="button" disabled={value.weekly.length >= 28} onClick={() => onChange({ ...value, weekly: [...value.weekly, { day: 1, startMinute: 540, endMinute: 1020 }] })}>{l('Add working period')}</button>
      {!validApplicationBookingSchedule(value) && <p role="alert">{l('Choose a valid time zone and non-overlapping working periods.')}</p>}
    </>}
  </fieldset>;
}
