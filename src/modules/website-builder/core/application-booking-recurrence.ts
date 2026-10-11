import type { ApplicationTable } from './application-model';
import { validateApplicationBookingValues } from './application-booking';
export interface ApplicationBookingRecurrence { frequency: 'daily' | 'weekly'; interval: number; count: number }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function validBookingRecurrenceRule(value: unknown): value is { timeZone: string; maxOccurrences: number } {
  if (!object(value) || Object.keys(value).sort().join(',') !== 'maxOccurrences,timeZone' || typeof value.timeZone !== 'string'
    || !/^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/.test(value.timeZone) || value.timeZone.length > 80
    || !Number.isInteger(value.maxOccurrences) || Number(value.maxOccurrences) < 2 || Number(value.maxOccurrences) > 52) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: value.timeZone }).format(0); return true; } catch { return false; }
}

/** Preserve local calendar times across DST. Nonexistent or ambiguous later
 * occurrences fail before writing; never silently shift an appointment. */
export function expandApplicationBookingRecurrence(table: ApplicationTable, values: Record<string, unknown>, input: unknown) {
  const rule = table.booking?.recurrence;
  if (!rule || !object(input) || Object.keys(input).sort().join(',') !== 'count,frequency,interval'
    || !['daily', 'weekly'].includes(String(input.frequency)) || !Number.isInteger(input.interval) || Number(input.interval) < 1 || Number(input.interval) > 12
    || !Number.isInteger(input.count) || Number(input.count) < 2 || Number(input.count) > rule.maxOccurrences) throw new Error('Invalid booking recurrence.');
  const repeat = input as unknown as ApplicationBookingRecurrence;
  const days = repeat.interval * (repeat.frequency === 'weekly' ? 7 : 1);
  if (days * (repeat.count - 1) > 366) throw new Error('Booking recurrence exceeds one year.');
  const startKey = table.fields.find(field => field.id === table.booking!.startFieldId)!.key;
  const endKey = table.fields.find(field => field.id === table.booking!.endFieldId)!.key;
  const from = Date.parse(String(values[startKey])), to = Date.parse(String(values[endKey]));
  validateApplicationBookingValues(table, values);
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: rule.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const local = (time: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(time).map(part => [part.type, part.value]));
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)) + ((time % 1000) + 1000) % 1000;
  };
  const resolve = (wallTime: number) => {
    const candidates = new Set<number>();
    for (let offset = -36; offset <= 36; offset += 6) {
      const sample = wallTime + offset * 3_600_000, candidate = wallTime - (local(sample) - sample);
      if (local(candidate) === wallTime) candidates.add(candidate);
    }
    if (candidates.size !== 1) throw new Error('Recurring booking time is ambiguous or does not exist. Choose another time.');
    return [...candidates][0];
  };
  const fromLocal = local(from), toLocal = local(to);
  return Array.from({ length: repeat.count }, (_, index) => {
    const delta = index * days * 86_400_000;
    const row = { ...values, [startKey]: new Date(index ? resolve(fromLocal + delta) : from).toISOString(),
      [endKey]: new Date(index ? resolve(toLocal + delta) : to).toISOString() };
    validateApplicationBookingValues(table, row); return row;
  });
}

export async function applicationBookingOccurrenceIds(tableId: string, owner: string, requestId: string, count: number, cryptography: Pick<Crypto, 'subtle'> = crypto) {
  if (!Number.isInteger(count) || count < 2 || count > 52) throw new Error('Invalid occurrence count.');
  return Promise.all(Array.from({ length: count }, async (_, index) => {
    const digest = await cryptography.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(['tayar-booking-series-v1', tableId, owner.toLowerCase(), requestId.toLowerCase(), index])));
    const bytes = new Uint8Array(digest).slice(0, 16); bytes[6] = (bytes[6] & 15) | 128; bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }));
}
