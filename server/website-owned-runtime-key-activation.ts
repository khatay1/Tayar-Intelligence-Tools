import type { SupabaseClient } from '@supabase/supabase-js';
import type { OwnedSupabaseCustody } from './website-owned-supabase-custody';
import { ensureOwnedSupabaseRuntimeKey,generateOwnedCronSecret } from './website-owned-runtime-key-provisioning';
import { inspectOwnedRuntimeSecretState,stageOwnedRuntimeSecret,
  type OwnedGeneratedRuntimeSecret } from './website-owned-runtime-secret-staging';
import { handoffOwnedSecretToVercel,verifyOwnedSecretInVercel } from './website-owned-vercel-environment';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const identity=/^[A-Za-z0-9_-]{3,128}$/;const project=/^prj_[A-Za-z0-9]{8,128}$/;
type Client=Pick<SupabaseClient,'rpc'>;type Environment='preview'|'production';
const specifications:OwnedGeneratedRuntimeSecret[]=[
 {sourceConnectionId:'runtime-supabase',sourceField:'apiKey',environmentKey:'SUPABASE_SECRET_KEY'},
 {sourceConnectionId:'runtime-cron',sourceField:'secret',environmentKey:'CRON_SECRET'},
];
async function deterministicUuid(value:unknown){
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))));
 bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
 const hex=[...bytes.slice(0,16)].map(v=>v.toString(16).padStart(2,'0')).join('');
 return`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

/** Final-activation entry point. This function is intentionally not mounted in
 * normal publish flow: an explicit approved activation supplies both provider
 * custodies, then receives metadata-only receipts after temporary Vault erasure. */
export async function activateOwnedRuntimeKeys(input:{client:Client;activationId:string;projectId:string;ownerId:string;
 environment:Environment;vercelConnectionId:string;vercelConnectionVersion:number;supabaseCustody:OwnedSupabaseCustody;
 vercel:{accessToken:string;userId:string;accountId:string;vercelProjectId:string};
 isCurrent():boolean|Promise<boolean>;fetcher?:typeof fetch;
}):Promise<Array<{environmentKey:'SUPABASE_SECRET_KEY'|'CRON_SECRET';environmentId:string;handoffVersion:number}>>{
 try{
  if(typeof window!=='undefined'||![input.activationId,input.projectId,input.ownerId,input.vercelConnectionId].every(v=>uuid.test(v))
   ||!Number.isSafeInteger(input.vercelConnectionVersion)||input.vercelConnectionVersion<1
   ||input.supabaseCustody.environment!==input.environment||!identity.test(input.vercel.userId)
   ||!identity.test(input.vercel.accountId)||!project.test(input.vercel.vercelProjectId)
   ||!input.vercel.accessToken||input.vercel.accessToken.length>4096||/[\r\n]/.test(input.vercel.accessToken)
   ||!await input.isCurrent())throw new Error();
  let current=true;const exact=async()=>{if(!current)return false;current=await input.isCurrent();return current;};
  const receipts:Array<{environmentKey:'SUPABASE_SECRET_KEY'|'CRON_SECRET';environmentId:string;handoffVersion:number}>=[];
  const branch=input.environment==='preview'?`tayar/${input.projectId}/preview`:'';
  for(const secret of specifications){
   if(!await exact())throw new Error();
   let state=await inspectOwnedRuntimeSecretState({client:input.client,projectId:input.projectId,ownerId:input.ownerId,
    vercelConnectionId:input.vercelConnectionId,vercelConnectionVersion:input.vercelConnectionVersion,
    secret,environment:input.environment});
   if(state.ready){if(!state.environmentId||!state.handoffOperationId)throw new Error();
    await verifyOwnedSecretInVercel({...input.vercel,environmentId:state.environmentId,environmentKey:secret.environmentKey,
     target:input.environment,gitBranch:branch,operationId:state.handoffOperationId,isCurrent:exact,fetcher:input.fetcher});
    receipts.push({environmentKey:secret.environmentKey,environmentId:state.environmentId,handoffVersion:state.handoffVersion});continue;}
   if(state.handoffStatus==='removed'||state.stageId!==null&&!state.sourceAvailable&&state.handoffStatus!=='verified')throw new Error();
   if(state.stageId===null){
    const value=secret.environmentKey==='SUPABASE_SECRET_KEY'
     ?(await ensureOwnedSupabaseRuntimeKey({custody:input.supabaseCustody,isCurrent:exact,fetcher:input.fetcher})).apiKey
     :generateOwnedCronSecret();
    const stageId=await deterministicUuid({kind:'runtime-secret-stage',projectId:input.projectId,
     environment:input.environment,environmentKey:secret.environmentKey});
    const stageOperationId=await deterministicUuid({kind:'runtime-secret-stage-operation',activationId:input.activationId,
     environmentKey:secret.environmentKey});
    try{await stageOwnedRuntimeSecret({client:input.client,stageId,projectId:input.projectId,ownerId:input.ownerId,
      expectedStageVersion:0,secret,environment:input.environment,operationId:stageOperationId,value});}catch{
      state=await inspectOwnedRuntimeSecretState({client:input.client,projectId:input.projectId,ownerId:input.ownerId,
       vercelConnectionId:input.vercelConnectionId,vercelConnectionVersion:input.vercelConnectionVersion,
       secret,environment:input.environment});
      if(state.stageId!==stageId||state.stageOperationId!==stageOperationId)throw new Error();
    }
    state=await inspectOwnedRuntimeSecretState({client:input.client,projectId:input.projectId,ownerId:input.ownerId,
     vercelConnectionId:input.vercelConnectionId,vercelConnectionVersion:input.vercelConnectionVersion,
     secret,environment:input.environment});
   }
   if(!state.stageId||!state.sourceUpdatedAt||!state.sourceAvailable)throw new Error();
   const handoffId=state.handoffId??await deterministicUuid({kind:'runtime-secret-handoff',projectId:input.projectId,
    environment:input.environment,environmentKey:secret.environmentKey,vercelConnectionId:input.vercelConnectionId});
   const handoffOperationId=state.handoffOperationId??await deterministicUuid({kind:'runtime-secret-handoff-operation',
    stageOperationId:state.stageOperationId,environmentKey:secret.environmentKey});
   let expectedHandoffVersion=state.handoffVersion;
   if(state.handoffStatus==='preparing')expectedHandoffVersion-=1;
   if(state.handoffStatus==='verified')expectedHandoffVersion-=2;
   if(expectedHandoffVersion<0)throw new Error();
   const receipt=await handoffOwnedSecretToVercel({client:input.client,handoffId,
    connectionId:input.vercelConnectionId,projectId:input.projectId,ownerId:input.ownerId,
    connectionVersion:input.vercelConnectionVersion,expectedHandoffVersion,sourceConnectionId:secret.sourceConnectionId,
    sourceField:secret.sourceField,sourceEnvironment:input.environment,sourceUpdatedAt:state.sourceUpdatedAt,
    environmentKey:secret.environmentKey,target:input.environment,gitBranch:branch,operationId:handoffOperationId,
    commitId:await deterministicUuid({kind:'runtime-secret-handoff-commit',handoffOperationId,sourceUpdatedAt:state.sourceUpdatedAt}),
    isCurrent:()=>current,fetcher:input.fetcher,verifySecret:async value=>{
     if(secret.environmentKey==='SUPABASE_SECRET_KEY'){
      if(!value.startsWith(['sb','secret',''].join('_'))||value.length>512||/[\r\n]/.test(value))throw new Error();
     }else if(!/^[A-Za-z0-9_-]{43}$/.test(value))throw new Error();
    }});
   if(!await exact())throw new Error();
   await verifyOwnedSecretInVercel({...input.vercel,environmentId:receipt.environmentId,environmentKey:secret.environmentKey,
    target:input.environment,gitBranch:branch,operationId:handoffOperationId,isCurrent:exact,fetcher:input.fetcher});
   receipts.push({environmentKey:secret.environmentKey,environmentId:receipt.environmentId,handoffVersion:receipt.handoffVersion});
  }
  return receipts;
 }catch{throw new Error('Customer runtime key activation unavailable.');}
}
