/** Server-only transport. A durable claim must commit before any provider call. */
export interface OwnedEmailJob {
  id: string;
  projectId: string;
  connectionId: string;
  environment: 'preview' | 'staging' | 'production';
  from: string;
  to: string;
  subject: string;
  text: string;
}

export interface OwnedEmailClaim {
  job: OwnedEmailJob;
  leaseId: string;
  attempt: number;
  firstAttemptAt: string;
  leaseExpiresAt: string;
}

export type OwnedEmailOutcome =
  | { status: 'accepted'; providerId: string }
  | { status: 'retry'; code: string; retryAt: string }
  | { status: 'failed' | 'review'; code: string };

export interface OwnedEmailStore {
  /** Atomically freeze the credential fingerprint, lease, attempt and first attempt time.
   * Return null for an active lease, terminal job, delayed retry or changed binding.
   * A changed binding must transition to review, never reset the idempotency window. */
  claim(input: { jobId: string; projectId: string; environment: OwnedEmailJob['environment'];
    connectionId: string; credentialFingerprint: string; from: string; leaseId: string }): Promise<OwnedEmailClaim | null>;
  /** Compare lease AND its expiry before writing; return false for a superseded lease. */
  finish(input: { jobId: string; leaseId: string; outcome: OwnedEmailOutcome }): Promise<boolean>;
}

export interface OwnedEmailWorkerInput {
  jobId: string;
  projectId: string;
  connectionId: string;
  environment: OwnedEmailJob['environment'];
  from: string;
  apiKey: string;
  store: OwnedEmailStore;
  fetcher?: typeof fetch;
  now?: () => Date;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const email = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/;
export const OWNED_EMAIL_RETRY_WINDOW_MS = 20 * 60 * 60 * 1000;
export const OWNED_EMAIL_MAX_ATTEMPTS = 8;

export function isOwnedEmailAddress(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && email.test(value)
    && !value.includes('..') && !value.includes('@.') && !value.includes('.@');
}

function validJob(job: OwnedEmailJob, input: OwnedEmailWorkerInput) {
  return job.id === input.jobId && job.projectId === input.projectId && job.connectionId === input.connectionId && job.environment === input.environment
    && job.from === input.from && isOwnedEmailAddress(job.from) && isOwnedEmailAddress(job.to)
    && typeof job.subject === 'string' && job.subject.trim().length > 0 && job.subject.length <= 400 && Array.from(job.subject).length <= 200
    && !Array.from(job.subject).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    && typeof job.text === 'string' && job.text.trim().length > 0 && job.text.length <= 64000
    && Array.from(job.text).length <= 32000 && !job.text.includes('\0');
}

async function fingerprint(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function retryOutcome(attempt: number, now: number, deadline: number, code: string): OwnedEmailOutcome {
  const retryAt = now + Math.min(30 * 60 * 1000, 30_000 * 2 ** Math.max(0, attempt - 1));
  if (attempt >= OWNED_EMAIL_MAX_ATTEMPTS || retryAt >= deadline) return { status: 'review', code: 'retry_limit' };
  return { status: 'retry', code, retryAt: new Date(retryAt).toISOString() };
}

async function providerJson(response: Response): Promise<unknown> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { return null; }
  } finally { reader.releaseLock(); }
}

/** Accepted means Resend accepted a request, not that the recipient received it.
 * There is deliberately no fallback sender, credential, payload or idempotency key. */
export async function deliverOwnedEmail(input: OwnedEmailWorkerInput): Promise<
  { status: 'unavailable' | 'idle' | 'uncertain' } | (OwnedEmailOutcome & { attempt: number })> {
  // Snapshot primitive scope/credential values before the first await. Configuration
  // rotation during a claim must not fingerprint one key and send with another.
  input = { ...input };
  if (typeof window !== 'undefined' || !uuid.test(input.jobId) || !uuid.test(input.projectId)
    || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(input.connectionId)
    || !['preview', 'staging', 'production'].includes(input.environment) || !isOwnedEmailAddress(input.from)
    || typeof input.apiKey !== 'string' || !/^re_[A-Za-z0-9_-]{16,200}$/.test(input.apiKey)) return { status: 'unavailable' };
  const leaseId = crypto.randomUUID();
  let claim: OwnedEmailClaim | null;
  try {
    claim = await input.store.claim({ jobId: input.jobId, projectId: input.projectId,
      environment: input.environment, connectionId: input.connectionId, from: input.from, leaseId,
      credentialFingerprint: await fingerprint(input.apiKey) });
  } catch { return { status: 'unavailable' }; }
  if (!claim) return { status: 'idle' };

  // Do not contact the provider with a malformed or cross-scope store response.
  if (!claim.job || claim.leaseId !== leaseId || !validJob(claim.job, input) || !Number.isInteger(claim.attempt)
    || claim.attempt < 1 || claim.attempt > OWNED_EMAIL_MAX_ATTEMPTS) return { status: 'unavailable' };
  const firstAttempt = Date.parse(claim.firstAttemptAt);
  const now = () => (input.now?.() ?? new Date()).getTime();
  const deadline = firstAttempt + OWNED_EMAIL_RETRY_WINDOW_MS;
  if (Date.parse(claim.leaseExpiresAt) < now() + 12_000 || !Number.isFinite(Date.parse(claim.leaseExpiresAt))) {
    return { status: 'unavailable' };
  }
  let outcome: OwnedEmailOutcome;
  if (!Number.isFinite(firstAttempt) || firstAttempt > now() + 60_000 || now() >= deadline) {
    outcome = { status: 'review', code: 'idempotency_window_expired' };
  } else {
    const job = claim.job;
    // Fixed order and frozen values preserve exactly the same bytes across retries.
    const body = JSON.stringify({ from: job.from, to: [job.to], subject: job.subject, text: job.text });
    try {
      const response = await (input.fetcher ?? fetch)('https://api.resend.com/emails', {
        method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${input.apiKey}`, 'Content-Type': 'application/json',
          'Idempotency-Key': `tayar-email:${job.projectId}:${job.environment}:${job.id}` }, body,
      });
      if (response.status >= 200 && response.status < 300) {
        const result = await providerJson(response);
        const id = result && typeof result === 'object' && !Array.isArray(result)
          ? (result as Record<string, unknown>).id : undefined;
        outcome = typeof id === 'string' && uuid.test(id)
          ? { status: 'accepted', providerId: id }
          : retryOutcome(claim.attempt, now(), deadline, 'invalid_receipt');
      } else if (response.status === 409) {
        // Concurrent requests can retry; changed payload/account must be reconciled.
        const error = await providerJson(response);
        const name = error && typeof error === 'object' ? (error as Record<string, unknown>).name : null;
        outcome = name === 'concurrent_idempotent_requests'
          ? retryOutcome(claim.attempt, now(), deadline, 'provider_busy')
          : { status: 'review', code: 'idempotency_conflict' };
      } else if ([408, 425, 429].includes(response.status) || response.status >= 500) {
        outcome = retryOutcome(claim.attempt, now(), deadline, `http_${response.status}`);
      } else {
        outcome = { status: 'failed', code: `http_${response.status}` };
      }
    } catch {
      // A lost response can mean the provider accepted it. Keep the same durable ID.
      outcome = retryOutcome(claim.attempt, now(), deadline, 'response_unconfirmed');
    }
  }
  try {
    return await input.store.finish({ jobId: input.jobId, leaseId, outcome })
      ? { ...outcome, attempt: claim.attempt } : { status: 'uncertain' };
  } catch { return { status: 'uncertain' }; }
}
