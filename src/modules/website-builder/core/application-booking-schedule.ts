import type { ApplicationBookingSchedule } from './application-model';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function validApplicationBookingSchedule(value: unknown): value is ApplicationBookingSchedule {
  if (!object(value) || Object.keys(value).some(key => !['maxDurationMinutes', 'timeZone', 'weekly', 'exceptions'].includes(key))
    || typeof value.timeZone !== 'string' || value.timeZone.length > 80 || !/^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/.test(value.timeZone)
    || !Number.isInteger(value.maxDurationMinutes) || Number(value.maxDurationMinutes) < 1 || Number(value.maxDurationMinutes) > 1440
    || !Array.isArray(value.weekly) || !value.weekly.length || value.weekly.length > 28) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: value.timeZone }).format(0); } catch { return false; }
  for (const window of value.weekly) {
    if (!object(window) || Object.keys(window).sort().join(',') !== 'day,endMinute,startMinute'
      || !Number.isInteger(window.day) || Number(window.day) < 1 || Number(window.day) > 7
      || !Number.isInteger(window.startMinute) || Number(window.startMinute) < 0
      || !Number.isInteger(window.endMinute) || Number(window.endMinute) > 1440 || Number(window.endMinute) <= Number(window.startMinute)) return false;
  }
  const windows = value.weekly as ApplicationBookingSchedule['weekly'];
  if (windows.some((left, index) => windows.some((right, other) => other > index && left.day === right.day
    && left.startMinute < right.endMinute && right.startMinute < left.endMinute))) return false;
  if (value.exceptions !== undefined) {
    if (!Array.isArray(value.exceptions) || value.exceptions.length > 366) return false;
    const dates = new Set<string>();
    for (const exception of value.exceptions) {
      if (!object(exception) || Object.keys(exception).sort().join(',') !== 'date,windows' || typeof exception.date !== 'string'
        || (!/^\d{4}-\d{2}-\d{2}$/.test(exception.date) || exception.date.startsWith('0000-')) || !Number.isFinite(Date.parse(exception.date))
        || new Date(exception.date).toISOString().slice(0, 10) !== exception.date || dates.has(exception.date)
        || !Array.isArray(exception.windows) || exception.windows.length > 4) return false;
      dates.add(exception.date);
      for (const window of exception.windows) {
        if (!object(window) || Object.keys(window).sort().join(',') !== 'endMinute,startMinute' || !Number.isInteger(window.startMinute)
          || !Number.isInteger(window.endMinute) || Number(window.startMinute) < 0 || Number(window.endMinute) > 1440
          || Number(window.startMinute) >= Number(window.endMinute)) return false;
      }
      const special = exception.windows as Array<{ startMinute: number; endMinute: number }>;
      if (special.some((left, index) => special.some((right, other) => other > index && left.startMinute < right.endMinute && right.startMinute < left.endMinute))) return false;
    }
  }
  return true;
}

/** Check absolute instants against local business hours. Actual elapsed time
 * controls duration; local wall time controls the declared weekly windows. */
export function applicationBookingWithinSchedule(schedule: ApplicationBookingSchedule, from: number, to: number) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || to - from > schedule.maxDurationMinutes * 60_000) return false;
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: schedule.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const local = (time: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(time).map(part => [part.type, part.value]));
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)) + ((time % 1000) + 1000) % 1000;
  };
  const start = local(from), end = local(to), date = new Date(start);
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()), day = date.getUTCDay() || 7;
  const exception = schedule.exceptions?.find(exception => exception.date === date.toISOString().slice(0, 10));
  const windows = exception ? exception.windows : schedule.weekly.filter(window => window.day === day);
  return start < end && windows.some(window =>
    start >= midnight + window.startMinute * 60_000 && end <= midnight + window.endMinute * 60_000);
}

export function formatApplicationBookingSchedule(schedule: ApplicationBookingSchedule, locale: 'en' | 'ar' | 'sv') {
  const day = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });
  const time = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  const duration = new Intl.NumberFormat(locale, { style: 'unit', unit: 'minute', unitDisplay: 'long' }).format(schedule.maxDurationMinutes);
  const closed = { en: 'Closed', ar: 'مغلق', sv: 'Stängt' }[locale];
  return `${schedule.timeZone} · ${schedule.weekly.map(window => `${day.format(Date.UTC(2026, 0, 4 + window.day))} ${time(window.startMinute)}–${time(window.endMinute)}`).join(' · ')} · ≤ ${duration}`
    + (schedule.exceptions?.length ? ` · ${schedule.exceptions.map(exception => `${exception.date}: ${exception.windows.length ? exception.windows.map(window => `${time(window.startMinute)}–${time(window.endMinute)}`).join(', ') : closed}`).join(' · ')}` : '');
}
