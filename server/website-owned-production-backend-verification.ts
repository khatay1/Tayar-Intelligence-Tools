import type { SupabaseClient } from '@supabase/supabase-js';
import type { ApplicationDefinition } from '../src/modules/website-builder/core/application-model';
import type { ApplicationPublicBackend } from '../src/modules/website-builder/core/application-data-runtime';
import { createOwnedSupabaseReadOnlyQuery } from './website-owned-supabase-catalog';
import { parseOwnedSupabaseCustody, readOwnedSupabasePublicBackend } from './website-owned-supabase-custody';
import { createOwnedSupabaseLiveSecurityVerifier, verifyOwnedSupabaseProject } from './website-owned-supabase-project';
import { verifyOwnedSupabaseApplicationRuntime, type OwnedSupabaseRuntimeReader } from './website-owned-supabase-verifier';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const provider = /^[A-Za-z0-9_-]{1,200}$/;
const object = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown> : null;
const exact = (row: Record<string, unknown>, keys: string[]) => Object.keys(row).every(key => keys.includes(key));

/** Re-proves the exact customer Production backend from leased OAuth custody.
 * All provider/database calls are read-only and every boundary rechecks scope. */
export async function verifyWebsiteOwnedProductionBackend(input: {
  client: Pick<SupabaseClient, 'rpc'>; projectId: string; ownerId: string;
  connectionId: string; connectionVersion: number; platformSupabaseOrganizationId: string;
  definition: ApplicationDefinition; backend: ApplicationPublicBackend;
  isCurrent(): Promise<boolean>; fetcher?: typeof fetch;
}): Promise<void> {
  try {
    if (typeof window !== 'undefined' || ![input.projectId, input.ownerId, input.connectionId].every(value => uuid.test(value))
      || !Number.isSafeInteger(input.connectionVersion) || input.connectionVersion < 1
      || !provider.test(input.platformSupabaseOrganizationId) || !await input.isCurrent()) throw new Error();
    const result = await input.client.rpc('website_read_supabase_oauth_custody', { p_connection_id: input.connectionId,
      p_project_id: input.projectId, p_owner_id: input.ownerId, p_expected_connection_version: input.connectionVersion });
    if (result.error || !await input.isCurrent()) throw new Error();
    const custody = parseOwnedSupabaseCustody(result.data, 'production', { projectRef: input.backend.projectRef });
    const fetcher = input.fetcher ?? fetch;
    const ownership = { ...custody, accountUserId: custody.accountId,
      platformOrganizationId: input.platformSupabaseOrganizationId, fetcher };
    if (!await verifyOwnedSupabaseProject(ownership) || !await input.isCurrent()) throw new Error();
    const backend = await readOwnedSupabasePublicBackend({ custody, fetcher });
    if (backend.url !== input.backend.url || backend.projectRef !== input.backend.projectRef
      || backend.publishableKey !== input.backend.publishableKey || !await input.isCurrent()) throw new Error();
    const query = createOwnedSupabaseReadOnlyQuery({ ...custody, fetcher });
    const scalar = async (sql: string, key: string) => {
      if (!await input.isCurrent()) throw new Error(); const value = await query(sql);
      if (!Array.isArray(value) || value.length !== 1) throw new Error(); const row = object(value[0]);
      if (!row || !exact(row, [key]) || !await input.isCurrent()) throw new Error(); return row[key];
    };
    const reader: OwnedSupabaseRuntimeReader = { url: backend.url,
      readDeployedDefinition: () => scalar('select definition from private.app_schema_revisions where id=true', 'definition'),
      readFormRequestRevision: () => scalar('select form_request_version from private.app_runtime_capabilities where id=true', 'form_request_version'),
      verifyLiveSecurity: createOwnedSupabaseLiveSecurityVerifier({ ...ownership, isCurrent: input.isCurrent }) };
    await verifyOwnedSupabaseApplicationRuntime({ definition: input.definition, backend,
      expectedProjectRef: custody.projectRef, reader, formsRequired: input.definition.tables.length > 0 });
    if (!await input.isCurrent()) throw new Error();
  } catch { throw new Error('Customer Production backend verification is unavailable.'); }
}

/** Admits a payment release only after its exact generated Production runtime
 * has processed a live Stripe event. The private row is written only after the
 * generated webhook verifies Stripe's signature and the order identity. */
export async function verifyWebsiteOwnedProductionStripeDelivery(input: {
  client: Pick<SupabaseClient, 'rpc'>; projectId: string; ownerId: string;
  connectionId: string; connectionVersion: number; expectedProjectRef:string;runtimeDigest: string;
  isCurrent(): Promise<boolean>; fetcher?: typeof fetch;
}): Promise<void> {
  try {
    if (typeof window !== 'undefined' || ![input.projectId,input.ownerId,input.connectionId].every(value=>uuid.test(value))
      || !Number.isSafeInteger(input.connectionVersion) || input.connectionVersion<1
      || !/^[a-z]{20}$/.test(input.expectedProjectRef)
      || !/^[a-f0-9]{64}$/.test(input.runtimeDigest) || !await input.isCurrent()) throw new Error();
    const result=await input.client.rpc('website_read_supabase_oauth_custody',{p_connection_id:input.connectionId,
      p_project_id:input.projectId,p_owner_id:input.ownerId,p_expected_connection_version:input.connectionVersion});
    if(result.error||!await input.isCurrent())throw new Error();
    const custody=parseOwnedSupabaseCustody(result.data,'production',{projectRef:input.expectedProjectRef});
    const query=createOwnedSupabaseReadOnlyQuery({...custody,fetcher:input.fetcher});
    const rows=await query(`select event_id,event_type,received_at from private.app_stripe_order_events
where project_id='${input.projectId}'::uuid and runtime_digest='${input.runtimeDigest}' and livemode=true
order by received_at desc,event_id desc limit 1`);
    if(!Array.isArray(rows)||rows.length!==1||!await input.isCurrent())throw new Error();
    const row=object(rows[0]);
    if(!row||!exact(row,['event_id','event_type','received_at'])
      ||typeof row.event_id!=='string'||!/^evt_[A-Za-z0-9]{8,200}$/.test(row.event_id)
      ||typeof row.event_type!=='string'||!['checkout.session.completed','checkout.session.async_payment_succeeded',
        'checkout.session.async_payment_failed','refund.created','refund.updated','charge.refunded'].includes(row.event_type)
      ||typeof row.received_at!=='string'||!Number.isFinite(Date.parse(row.received_at)))throw new Error();
  } catch { throw new Error('Customer Production Stripe delivery verification is unavailable.'); }
}
