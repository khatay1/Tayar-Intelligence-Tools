import { sendSocialMessage, verifyAndNormalizeSocialWebhook, verifySocialWebhookChallenge, type NormalizedSocialMessage, type SocialConnectionBinding, type SocialSendOutcome, type SocialSendPolicy } from './social-channels';

export interface SocialSecretVault {
  /** Must authorize exact persisted tenant/connection and never return a credential from another scope. */
  resolve(input: { tenantId: string; connectionId: string; secretRef: string; purpose: 'webhook' | 'send' }): Promise<string>;
}
export interface SocialWebhookTarget { binding: SocialConnectionBinding; secretRef: string }
export interface SocialOutgoingLease {
  jobId: string; leaseId: string; leaseExpiresAt: string; tenantId: string; connectionId: string;
  accountId: string; recipientId: string; text?: string; template?: {name: string; language: string};
}
export interface SocialHubWorkerStore {
  /** Opaque ID must map to one server-held target; request payload must never choose tenant/account/credential. */
  resolveWebhook(opaqueId: string): Promise<SocialWebhookTarget | null>;
  /** Atomic dedup + message insert + conversation update + automation event. No in-memory dedup in production. */
  ingest(event: NormalizedSocialMessage): Promise<'applied' | 'duplicate'>;
  /** Atomic claim. Expired sending jobs must become review rather than automatic resend. */
  claim(scope: {tenantId:string;connectionId:string}, jobId: string): Promise<SocialOutgoingLease | null>;
  /** Re-read connection, recipient-bound policy evidence and credential reference for every leased send. */
  resolveOutgoing(lease: SocialOutgoingLease): Promise<{ binding: SocialConnectionBinding; secretRef: string; policy: SocialSendPolicy } | null>;
  /** Atomic lease/fence check + global/tenant/channel/account rate and spend reservation + kill-switch check.
   * A worker may proceed at most once per lease. A reserved lease cannot be dispatched again after crash. */
  reserveDispatch(lease: SocialOutgoingLease): Promise<boolean>;
  /** Compare-and-set by current lease. review must never be auto-requeued. */
  finish(lease: SocialOutgoingLease, outcome: SocialSendOutcome): Promise<boolean>;
}

/** Unmounted handler factory: host must inject durable storage + server-only vault. No browser secret inputs. */
export function createSocialHubWebhookHandler(dependencies: { enabled: () => boolean; store: SocialHubWorkerStore; vault: SocialSecretVault;
  /** Resolve a distinct server-held Meta verification token, never the app signing secret. */
  resolveChallengeToken?: (opaqueId: string) => Promise<string | null>;
}) {
  return async (request: Request, opaqueId: string): Promise<Response> => {
    if (dependencies.enabled() !== true) return new Response(null, {status:404});
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(opaqueId)) return new Response(null, {status:400});
    if (request.method === 'GET') {
      if (!dependencies.resolveChallengeToken) return new Response(null, {status:405});
      try {
        const query = new URL(request.url).searchParams;
        if (!['hub.mode','hub.verify_token','hub.challenge'].every(key => query.getAll(key).length === 1)) return new Response(null, {status:400});
        const expectedToken = await dependencies.resolveChallengeToken(opaqueId);
        if (!expectedToken || dependencies.enabled() !== true) return new Response(null, {status:404});
        const challenge = await verifySocialWebhookChallenge({enabled:dependencies.enabled(),expectedToken,mode:query.get('hub.mode')!,token:query.get('hub.verify_token')!,challenge:query.get('hub.challenge')!});
        return new Response(challenge, {status:200,headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});
      } catch { return new Response(null, {status:401}); }
    }
    if (request.method !== 'POST') return new Response(null, {status:405});
    let target: SocialWebhookTarget | null;
    try { target = await dependencies.store.resolveWebhook(opaqueId); } catch { return new Response(null, {status:503}); }
    if (!target) return new Response(null, {status:404});
    let events: NormalizedSocialMessage[];
    try {
      const secret = await dependencies.vault.resolve({tenantId:target.binding.tenantId,connectionId:target.binding.connectionId,secretRef:target.secretRef,purpose:'webhook'});
      events = await verifyAndNormalizeSocialWebhook({enabled:dependencies.enabled(),request,binding:target.binding,secret});
    } catch { return new Response(null, {status:401}); }
    try {
      for (const event of events) {
        if (dependencies.enabled() !== true) return new Response(null, {status:503});
        await dependencies.store.ingest(event);
      }
    } catch { return new Response(null, {status:503}); }
    return new Response(null, {status:200});
  };
}

/** Server-scheduled single-job dispatch. Public request auth/role checks belong to the mounted host.
 * No credentials, request URLs, provider bodies or caught exceptions are returned or logged. */
export async function dispatchSocialHubOutgoing(input: {
  enabled: () => boolean; scope: {tenantId:string;connectionId:string}; jobId: string;
  store: SocialHubWorkerStore; vault: SocialSecretVault; graphVersion?: string; now?: () => Date; fetcher?: typeof fetch;
}): Promise<SocialSendOutcome | {status:'idle'}> {
  if (input.enabled() !== true) return {status:'blocked',reason:'feature-disabled'};
  if (![input.scope.tenantId,input.scope.connectionId,input.jobId].every(value => /^[A-Za-z0-9_-]{1,128}$/.test(value))) return {status:'blocked',reason:'invalid-scope'};
  const lease = await input.store.claim(input.scope, input.jobId);
  if (!lease) return {status:'idle'};
  let outcome: SocialSendOutcome;
  try {
    if (lease.tenantId !== input.scope.tenantId || lease.connectionId !== input.scope.connectionId || lease.jobId !== input.jobId) {
      return {status:'review',reason:'lease-scope-mismatch'};
    } else {
      const connection = await input.store.resolveOutgoing(lease);
      const now = (input.now?.() ?? new Date()).getTime();
      // Do not start a request that may outlive the durable dispatch fence.
      if (!connection || connection.binding.accountId !== lease.accountId || !Number.isFinite(now)
        || !Number.isFinite(Date.parse(lease.leaseExpiresAt)) || Date.parse(lease.leaseExpiresAt) - now < 12_000 || input.enabled() !== true) {
        outcome = {status:'blocked',reason:'connection-or-lease-unavailable'};
      } else {
        const credential = await input.vault.resolve({tenantId:lease.tenantId,connectionId:lease.connectionId,secretRef:connection.secretRef,purpose:'send'});
        if (input.enabled() !== true || !await input.store.reserveDispatch(lease)) outcome = {status:'blocked',reason:'dispatch-not-authorized'};
        else outcome = await sendSocialMessage({enabled:input.enabled(),binding:connection.binding,scope:input.scope,credential,
          policy:connection.policy,message:{recipientId:lease.recipientId,text:lease.text,template:lease.template},
          graphVersion:input.graphVersion,now:input.now,fetcher:input.fetcher});
      }
    }
  } catch { outcome = {status:'review',reason:'dispatch-unresolved'}; }
  try { if (!await input.store.finish(lease,outcome)) return {status:'review',reason:'settlement-unconfirmed'}; }
  catch { return {status:'review',reason:'settlement-unconfirmed'}; }
  return outcome;
}
