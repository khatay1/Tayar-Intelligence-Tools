import type { ApplicationTable } from './application-model';
import { applicationBookingWithinSchedule } from './application-booking-schedule';

/** Only a confirmed database rejection can be corrected without reconciliation.
 * A pending retry from an earlier uncertain attempt keeps its original identity. */
export class ApplicationBookingRejected extends Error {
  constructor(public readonly reason: 'conflict' | 'interval' | 'schedule') {
    super(reason === 'conflict' ? 'This resource is already booked for that time.' : reason === 'schedule' ? 'Booking is outside working hours or exceeds the allowed duration.' : 'Booking end must be after start.');
    this.name = 'ApplicationBookingRejected';
  }
}

export function validateApplicationBookingValues(table: ApplicationTable, values: Record<string, unknown>) {
  if (!table.booking) return;
  const start = table.fields.find(field => field.id === table.booking!.startFieldId)!;
  const end = table.fields.find(field => field.id === table.booking!.endFieldId)!;
  // Partial updates remain authoritative in the database, which sees both values.
  if (values[start.key] === undefined || values[end.key] === undefined) return;
  const from = Date.parse(String(values[start.key])), to = Date.parse(String(values[end.key]));
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) throw new ApplicationBookingRejected('interval');
  const rule = table.booking;
  const status = rule.statusFieldId && table.fields.find(field => field.id === rule.statusFieldId);
  const value = status ? values[status.key] ?? status.defaultValue : undefined;
  if (rule.schedule && (!status || value === undefined || rule.blockingStatuses!.includes(String(value)))
    && !applicationBookingWithinSchedule(rule.schedule, from, to)) throw new ApplicationBookingRejected('schedule');
}

export function applicationBookingDatabaseRejection(table: ApplicationTable, error: { code?: string; message: string }) {
  if (!table.booking) return undefined;
  if (error.code === '23P01') return new ApplicationBookingRejected('conflict');
  if (error.code === '23514' && /app_booking_interval_/.test(error.message)) return new ApplicationBookingRejected('interval');
  if (error.code === '23514' && error.message === 'Application booking outside schedule') return new ApplicationBookingRejected('schedule');
  return undefined;
}
