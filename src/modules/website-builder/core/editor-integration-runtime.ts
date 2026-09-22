import { integrationsForEvent, type EditorIntegrationConnection, type EditorIntegrationEnvironment, type EditorIntegrationEvent, type EditorIntegrationsConfig } from './editor-integrations';

export interface EditorIntegrationEventEnvelope {
  id: string;
  event: EditorIntegrationEvent;
  environment: EditorIntegrationEnvironment;
  projectId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface EditorIntegrationDelivery {
  eventId: string;
  connectionId: string;
  attempt: number;
  status: 'delivered' | 'failed' | 'skipped';
  statusCode?: number;
  error?: string;
  deliveredAt?: string;
  nextRetryAt?: string;
}

export interface EditorIntegrationRuntimeAdapter {
  resolveSecret(ref: string): Promise<string | undefined>;
  request(input: { url: string; method: 'POST'; headers: Record<string, string>; body: string; signal?: AbortSignal }): Promise<{ ok: boolean; status: number }>;
  sign?(payload: string, secret: string): Promise<string>;
  now?(): Date;
  sleep?(milliseconds: number): Promise<void>;
}

export interface EditorIntegrationDispatchOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  signal?: AbortSignal;
  idempotencyPrefix?: string;
}

function safeJson(value: unknown) {
  return JSON.stringify(value).replace(/[\u2028\u2029]/g, character => character === '\u2028' ? '\\u2028' : '\\u2029');
}

function retryDelay(attempt: number, baseDelayMs: number) {
  return Math.min(30_000, baseDelayMs * 2 ** Math.max(0, attempt - 1));
}

function endpoint(connection: EditorIntegrationConnection) {
  const url = connection.config.url;
  return typeof url === 'string' ? url : undefined;
}

async function secretHeaders(connection: EditorIntegrationConnection, adapter: EditorIntegrationRuntimeAdapter, body: string) {
  const headers: Record<string, string> = {};
  const authRef = connection.secrets.authorization?.ref;
  if (authRef) {
    const authorization = await adapter.resolveSecret(authRef);
    if (authorization) headers.Authorization = authorization;
  }
  const signingRef = connection.secrets.signingSecret?.ref;
  if (signingRef) {
    const signingSecret = await adapter.resolveSecret(signingRef);
    if (signingSecret && adapter.sign) headers['X-Tayar-Signature'] = await adapter.sign(body, signingSecret);
  }
  return headers;
}

export function createEditorIntegrationEvent(input: Omit<EditorIntegrationEventEnvelope, 'id' | 'occurredAt'> & { id?: string; occurredAt?: string }): EditorIntegrationEventEnvelope {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const id = input.id ?? `${input.projectId}:${input.event}:${occurredAt}:${Math.random().toString(36).slice(2, 10)}`;
  return { id, event: input.event, environment: input.environment, projectId: input.projectId, occurredAt, payload: input.payload };
}

export async function dispatchEditorIntegrationEvent(config: EditorIntegrationsConfig, event: EditorIntegrationEventEnvelope, adapter: EditorIntegrationRuntimeAdapter, options: EditorIntegrationDispatchOptions = {}): Promise<EditorIntegrationDelivery[]> {
  const connections = integrationsForEvent(config, event.event, event.environment);
  const maxAttempts = Math.max(1, Math.min(5, options.maxAttempts ?? 3));
  const baseDelayMs = Math.max(0, Math.min(10_000, options.baseDelayMs ?? 500));
  const deliveries: EditorIntegrationDelivery[] = [];

  for (const connection of connections) {
    if (options.signal?.aborted) break;
    const url = endpoint(connection);
    if (!url || (connection.providerId !== 'webhook' && connection.providerId !== 'http-api')) {
      deliveries.push({ eventId: event.id, connectionId: connection.id, attempt: 0, status: 'skipped', error: url ? 'Provider requires a server adapter.' : 'Missing endpoint URL.' });
      continue;
    }
    const body = safeJson(event);
    let final: EditorIntegrationDelivery | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (options.signal?.aborted) break;
      try {
        const headers = await secretHeaders(connection, adapter, body);
        const response = await adapter.request({ url, method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tayar-Event': event.event, 'X-Tayar-Event-Id': event.id, 'Idempotency-Key': `${options.idempotencyPrefix ?? 'tayar'}:${event.id}:${connection.id}`, ...headers }, body, signal: options.signal });
        if (response.ok) {
          final = { eventId: event.id, connectionId: connection.id, attempt, status: 'delivered', statusCode: response.status, deliveredAt: (adapter.now?.() ?? new Date()).toISOString() };
          break;
        }
        const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
        final = { eventId: event.id, connectionId: connection.id, attempt, status: 'failed', statusCode: response.status, error: `HTTP ${response.status}` };
        if (!retryable || attempt === maxAttempts) break;
      } catch (error) {
        final = { eventId: event.id, connectionId: connection.id, attempt, status: 'failed', error: error instanceof Error ? error.message : 'Integration delivery failed.' };
        if (attempt === maxAttempts) break;
      }
      const delay = retryDelay(attempt, baseDelayMs);
      final = { ...final!, nextRetryAt: new Date((adapter.now?.() ?? new Date()).getTime() + delay).toISOString() };
      if (adapter.sleep) await adapter.sleep(delay);
    }
    if (final) deliveries.push(final);
  }
  return deliveries;
}
