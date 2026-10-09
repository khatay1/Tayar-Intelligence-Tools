import type { EditorIntegrationConnection, EditorIntegrationEnvironment } from '../src/modules/website-builder/core/editor-integrations';
import type { EditorIntegrationDelivery, EditorIntegrationEventEnvelope } from '../src/modules/website-builder/core/editor-integration-runtime';
import { deliverOwnedEmail, isOwnedEmailAddress } from './website-owned-email-delivery';
import { createOwnedEmailStore, enqueueOwnedEmail, type OwnedEmailRpcClient } from './website-owned-email-store';

/** All callbacks are trusted server code, never derived from generated JS or a client
 * message's `email`/`to`/`subject` fields. The producer must authorize the source event. */
export function createOwnedEmailEventDispatcher(input: {
  projectId: string;
  environment: EditorIntegrationEnvironment;
  connectionId: string;
  from: string;
  client: OwnedEmailRpcClient;
  resolveSecret(ref: string): Promise<string | undefined>;
  resolveTemplate(event: EditorIntegrationEventEnvelope): Promise<{
    /** UUID read from the committed source event, never a newly generated delivery ID. */
    sourceEventId: string; recipientUserId: string; subject: string; text: string;
  } | null>;
  fetcher?: typeof fetch;
}) {
  input = { ...input };
  return async (connection: EditorIntegrationConnection, event: EditorIntegrationEventEnvelope): Promise<EditorIntegrationDelivery> => {
    const base = { eventId: event.id, connectionId: connection.id, attempt: 0 };
    try {
      if (typeof window !== 'undefined' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(input.projectId)
        || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(input.connectionId)
        || !['preview', 'staging', 'production'].includes(input.environment)
        || connection.providerId !== 'resend' || connection.id !== input.connectionId
        || event.projectId !== input.projectId || event.environment !== input.environment || !isOwnedEmailAddress(input.from)
        || connection.config.from !== input.from || !connection.enabled || connection.status === 'disabled'
        || !connection.environments.includes(input.environment) || !connection.events?.includes(event.event)
        || !['form.submitted', 'contact.created'].includes(event.event)
        || !/^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,199}$/.test(event.id)) throw new Error();
      const ref = `secret://website/${input.projectId}/${input.connectionId}/apiKey/${input.environment}`;
      if (connection.secrets.apiKey?.ref !== ref) throw new Error();
      const template = await input.resolveTemplate(event);
      if (!template) return { ...base, status: 'skipped', error: 'No authorized notification template.' };
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(template.recipientUserId)
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(template.sourceEventId)
        || typeof template.subject !== 'string' || template.subject.length > 200
        || typeof template.text !== 'string' || template.text.length > 32000) throw new Error();
      const key = await input.resolveSecret(ref);
      if (!key || !/^re_[A-Za-z0-9_-]{16,200}$/.test(key)) throw new Error();
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(
        JSON.stringify([input.projectId, input.environment, input.connectionId, template.sourceEventId]))));
      // UUIDv8: application-defined SHA-256 identity, not the SHA-1 UUIDv5 format.
      digest[6] = (digest[6] & 15) | 0x80; digest[8] = (digest[8] & 63) | 0x80;
      const hex = Array.from(digest.slice(0, 16), byte => byte.toString(16).padStart(2, '0')).join('');
      const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      await enqueueOwnedEmail(input.client, { id, connectionId: input.connectionId, environment: input.environment, from: input.from,
        recipientUserId: template.recipientUserId, subject: template.subject, text: template.text });
      const result = await deliverOwnedEmail({ jobId: id, projectId: input.projectId, connectionId: input.connectionId, environment: input.environment,
        from: input.from, apiKey: key, store: createOwnedEmailStore(input.client), fetcher: input.fetcher });
      if (result.status === 'accepted') return { ...base, attempt: result.attempt, status: 'accepted', providerId: result.providerId };
      if (result.status === 'review') return { ...base, attempt: result.attempt, status: 'review', error: result.code };
      if (result.status === 'failed') return { ...base, attempt: result.attempt, status: 'failed', error: result.code };
      return { ...base, attempt: result.status === 'retry' ? result.attempt : 0,
        status: 'queued', nextRetryAt: result.status === 'retry' ? result.retryAt : undefined };
    } catch { return { ...base, status: 'failed', error: 'Email delivery unavailable.' }; }
  };
}
