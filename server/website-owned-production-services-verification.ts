import type { SupabaseClient } from '@supabase/supabase-js';
import type { ByoSourceCapabilities } from '../src/modules/website-builder/core/application-byo-source-capabilities';
import type { OwnedEmailRuntimeSource, OwnedStripeRuntimeSource } from './website-owned-source-capture';
import { createOwnedRuntimeSecretPlan } from './website-owned-runtime-secret-plan';
import { inspectOwnedStripeRuntimeForPublish, verifyOwnedStripeRuntimeDestination } from './website-owned-stripe';
import { inspectOwnedEmailRuntimeForPublish, verifyOwnedEmailRuntimeDestination } from './website-owned-email-runtime';
import { inspectOwnedRuntimeSecretState, type OwnedGeneratedRuntimeSecret } from './website-owned-runtime-secret-staging';
import { verifyOwnedSecretInVercel } from './website-owned-vercel-environment';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const provider=/^[A-Za-z0-9_-]{3,128}$/;const project=/^prj_[A-Za-z0-9]{8,128}$/;
const generated:OwnedGeneratedRuntimeSecret[]=[
  {sourceConnectionId:'runtime-supabase',sourceField:'apiKey',environmentKey:'SUPABASE_SECRET_KEY'},
  {sourceConnectionId:'runtime-cron',sourceField:'secret',environmentKey:'CRON_SECRET'},
];

/** Re-proves every supported customer service secret through durable metadata
 * and non-decrypting Vercel reads. Unsupported secret requirements fail closed. */
export async function verifyWebsiteOwnedProductionServices(input:{
  client:Pick<SupabaseClient,'rpc'>;projectId:string;ownerId:string;
  vercelConnectionId:string;vercelConnectionVersion:number;
  capabilities:ByoSourceCapabilities;stripeRuntime:OwnedStripeRuntimeSource|null;
  emailRuntime:OwnedEmailRuntimeSource|null;
  vercel:{accessToken:string;userId:string;accountId:string;vercelProjectId:string};
  isCurrent():boolean|Promise<boolean>;fetcher?:typeof fetch;
}):Promise<{environmentIds:Record<string,string>}>{
  try{
    if(typeof window!=='undefined'||![input.projectId,input.ownerId,input.vercelConnectionId].every(value=>uuid.test(value))
      ||!Number.isSafeInteger(input.vercelConnectionVersion)||input.vercelConnectionVersion<1
      ||!input.vercel.accessToken||input.vercel.accessToken.length>4096||/[\r\n]/.test(input.vercel.accessToken)
      ||!provider.test(input.vercel.userId)||!provider.test(input.vercel.accountId)
      ||!project.test(input.vercel.vercelProjectId)||input.capabilities.blockers.length
      ||input.capabilities.needs.cms||!await input.isCurrent())throw new Error();
    const providers=new Set(input.capabilities.integrationProviders);
    if(providers.size!==input.capabilities.integrationProviders.length
      ||[...providers].some(value=>!['stripe','resend'].includes(value))
      ||providers.has('stripe')!==Boolean(input.stripeRuntime)
      ||providers.has('resend')!==Boolean(input.emailRuntime))throw new Error();
    const plan=createOwnedRuntimeSecretPlan({environment:'production',capabilities:input.capabilities,
      emailConnections:input.emailRuntime?.connections.map(connection=>({id:connection.sourceConnectionId,from:connection.from}))});
    const requirements=new Set(plan.requirements.map(requirement=>requirement.key));
    for(const key of ['SUPABASE_URL','SUPABASE_ANON_KEY'])requirements.delete(key);
    const environmentIds:Record<string,string>={};
    const current=async()=>Boolean(await input.isCurrent());
    if(input.stripeRuntime){
      if(!requirements.delete('STRIPE_SECRET_KEY'))throw new Error();
      const state=await inspectOwnedStripeRuntimeForPublish({client:input.client,projectId:input.projectId,ownerId:input.ownerId,
        vercelConnectionId:input.vercelConnectionId,vercelConnectionVersion:input.vercelConnectionVersion,
        sourceConnectionId:input.stripeRuntime.sourceConnectionId,sourceUpdatedAt:input.stripeRuntime.sourceUpdatedAt,
        environment:'production'});
      if(!state.ready||!state.environmentId||!state.handoffOperationId||!await current())throw new Error();
      await verifyOwnedStripeRuntimeDestination({...input.vercel,environmentId:state.environmentId,projectId:input.projectId,
        environment:'production',handoffOperationId:state.handoffOperationId,isCurrent:current,fetcher:input.fetcher});
      environmentIds.STRIPE_SECRET_KEY=state.environmentId;
    }else if(requirements.has('STRIPE_SECRET_KEY'))throw new Error();
    if(input.emailRuntime){
      for(const connection of input.emailRuntime.connections){
        if(!requirements.delete(connection.environmentKey))throw new Error();
        const state=await inspectOwnedEmailRuntimeForPublish({client:input.client,projectId:input.projectId,ownerId:input.ownerId,
          vercelConnectionId:input.vercelConnectionId,vercelConnectionVersion:input.vercelConnectionVersion,
          sourceConnectionId:connection.sourceConnectionId,sourceUpdatedAt:connection.sourceUpdatedAt,
          environmentKey:connection.environmentKey,environment:'production'});
        if(!state.ready||!state.environmentId||!state.handoffOperationId||!await current())throw new Error();
        await verifyOwnedEmailRuntimeDestination({...input.vercel,environmentId:state.environmentId,
          environmentKey:connection.environmentKey,projectId:input.projectId,environment:'production',
          handoffOperationId:state.handoffOperationId,isCurrent:current,fetcher:input.fetcher});
        environmentIds[connection.environmentKey]=state.environmentId;
      }
      for(const secret of generated){
        if(!requirements.delete(secret.environmentKey))throw new Error();
        const state=await inspectOwnedRuntimeSecretState({client:input.client,projectId:input.projectId,ownerId:input.ownerId,
          vercelConnectionId:input.vercelConnectionId,vercelConnectionVersion:input.vercelConnectionVersion,
          secret,environment:'production'});
        if(!state.ready||!state.environmentId||!state.handoffOperationId||!await current())throw new Error();
        await verifyOwnedSecretInVercel({...input.vercel,environmentId:state.environmentId,
          environmentKey:secret.environmentKey,target:'production',gitBranch:'',operationId:state.handoffOperationId,
          isCurrent:current,fetcher:input.fetcher});
        environmentIds[secret.environmentKey]=state.environmentId;
      }
    }else if(generated.some(secret=>requirements.has(secret.environmentKey))
      ||[...requirements].some(key=>key.startsWith('TAYAR_RESEND_')))throw new Error();
    // STRIPE_WEBHOOK_SECRET and any future service key require a dedicated,
    // independently verified receipt before Production staging can support them.
    if(requirements.size||!await current())throw new Error();
    return{environmentIds:Object.fromEntries(Object.entries(environmentIds).sort(([left],[right])=>left.localeCompare(right)))};
  }catch{throw new Error('Customer Production service verification is unavailable.');}
}
