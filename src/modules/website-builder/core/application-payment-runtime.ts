import { parseApplicationPaymentStatus } from './application-payment-status';
/** Browser boundary for customer-owned order payments. Amounts for checkout
 * are resolved only by the server from the frozen order quote. */
export function createApplicationPaymentRuntime(origin: string | undefined,
  captureToken: (owner: string) => Promise<string | undefined>,
  assertIdentity: (owner: string) => Promise<void>, fetcher: typeof fetch = fetch) {
  async function request(tableId: string, action: 'checkout' | 'refund' | 'status', body: Record<string, unknown>, owner: string) {
    if (!origin || new URL(origin).origin !== origin || typeof location === 'undefined' || location.origin !== origin
      || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(tableId)) throw new Error('Owned payment runtime is unavailable.');
    const token = await captureToken(owner);
    if (!token) throw new Error('Payment identity is unavailable.');
    const response = await fetcher(`${origin}/api/stripe-order/${tableId}/${action}`, {
      method: 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    });
    if (response.status !== (action === 'refund' ? 202 : 200)) throw new Error('Payment outcome is uncertain. Retry the same operation.');
    const raw = await response.text();
    if (raw.length > 4096) throw new Error('Invalid payment response.');
    const value: unknown = JSON.parse(raw);
    await assertIdentity(owner);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid payment response.');
    return value as Record<string, unknown>;
  }
  const uuid = (value: string) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error('Invalid payment identity.');
    return value;
  };
  return {
    available: !!origin,
    async status(tableId: string, orderId: string, owner: string) {
      return parseApplicationPaymentStatus(await request(tableId, 'status', { orderId: uuid(orderId) }, owner));
    },
    async checkout(tableId: string, orderId: string, operationId: string, owner: string) {
      const value = await request(tableId, 'checkout', { checkoutId: tableId, orderId: uuid(orderId), operationId: uuid(operationId) }, owner);
      if (Object.keys(value).join(',') !== 'url' || typeof value.url !== 'string') throw new Error('Invalid checkout response.');
      const url = new URL(value.url);
      if (url.origin !== 'https://checkout.stripe.com' || url.username || url.password) throw new Error('Invalid checkout destination.');
      return url.href;
    },
    async refund(tableId: string, orderId: string, operationId: string, amount: number, owner: string) {
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > 99_999_999_999) throw new Error('Invalid refund amount.');
      const value = await request(tableId, 'refund', { orderId: uuid(orderId), operationId: uuid(operationId), amount }, owner);
      if (Object.keys(value).join(',') !== 'status' || !['pending', 'succeeded'].includes(String(value.status))) throw new Error('Invalid refund response.');
      return value.status as 'pending' | 'succeeded';
    },
  };
}
