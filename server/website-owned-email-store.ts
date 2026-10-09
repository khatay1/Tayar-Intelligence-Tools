import type { OwnedEmailClaim, OwnedEmailStore } from './website-owned-email-delivery';

export interface OwnedEmailRpcClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}

/** The client must use a customer-owned server-only credential; no browser client. */
export function createOwnedEmailStore(client: OwnedEmailRpcClient): OwnedEmailStore {
  return {
    async claim(input) {
      if (typeof window !== 'undefined') throw new Error('Server-only delivery store.');
      const { data, error } = await client.rpc('app_email_claim', {
        p_id: input.jobId, p_project_id: input.projectId, p_environment: input.environment,
        p_connection_id: input.connectionId, p_fingerprint: input.credentialFingerprint, p_from: input.from, p_lease_id: input.leaseId,
      });
      if (error) throw new Error('Email claim unavailable.');
      if (data === null) return null;
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid email claim.');
      return data as OwnedEmailClaim;
    },
    async finish(input) {
      if (typeof window !== 'undefined') throw new Error('Server-only delivery store.');
      const { data, error } = await client.rpc('app_email_finish', {
        p_id: input.jobId, p_lease_id: input.leaseId, p_outcome: input.outcome,
      });
      if (error || typeof data !== 'boolean') throw new Error('Email receipt unavailable.');
      return data;
    },
  };
}

/** Only a trusted server may choose a template/user. PostgreSQL resolves the verified
 * recipient from auth.users. The caller cannot supply an arbitrary email address. */
export async function enqueueOwnedEmail(client: OwnedEmailRpcClient, input: {
  id: string; connectionId: string; recipientUserId: string; environment: 'preview' | 'staging' | 'production';
  from: string; subject: string; text: string;
}): Promise<void> {
  if (typeof window !== 'undefined') throw new Error('Server-only delivery store.');
  const { data, error } = await client.rpc('app_email_enqueue', {
    p_id: input.id, p_connection_id: input.connectionId, p_user_id: input.recipientUserId, p_environment: input.environment,
    p_from: input.from, p_subject: input.subject, p_text: input.text,
  });
  if (error || data !== true) throw new Error('Email queue unavailable.');
}
