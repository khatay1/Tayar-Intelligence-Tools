import { deliverOwnedEmail, isOwnedEmailAddress, type OwnedEmailJob } from './website-owned-email-delivery';
import { createOwnedEmailStore, type OwnedEmailRpcClient } from './website-owned-email-store';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export interface OwnedEmailWorkerConnection { id: string; from: string; apiKey: string }
export interface OwnedEmailBatchCounts {
  scanned: number; accepted: number; retry: number; review: number; failed: number;
  idle: number; uncertain: number; unavailable: number;
}

export function validateOwnedEmailWorkerScope(input: {
  projectId: string; environment: OwnedEmailJob['environment']; connections: readonly OwnedEmailWorkerConnection[];
}) {
  if (typeof window !== 'undefined' || !uuid.test(input.projectId)
    || !['preview', 'staging', 'production'].includes(input.environment)
    || !Array.isArray(input.connections) || input.connections.length < 1 || input.connections.length > 10) throw new Error('Email worker scope unavailable.');
  const ids = new Set<string>();
  for (const connection of input.connections) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(connection.id) || ids.has(connection.id)
      || !isOwnedEmailAddress(connection.from) || typeof connection.apiKey !== 'string'
      || !/^re_[A-Za-z0-9_-]{16,200}$/.test(connection.apiKey)) throw new Error('Email worker scope unavailable.');
    ids.add(connection.id);
  }
}

/** Bounded sequential worker. Due queries do not lease jobs: the delivery claim
 * still serializes overlapping cron invocations before their provider calls. */
export async function drainOwnedEmailQueue(input: {
  projectId: string; environment: OwnedEmailJob['environment']; connections: readonly OwnedEmailWorkerConnection[];
  client: OwnedEmailRpcClient; fetcher?: typeof fetch; now?: () => Date;
  /** Injectable monotonic clock for budget tests, separate from retry timestamps. */
  monotonicNow?: () => number;
}): Promise<OwnedEmailBatchCounts> {
  input = { ...input, connections: input.connections.map(connection => ({ ...connection })) };
  validateOwnedEmailWorkerScope(input);
  const started = (input.monotonicNow ?? (() => performance.now()))();
  const elapsed = () => (input.monotonicNow ?? (() => performance.now()))() - started;
  const counts: OwnedEmailBatchCounts = { scanned: 0, accepted: 0, retry: 0, review: 0, failed: 0,
    idle: 0, uncertain: 0, unavailable: 0 };
  const store = createOwnedEmailStore(input.client);
  for (const connection of input.connections) {
    if (elapsed() > 25_000 || counts.scanned >= 20) break;
    const limit = Math.min(4, 20 - counts.scanned);
    const { data, error } = await input.client.rpc('app_email_due', {
      p_project_id: input.projectId, p_environment: input.environment, p_connection_id: connection.id, p_limit: limit,
    });
    if (error || !Array.isArray(data) || data.length > limit || data.some(id => typeof id !== 'string' || !uuid.test(id))
      || new Set(data).size !== data.length) throw new Error('Email queue unavailable.');
    for (const jobId of data) {
      // Leave budget for a bounded claim, provider call and receipt write.
      if (elapsed() > 25_000 || counts.scanned >= 20) return counts;
      counts.scanned++;
      const outcome = await deliverOwnedEmail({ jobId, projectId: input.projectId, connectionId: connection.id,
        environment: input.environment, from: connection.from, apiKey: connection.apiKey, store,
        fetcher: input.fetcher, now: input.now });
      counts[outcome.status]++;
    }
  }
  return counts;
}

function reply(status: number, value: unknown): Response {
  return Response.json(value, { status, headers: { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
}

async function authorized(header: string | null, secret: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(secret) || !header || !/^Bearer [A-Za-z0-9_-]{32,200}$/.test(header)) return false;
  const hash = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [actual, expected] = await Promise.all([hash(header), hash(`Bearer ${secret}`)]);
  let difference = 0;
  for (let index = 0; index < actual.length; index++) difference |= actual[index] ^ expected[index];
  return difference === 0;
}

/** No environment, job, sender, recipient or credential is selectable in a request.
 * Hosting code supplies an immutable scope and a private customer RPC client. */
export async function serveOwnedEmailWorker(request: Request, input: {
  projectId: string; environment: OwnedEmailJob['environment']; applicationOrigin: string; cronSecret: string;
  connections: readonly OwnedEmailWorkerConnection[];
  /** Lazy construction avoids reading customer credentials before cron authorization. */
  client(): OwnedEmailRpcClient;
  fetcher?: typeof fetch; now?: () => Date;
}): Promise<Response> {
  try {
    if (typeof window !== 'undefined') return reply(503, { error: 'Email worker unavailable.' });
    if (request.method !== 'GET') return reply(405, { error: 'Method not allowed.' });
    const origin = new URL(input.applicationOrigin), url = new URL(request.url);
    if (origin.protocol !== 'https:' || origin.origin !== input.applicationOrigin || url.origin !== origin.origin
      || url.pathname !== '/api/application-email-worker' || url.search || request.headers.has('origin')) {
      return reply(403, { error: 'Request not allowed.' });
    }
    if (!await authorized(request.headers.get('authorization'), input.cronSecret)) return reply(401, { error: 'Unauthorized.' });
    validateOwnedEmailWorkerScope(input);
    const counts = await drainOwnedEmailQueue({ ...input, client: input.client() });
    return reply(200, counts);
  } catch { return reply(503, { error: 'Email worker unavailable.' }); }
}
