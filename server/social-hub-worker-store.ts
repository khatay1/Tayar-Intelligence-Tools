import type { SupabaseClient } from '@supabase/supabase-js';
import { isUntrustedBrowserRuntime } from '../src/modules/website-builder/services/trustedServerRuntime';
import type { SocialAttachmentRef, SocialChannel, SocialConnectionBinding, SocialSendPolicy } from './social-channels';
import { createSocialHubWebhookHandler, dispatchSocialHubOutgoing, type SocialHubWorkerStore, type SocialOutgoingLease, type SocialSecretVault } from './social-hub-worker';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(): never { throw new Error('Social worker persistence unavailable.'); }
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(); return value as Record<string, unknown>; }
function string(value: unknown): string { if (typeof value !== 'string') fail(); return value; }
function id(value: unknown): string { const result = string(value); if (!uuid.test(result)) fail(); return result; }
function date(value: unknown): string { const result = string(value); if (!Number.isFinite(Date.parse(result))) fail(); return result; }
function boolean(value: unknown): boolean { if (typeof value !== 'boolean') fail(); return value; }
function attachmentRefs(value: unknown): SocialAttachmentRef[] {
  if (!Array.isArray(value) || value.length > 30) fail();
  return value.map(candidate => {
    const item=record(candidate),keys=Object.keys(item).sort().join(',');
    if(!['providerId,type','type'].includes(keys)||!['image','document','audio','video','sticker'].includes(string(item.type)))fail();
    if(item.providerId!==undefined&&!/^[A-Za-z0-9_.:@=-]{1,256}$/.test(string(item.providerId)))fail();
    return {type:item.type as SocialAttachmentRef['type'],...(item.providerId===undefined?{}:{providerId:string(item.providerId)})};
  });
}
function binding(value: unknown): SocialConnectionBinding {
  const row = record(value);
  if (!['whatsapp','telegram','facebook','instagram'].includes(string(row.channel))
    || !['connected','disconnected','expired'].includes(string(row.status)) || !['official','customer'].includes(string(row.ownership))
    || !/^\d{1,30}$/.test(string(row.external_account_id))) fail();
  return {tenantId:id(row.scope_id),connectionId:id(row.id),channel:row.channel as SocialChannel,accountId:string(row.external_account_id),
    ownership:row.ownership as SocialConnectionBinding['ownership'],status:row.status as SocialConnectionBinding['status'],
    permissionsVerified:boolean(row.permissions_verified),webhookVerified:boolean(row.webhook_verified),expiresAt:row.expires_at === null ? null : date(row.expires_at)};
}
function leaseScope(lease: SocialOutgoingLease) {
  id(lease.jobId); id(lease.leaseId); id(lease.tenantId); id(lease.connectionId); date(lease.leaseExpiresAt);
}
async function opaqueHash(opaqueId: string) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(opaqueId)) fail();
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(opaqueId))),byte=>byte.toString(16).padStart(2,'0')).join('');
}

/** Resolve only the separately provisioned Meta GET verification token for this opaque route. */
export function createSocialHubChallengeResolver(client: Pick<SupabaseClient,'rpc'>) {
  if (isUntrustedBrowserRuntime()) fail();
  return async (opaqueId:string):Promise<string|null> => {
    let value:unknown;
    try {const result=await client.rpc('resolve_social_hub_webhook_challenge',{p_webhook_hash:await opaqueHash(opaqueId)});if(result.error)fail();value=result.data;}catch{return fail();}
    if(value===null)return null;const token=string(value);
    if(token.length<16||token.length>256||[...token].some(character=>/\s/.test(character)||character.charCodeAt(0)<32||character.charCodeAt(0)===127))fail();
    return token;
  };
}

/** Concrete service-role RPC adapters. SQL enforces scope, expiry, budgets, reservations and Vault custody.
 * This factory must only receive an existing trusted server service client; it does not take URLs/keys from requests. */
export function createSocialHubWorkerPersistence(client: Pick<SupabaseClient, 'rpc'>): {store:SocialHubWorkerStore;vault:SocialSecretVault} {
  if (isUntrustedBrowserRuntime()) fail();
  async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (isUntrustedBrowserRuntime()) fail();
    try {const {data,error}=await client.rpc(name,args);if(error)fail();return data as unknown;}catch{return fail();}
  }
  const store: SocialHubWorkerStore = {
    async resolveWebhook(opaqueId) {
      const value=await rpc('resolve_social_hub_webhook',{p_webhook_hash:await opaqueHash(opaqueId)});
      if(value === null)return null;
      const row=record(value),connection=binding(row.connection);
      return {binding:connection,secretRef:id(row.webhook_secret_ref)};
    },
    async ingest(event) {
      id(event.tenantId);id(event.connectionId);
      if(event.externalConversationId !== event.senderId || !/^-?\d{1,30}$/.test(event.senderId)
        || typeof event.externalMessageId !== 'string' || event.externalMessageId.length < 1 || event.externalMessageId.length > 256
        || typeof event.text !== 'string' || event.text.length > 16_384)fail();
      date(event.occurredAt);
      const attachments=attachmentRefs(event.attachmentRefs);
      const result=await rpc('ingest_social_hub_message',{p_scope_id:event.tenantId,p_connection_id:event.connectionId,
        p_event_id:event.externalMessageId,p_external_conversation_id:event.externalConversationId,p_external_message_id:event.externalMessageId,
        p_sender_name:event.senderId,p_text:event.text,p_occurred_at:event.occurredAt,p_attachment_refs:attachments});
      if(result === null)return 'duplicate';id(result);return 'applied';
    },
    async claim(scope,jobId) {
      id(scope.tenantId);id(scope.connectionId);id(jobId);
      const value=await rpc('claim_social_hub_outgoing',{p_scope_id:scope.tenantId,p_connection_id:scope.connectionId,p_job_id:jobId});
      if(value === null)return null;
      const row=record(value);
      if(row.scope_id !== scope.tenantId || row.connection_id !== scope.connectionId || row.id !== jobId
        || !/^\d{1,30}$/.test(string(row.external_account_id)) || !/^-?\d{1,30}$/.test(string(row.recipient_id))
        || string(row.text).length < 1 || string(row.text).length > 4096)fail();
      return {jobId:id(row.id),leaseId:id(row.claim_token),leaseExpiresAt:date(row.lease_until),tenantId:id(row.scope_id),
        connectionId:id(row.connection_id),accountId:string(row.external_account_id),recipientId:string(row.recipient_id),text:string(row.text),
        ...(row.automation_rule_id==null?{}:{automationRuleId:id(row.automation_rule_id)})};
    },
    async resolveOutgoing(lease) {
      leaseScope(lease);
      const value=await rpc('resolve_social_hub_outgoing',{p_job_id:lease.jobId,p_claim_token:lease.leaseId});
      if(value === null)return null;
      const row=record(value),connection=binding(row.connection),evidence=record(row.policy);
      if(connection.tenantId !== lease.tenantId || connection.connectionId !== lease.connectionId || connection.accountId !== lease.accountId)fail();
      const policy:SocialSendPolicy={consentVerified:boolean(evidence.consent_verified),recipientInitiated:boolean(evidence.recipient_initiated),
        ...(evidence.last_inbound_at === null ? {} : {lastInboundAt:date(evidence.last_inbound_at)})};
      return {binding:connection,secretRef:id(record(row.connection).secret_ref),policy};
    },
    async reserveDispatch(lease) {
      leaseScope(lease);
      return boolean(await rpc('reserve_social_hub_dispatch',{p_job_id:lease.jobId,p_claim_token:lease.leaseId}));
    },
    async finish(lease,outcome) {
      leaseScope(lease);
      const status=outcome.status === 'blocked' ? 'rejected' : outcome.status;
      if(!['accepted','rejected','review'].includes(status))fail();
      await rpc('settle_social_hub_outbox',{p_id:lease.jobId,p_claim_token:lease.leaseId,p_outcome:status,
        p_provider_message_id:outcome.status === 'accepted' ? outcome.providerMessageId : null,
        p_error_code:outcome.status === 'accepted' ? null : outcome.reason === 'rate-limited' ? 'rate_limited' : outcome.reason,
        p_retry_after_seconds:null});
      return true;
    },
  };
  const vault:SocialSecretVault={
    async resolve(scope){
      id(scope.tenantId);id(scope.connectionId);id(scope.secretRef);
      if(scope.purpose !== 'webhook' && scope.purpose !== 'send')fail();
      const value=await rpc(scope.purpose === 'webhook' ? 'read_social_hub_webhook_secret' : 'read_social_hub_credential',
        {p_scope_id:scope.tenantId,p_connection_id:scope.connectionId,p_secret_ref:scope.secretRef});
      const credential=string(value);
      if(credential.length < 16 || credential.length > 8192 || [...credential].some(character=>/\s/.test(character)||character.charCodeAt(0)<32||character.charCodeAt(0)===127))fail();
      return credential;
    },
  };
  return {store,vault};
}

export interface SocialDueOutgoing { jobId: string; tenantId: string; connectionId: string }

/** Returns only opaque identifiers. Claiming and reading message content remain inside the fenced worker flow. */
export function createSocialHubDueOutgoingReader(client: Pick<SupabaseClient, 'rpc'>) {
  if (isUntrustedBrowserRuntime()) fail();
  return async (limit = 3): Promise<SocialDueOutgoing[]> => {
    if (!Number.isInteger(limit) || limit < 1 || limit > 3 || isUntrustedBrowserRuntime()) fail();
    let value: unknown;
    try { const result=await client.rpc('list_due_social_hub_outgoing',{p_limit:limit});if(result.error)fail();value=result.data; } catch { return fail(); }
    if (!Array.isArray(value) || value.length > limit) fail();
    return value.map(item => {
      const row=record(item);
      return {jobId:id(row.job_id),tenantId:id(row.scope_id),connectionId:id(row.connection_id)};
    });
  };
}

/** Fully composed but unmounted RPC-backed workers. Disabled unless explicitly enabled by trusted host config. */
export function createSocialHubRpcWorkers(client: Pick<SupabaseClient, 'rpc'>, config: {
  enabled?: () => boolean; graphVersion?: string; now?: () => Date; fetcher?: typeof fetch;
  automationEnabled?: () => boolean;
  resolveChallengeToken?: (opaqueId: string) => Promise<string | null>;
} = {}) {
  const persistence = createSocialHubWorkerPersistence(client);
  const enabled = config.enabled ?? (() => false);
  return {
    webhook: createSocialHubWebhookHandler({enabled,...persistence,resolveChallengeToken:config.resolveChallengeToken}),
    dispatch: (scope: {tenantId:string;connectionId:string}, jobId:string) => dispatchSocialHubOutgoing({enabled,...persistence,
      scope,jobId,graphVersion:config.graphVersion,now:config.now,fetcher:config.fetcher,automationEnabled:config.automationEnabled}),
  };
}
