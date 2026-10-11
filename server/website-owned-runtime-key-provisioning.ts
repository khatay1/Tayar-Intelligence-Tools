import type { OwnedSupabaseCustody } from './website-owned-supabase-custody';

const projectRef = /^[a-z]{20}$/;
const keyId = /^[A-Za-z0-9_-]{3,200}$/;
const secretPrefix = ['sb', 'secret', ''].join('_');
const names = { preview: 'tayar-runtime-preview', production: 'tayar-runtime-production' } as const;

export interface OwnedSupabaseRuntimeKey {
  id: string;
  name: string;
  type: 'secret';
  apiKey: string;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
  return value as Record<string, unknown>;
}
function validCustody(custody: OwnedSupabaseCustody) {
  return projectRef.test(custody.projectRef) && ['preview', 'production'].includes(custody.environment)
    && typeof custody.accessToken === 'string' && custody.accessToken.length >= 20 && custody.accessToken.length <= 65_536
    && !/[\r\n]/.test(custody.accessToken);
}
function parseKey(value: unknown, expectedName: string): OwnedSupabaseRuntimeKey | null {
  const row = object(value);
  if (row.type !== 'secret' || row.name !== expectedName) return null;
  if (typeof row.id !== 'string' || !keyId.test(row.id) || typeof row.api_key !== 'string'
    || !row.api_key.startsWith(secretPrefix) || !/^[A-Za-z0-9_-]{16,200}$/.test(row.api_key.slice(secretPrefix.length))) throw new Error();
  return { id: row.id, name: expectedName, type: 'secret', apiKey: row.api_key };
}
async function boundedJson(response: Response): Promise<unknown> {
  if (Number(response.headers.get('content-length') ?? 0) > 131_072) throw new Error();
  const raw = await response.text(); if (raw.length > 131_072) throw new Error();
  return JSON.parse(raw);
}

/** Reads only the dedicated per-environment key from the exact customer
 * project. The value remains inside this server-only activation flow. */
export async function inspectOwnedSupabaseRuntimeKey(input: {
  custody: OwnedSupabaseCustody; fetcher?: typeof fetch;
}): Promise<OwnedSupabaseRuntimeKey | null> {
  try {
    if (typeof window !== 'undefined' || !validCustody(input.custody)) throw new Error();
    const response = await (input.fetcher ?? fetch)(`https://api.supabase.com/v1/projects/${input.custody.projectRef}/api-keys?reveal=true`, {
      method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8_000),
      headers: { Authorization: `Bearer ${input.custody.accessToken}`, Accept: 'application/json' },
    });
    if (response.status !== 200) throw new Error();
    const value = await boundedJson(response); if (!Array.isArray(value) || value.length > 64) throw new Error();
    const matches = value.map(item => parseKey(item, names[input.custody.environment])).filter((item): item is OwnedSupabaseRuntimeKey => !!item);
    if (matches.length > 1) throw new Error();
    return matches[0] ?? null;
  } catch { throw new Error('Customer Supabase runtime key unavailable.'); }
}

/** Final-activation mutation. A read-before-write and read-after-uncertainty
 * make retries converge on one named key; ambiguous duplicates fail closed. */
export async function ensureOwnedSupabaseRuntimeKey(input: {
  custody: OwnedSupabaseCustody; isCurrent(): boolean | Promise<boolean>; fetcher?: typeof fetch;
}): Promise<OwnedSupabaseRuntimeKey> {
  if (typeof window !== 'undefined' || !validCustody(input.custody) || !await input.isCurrent()) {
    throw new Error('Customer Supabase runtime key unavailable.');
  }
  const existing = await inspectOwnedSupabaseRuntimeKey(input); if (existing) return existing;
  const fetcher = input.fetcher ?? fetch, name = names[input.custody.environment];
  try {
    const response = await fetcher(`https://api.supabase.com/v1/projects/${input.custody.projectRef}/api-keys?reveal=true`, {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8_000),
      headers: { Authorization: `Bearer ${input.custody.accessToken}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'secret', name, description: 'Dedicated Tayar customer runtime key' }),
    });
    if (response.status === 201 && await input.isCurrent()) {
      const created = parseKey(await boundedJson(response), name); if (created) return created;
    }
  } catch { /* An uncertain create is reconciled by the named read below. */ }
  if (!await input.isCurrent()) throw new Error('Customer Supabase runtime key unavailable.');
  const reconciled = await inspectOwnedSupabaseRuntimeKey(input);
  if (!reconciled) throw new Error('Customer Supabase runtime key unavailable.');
  return reconciled;
}

/** Generated only during final activation, never while compiling source. */
export function generateOwnedCronSecret(random: Crypto = crypto): string {
  if (typeof window !== 'undefined') throw new Error('Cron credential generation unavailable.');
  const bytes = new Uint8Array(32); random.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
