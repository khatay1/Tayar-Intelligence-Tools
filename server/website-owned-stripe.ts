import type { SupabaseClient } from '@supabase/supabase-js';
import { handoffOwnedSecretToVercel } from './website-owned-vercel-environment';

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

type RpcClient = Pick<SupabaseClient, 'rpc'>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const providerId = /^[A-Za-z0-9_-]{3,128}$/;
const integrationId = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;

export interface OwnedStripeRuntimeReceipt {
  connectionVersion: number;
  handoffVersion: number;
  accountId: string;
  keyType: 'restricted' | 'secret';
  environmentId: string;
  status: 'ready';
}

function stripeRuntimeReceipt(value: unknown, expectedConnectionVersion: number,
  expectedHandoffVersion: number): OwnedStripeRuntimeReceipt | null {
  if (value === null) return null;
  const row = object(value);
  if (Object.keys(row).sort().join(',') !== 'accountId,connectionVersion,environmentId,handoffVersion,keyType'
    || row.connectionVersion !== expectedConnectionVersion || row.handoffVersion !== expectedHandoffVersion
    || typeof row.accountId !== 'string' || !account.test(row.accountId)
    || (row.keyType !== 'restricted' && row.keyType !== 'secret')
    || typeof row.environmentId !== 'string' || !providerId.test(row.environmentId)) throw new Error();
  return { connectionVersion: expectedConnectionVersion, handoffVersion: expectedHandoffVersion,
    accountId: row.accountId, keyType: row.keyType, environmentId: row.environmentId, status: 'ready' };
}

/** Verify one customer Stripe key, copy that exact locked Vault value to the
 * matching customer Vercel environment, erase Tayar's raw copy, then expose
 * only a ready account/receipt in the infrastructure registry. */
export async function handoffOwnedStripeRuntime(input: {
  client: RpcClient;
  stripeConnectionId: string;
  vercelConnectionId: string;
  handoffId: string;
  projectId: string;
  ownerId: string;
  vercelConnectionVersion: number;
  expectedHandoffVersion: number;
  expectedStripeConnectionVersion: number;
  sourceConnectionId: string;
  sourceUpdatedAt: string;
  publishableKey: string;
  environment: 'preview' | 'production';
  operationId: string;
  handoffCommitId: string;
  stripeCommitId: string;
  isCurrent(): boolean;
  fetcher?: typeof fetch;
}): Promise<OwnedStripeRuntimeReceipt> {
  try {
    if (typeof window !== 'undefined'
      || ![input.stripeConnectionId,input.vercelConnectionId,input.handoffId,input.projectId,input.ownerId,
        input.operationId,input.handoffCommitId,input.stripeCommitId].every(value=>uuid.test(value))
      || !integrationId.test(input.sourceConnectionId)
      || !Number.isSafeInteger(input.vercelConnectionVersion) || input.vercelConnectionVersion < 1
      || !Number.isSafeInteger(input.expectedHandoffVersion) || input.expectedHandoffVersion < 0
      || !Number.isSafeInteger(input.expectedStripeConnectionVersion) || input.expectedStripeConnectionVersion < 0
      || !Number.isFinite(Date.parse(input.sourceUpdatedAt)) || !input.isCurrent()) throw new Error();
    const publicMatch=publishable.exec(input.publishableKey);
    const expectedMode=input.environment==='production'?'live':'test';
    if(!publicMatch||publicMatch[1]!==expectedMode)throw new Error();

    const reconcileArgs={p_connection_id:input.stripeConnectionId,p_project_id:input.projectId,p_owner_id:input.ownerId,
      p_expected_connection_version:input.expectedStripeConnectionVersion,p_handoff_id:input.handoffId,
      p_expected_handoff_version:input.expectedHandoffVersion,p_commit_id:input.stripeCommitId};
    const reconcile=async()=>{
      const result=await input.client.rpc('website_reconcile_stripe_runtime_binding',reconcileArgs);
      if(result.error||!input.isCurrent())throw new Error();
      return stripeRuntimeReceipt(result.data,input.expectedStripeConnectionVersion+1,input.expectedHandoffVersion+2);
    };
    const completed=await reconcile();
    if(completed)return completed;

    await handoffOwnedSecretToVercel({
      client:input.client,handoffId:input.handoffId,connectionId:input.vercelConnectionId,
      projectId:input.projectId,ownerId:input.ownerId,connectionVersion:input.vercelConnectionVersion,
      expectedHandoffVersion:input.expectedHandoffVersion,sourceConnectionId:input.sourceConnectionId,
      sourceField:'secretKey',sourceEnvironment:input.environment,sourceUpdatedAt:input.sourceUpdatedAt,
      environmentKey:'STRIPE_SECRET_KEY',target:input.environment,
      gitBranch:input.environment==='preview'?`tayar/${input.projectId}/preview`:'',
      operationId:input.operationId,commitId:input.handoffCommitId,isCurrent:input.isCurrent,fetcher:input.fetcher,
      verifySecret:async(secretKey,{handoffVersion})=>{
        const proof=await verifyOwnedStripeAccount({secretKey,publishableKey:input.publishableKey,
          environment:input.environment,isCurrent:input.isCurrent,fetcher:input.fetcher});
        const recorded=await input.client.rpc('website_record_stripe_secret_proof',{
          p_handoff_id:input.handoffId,p_project_id:input.projectId,p_owner_id:input.ownerId,
          p_handoff_version:handoffVersion,p_account_id:proof.accountId,p_key_type:proof.keyType,
          p_operation_id:input.operationId});
        if(recorded.error||recorded.data!==true||!input.isCurrent())throw new Error();
      },
    });
    if(!input.isCurrent())throw new Error();
    let receipt=await reconcile();
    if(receipt)return receipt;
    try{
      const activated=await input.client.rpc('website_activate_stripe_runtime',{
        p_connection_id:input.stripeConnectionId,p_project_id:input.projectId,p_owner_id:input.ownerId,
        p_expected_connection_version:input.expectedStripeConnectionVersion,p_handoff_id:input.handoffId,
        p_expected_handoff_version:input.expectedHandoffVersion,p_commit_id:input.stripeCommitId,
        p_stripe_commit_id:input.stripeCommitId
      });
      if(activated.error||activated.data!==input.expectedStripeConnectionVersion+1||!input.isCurrent())throw new Error();
    }catch{
      receipt=await reconcile();
      if(!receipt)throw new Error();
      return receipt;
    }
    receipt=await reconcile();
    if(!receipt)throw new Error();
    return receipt;
  } catch {
    throw new Error('Stripe runtime handoff unavailable.');
  }
}
