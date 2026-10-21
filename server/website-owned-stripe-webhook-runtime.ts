import type { SupabaseClient } from '@supabase/supabase-js';
import { handoffOwnedSecretToVercel,verifyOwnedSecretInVercel } from './website-owned-vercel-environment';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const connection=/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;
const endpoint=/^we_[A-Za-z0-9]{8,128}$/;const identity=/^[A-Za-z0-9_-]{3,128}$/;
const webhookSecret=/^whsec_[A-Za-z0-9+/=_-]{16,300}$/;
type RpcClient=Pick<SupabaseClient,'rpc'>;

export interface OwnedStripeWebhookPublishState{
  handoffId:string|null;handoffVersion:number;handoffStatus:'preparing'|'verified'|'removed'|null;
  handoffOperationId:string|null;environmentId:string|null;sourceAvailable:boolean;
  endpointProofVerified:boolean;ready:boolean;
}

function object(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value as Record<string,unknown>;
}

function exactOrigin(value:string){
  const url=new URL(value);return url.protocol==='https:'&&url.origin===value&&!url.username&&!url.password&&!url.port
    &&url.hostname.includes('.')&&url.hostname!=='localhost'&&!url.hostname.endsWith('.localhost')
    &&!/^[0-9]+(?:\.[0-9]+){3}$/.test(url.hostname)&&!url.hostname.includes(':');
}

/** Reads only custody metadata and requires the durable proof made from the
 * same locked Stripe account key before admitting a signing-secret handoff. */
export async function inspectOwnedStripeWebhookRuntimeForPublish(input:{
  client:RpcClient;projectId:string;ownerId:string;vercelConnectionId:string;vercelConnectionVersion:number;
  sourceConnectionId:string;stripeSourceUpdatedAt:string;webhookSourceUpdatedAt:string;
  endpointId:string;applicationOrigin:string;environment:'preview'|'production';
}):Promise<OwnedStripeWebhookPublishState>{
  try{
    if(typeof window!=='undefined'||![input.projectId,input.ownerId,input.vercelConnectionId].every(v=>uuid.test(v))
      ||!Number.isSafeInteger(input.vercelConnectionVersion)||input.vercelConnectionVersion<1
      ||!connection.test(input.sourceConnectionId)||!Number.isFinite(Date.parse(input.stripeSourceUpdatedAt))
      ||!Number.isFinite(Date.parse(input.webhookSourceUpdatedAt))||!endpoint.test(input.endpointId)
      ||!exactOrigin(input.applicationOrigin))throw new Error();
    const{data,error}=await input.client.rpc('website_stripe_webhook_runtime_state_for_worker',{
      p_project_id:input.projectId,p_owner_id:input.ownerId,p_vercel_connection_id:input.vercelConnectionId,
      p_vercel_connection_version:input.vercelConnectionVersion,p_source_connection_id:input.sourceConnectionId,
      p_stripe_source_updated_at:input.stripeSourceUpdatedAt,p_webhook_source_updated_at:input.webhookSourceUpdatedAt,
      p_endpoint_id:input.endpointId,p_application_origin:input.applicationOrigin,p_environment:input.environment});
    if(error)throw new Error();const row=object(data);
    const keys=['endpointProofVerified','environmentId','handoffId','handoffOperationId','handoffStatus',
      'handoffVersion','ready','sourceAvailable'];
    if(Object.keys(row).sort().join(',')!==keys.sort().join(','))throw new Error();
    const handoffId=row.handoffId,status=row.handoffStatus,operationId=row.handoffOperationId,environmentId=row.environmentId;
    if(!Number.isSafeInteger(row.handoffVersion)||(row.handoffVersion as number)<0
      ||typeof row.sourceAvailable!=='boolean'||typeof row.endpointProofVerified!=='boolean'||row.endpointProofVerified!==true
      ||typeof row.ready!=='boolean'||(handoffId===null)!==(row.handoffVersion===0)
      ||(handoffId===null&&(status!==null||operationId!==null||environmentId!==null))
      ||(handoffId!==null&&(typeof handoffId!=='string'||!uuid.test(handoffId)
        ||!['preparing','verified','removed'].includes(String(status))
        ||typeof operationId!=='string'||!uuid.test(operationId)))
      ||(environmentId!==null&&(typeof environmentId!=='string'||!identity.test(environmentId)))
      ||(status==='verified'&&environmentId===null)
      ||(row.ready===true&&(status!=='verified'||environmentId===null||row.sourceAvailable!==false)))throw new Error();
    return structuredClone(row) as unknown as OwnedStripeWebhookPublishState;
  }catch{throw new Error('Stripe webhook runtime state unavailable.');}
}

export async function verifyOwnedStripeWebhookRuntimeDestination(input:{
  accessToken:string;userId:string;accountId:string;vercelProjectId:string;environmentId:string;
  projectId:string;environment:'preview'|'production';handoffOperationId:string;
  isCurrent():boolean|Promise<boolean>;fetcher?:typeof fetch;
}){
  try{
    if(!uuid.test(input.projectId)||!identity.test(input.environmentId))throw new Error();
    await verifyOwnedSecretInVercel({accessToken:input.accessToken,userId:input.userId,accountId:input.accountId,
      vercelProjectId:input.vercelProjectId,environmentId:input.environmentId,environmentKey:'STRIPE_WEBHOOK_SECRET',
      target:input.environment,gitBranch:input.environment==='preview'?`tayar/${input.projectId}/preview`:'',
      operationId:input.handoffOperationId,isCurrent:input.isCurrent,fetcher:input.fetcher});
  }catch{throw new Error('Stripe webhook runtime destination unavailable.');}
}

/** Copies only a syntactically valid signing secret to the exact customer
 * Vercel scope. The generic handoff erases Tayar's Vault value after proof. */
export async function handoffOwnedStripeWebhookRuntime(input:{
  client:RpcClient;handoffId:string;vercelConnectionId:string;projectId:string;ownerId:string;
  vercelConnectionVersion:number;expectedHandoffVersion:number;sourceConnectionId:string;
  sourceUpdatedAt:string;environment:'preview'|'production';operationId:string;commitId:string;
  isCurrent():boolean;fetcher?:typeof fetch;
}){
  try{
    const receipt=await handoffOwnedSecretToVercel({client:input.client,handoffId:input.handoffId,
      connectionId:input.vercelConnectionId,projectId:input.projectId,ownerId:input.ownerId,
      connectionVersion:input.vercelConnectionVersion,expectedHandoffVersion:input.expectedHandoffVersion,
      sourceConnectionId:input.sourceConnectionId,sourceField:'webhookSigningSecret',
      sourceEnvironment:input.environment,sourceUpdatedAt:input.sourceUpdatedAt,
      environmentKey:'STRIPE_WEBHOOK_SECRET',target:input.environment,
      gitBranch:input.environment==='preview'?`tayar/${input.projectId}/preview`:'',operationId:input.operationId,
      commitId:input.commitId,isCurrent:input.isCurrent,fetcher:input.fetcher,
      verifySecret:async value=>{if(!webhookSecret.test(value)||!input.isCurrent())throw new Error();}});
    if(!input.isCurrent())throw new Error();return receipt;
  }catch{throw new Error('Stripe webhook runtime handoff unavailable.');}
}
