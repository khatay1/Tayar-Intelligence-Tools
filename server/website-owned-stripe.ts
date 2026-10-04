const account = /^acct_[A-Za-z0-9]{8,64}$/;
const publishable = /^pk_(test|live)_[A-Za-z0-9]+$/;
const privateKey = /^(sk|rk)_(test|live)_[A-Za-z0-9]+$/;

export interface OwnedStripeAccountProof {
  accountId: string;
  keyType: 'restricted' | 'secret';
  mode: 'test' | 'live';
  chargesEnabled: boolean;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
  return value as Record<string, unknown>;
}

/** Server-only proof for a user-owned Stripe credential. The key is used only
 * for this bounded request and is never returned, persisted or included in an
 * error. Restricted keys are preferred; secret keys remain supported for
 * customer accounts that have not migrated yet. */
export async function verifyOwnedStripeAccount(input: {
  secretKey: string;
  publishableKey: string;
  environment: 'preview' | 'production';
  isCurrent(): boolean | Promise<boolean>;
  fetcher?: typeof fetch;
}): Promise<OwnedStripeAccountProof> {
  try {
    if (typeof window !== 'undefined' || !['preview', 'production'].includes(input.environment)
      || !await input.isCurrent()) throw new Error();
    const publicMatch = publishable.exec(input.publishableKey);
    const privateMatch = privateKey.exec(input.secretKey);
    const expectedMode = input.environment === 'production' ? 'live' : 'test';
    if (!publicMatch || !privateMatch || publicMatch[1] !== expectedMode || privateMatch[2] !== expectedMode
      || input.secretKey.length > 4096 || /[\r\n]/.test(input.secretKey)) throw new Error();
    const response = await (input.fetcher ?? fetch)('https://api.stripe.com/v1/account', {
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${input.secretKey}`, Accept: 'application/json' },
    });
    if (response.status !== 200 || Number(response.headers.get('content-length') ?? 0) > 131072
      || !await input.isCurrent()) throw new Error();
    const text = await response.text();
    if (text.length > 131072 || !await input.isCurrent()) throw new Error();
    const value = object(JSON.parse(text));
    if (value.object !== 'account' || typeof value.id !== 'string' || !account.test(value.id)
      || typeof value.charges_enabled !== 'boolean'
      || (input.environment === 'production' && value.charges_enabled !== true)) throw new Error();
    return {
      accountId: value.id,
      keyType: privateMatch[1] === 'rk' ? 'restricted' : 'secret',
      mode: expectedMode,
      chargesEnabled: value.charges_enabled,
    };
  } catch {
    throw new Error('Stripe account verification unavailable.');
  }
}
