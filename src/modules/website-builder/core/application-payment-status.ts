export const applicationPaymentStates = ['unpaid', 'pending', 'paid', 'payment-failed', 'refund-pending', 'partially-refunded', 'refunded', 'refund-failed'] as const;
export interface ApplicationPaymentStatus {
  status: typeof applicationPaymentStates[number]; currency: string;
  amountDue: number; amountPaid: number; amountRefunded: number;
}
export function parseApplicationPaymentStatus(value: unknown): ApplicationPaymentStatus {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid payment status.');
  const row = value as Record<string, unknown>;
  if (Object.keys(row).sort().join(',') !== 'amountDue,amountPaid,amountRefunded,currency,status'
    || !applicationPaymentStates.includes(row.status as ApplicationPaymentStatus['status'])
    || typeof row.currency !== 'string' || !/^[a-z]{3}$/.test(row.currency)
    || ['amountDue', 'amountPaid', 'amountRefunded'].some(key => !Number.isSafeInteger(row[key]) || (row[key] as number) < 0 || (row[key] as number) > 99_999_999_999)
    || (row.amountDue as number) < 1 || (row.amountPaid as number) > (row.amountDue as number)
    || (row.amountRefunded as number) > (row.amountPaid as number)) throw new Error('Invalid payment status.');
  return row as unknown as ApplicationPaymentStatus;
}
