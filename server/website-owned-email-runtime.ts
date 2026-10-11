import type { SupabaseClient } from '@supabase/supabase-js';
import { handoffOwnedSecretToVercel } from './website-owned-vercel-environment';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const identity=/^[A-Za-z0-9_-]{3,128}$/;const project=/^prj_[A-Za-z0-9]{8,128}$/;
const connection=/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;
const environmentKey=/^TAYAR_RESEND_(0[1-9]|[1-9][0-9])_API_KEY$/;
const resendKey=/^re_[A-Za-z0-9_-]{8,509}$/;
type RpcClient=Pick<SupabaseClient,'rpc'>;

export interface OwnedEmailPublishState{
  handoffId:string|null;handoffVersion:number;handoffStatus:'preparing'|'verified'|'removed'|null;
  handoffOperationId:string|null;environmentId:string|null;sourceAvailable:boolean;ready:boolean;
}

function object(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value as Record<string,unknown>;
}

/** Reads a metadata-only receipt for one exact Resend source version. */
export async function inspectOwnedEmailRuntimeForPublish(input:{
  client:RpcClient;projectId:string;ownerId:string;vercelConnectionId:string;vercelConnectionVersion:number;
  sourceConnectionId:string;sourceUpdatedAt:string;environmentKey:string;environment:'preview'|'production';
}):Promise<OwnedEmailPublishState>{
  try{
    if(typeof window!=='undefined'||![input.projectId,input.ownerId,input.vercelConnectionId].every(v=>uuid.test(v))
      ||!Number.isSafeInteger(input.vercelConnectionVersion)||input.vercelConnectionVersion<1
      ||!connection.test(input.sourceConnectionId)||!Number.isFinite(Date.parse(input.sourceUpdatedAt))
      ||!environmentKey.test(input.environmentKey))throw new Error();
    const{data,error}=await input.client.rpc('website_email_runtime_state_for_worker',{
      p_project_id:input.projectId,p_owner_id:input.ownerId,p_vercel_connection_id:input.vercelConnectionId,
      p_vercel_connection_version:input.vercelConnectionVersion,p_source_connection_id:input.sourceConnectionId,
      p_source_updated_at:input.sourceUpdatedAt,p_environment_key:input.environmentKey,p_environment:input.environment});
    if(error)throw new Error();const row=object(data);
    const keys=['environmentId','handoffId','handoffOperationId','handoffStatus','handoffVersion','ready','sourceAvailable'];
    if(Object.keys(row).sort().join(',')!==keys.sort().join(','))throw new Error();
    const handoffId=row.handoffId,status=row.handoffStatus,operationId=row.handoffOperationId,environmentId=row.environmentId;
    if(!Number.isSafeInteger(row.handoffVersion)||(row.handoffVersion as number)<0
      ||typeof row.sourceAvailable!=='boolean'||typeof row.ready!=='boolean'
      ||(handoffId===null)!==(row.handoffVersion===0)
      ||(handoffId===null&&(status!==null||operationId!==null||environmentId!==null))
      ||(handoffId!==null&&(typeof handoffId!=='string'||!uuid.test(handoffId)
        ||!['preparing','verified','removed'].includes(String(status))
        ||typeof operationId!=='string'||!uuid.test(operationId)))
      ||(environmentId!==null&&(typeof environmentId!=='string'||!identity.test(environmentId)))
      ||(status==='verified'&&environmentId===null)
      ||(row.ready===true&&(status!=='verified'||environmentId===null||row.sourceAvailable!==false)))throw new Error();
    return structuredClone(row) as unknown as OwnedEmailPublishState;
  }catch{throw new Error('Email runtime state unavailable.');}
}

/** Proves the exact sensitive Vercel destination still exists without decrypting it. */
export async function verifyOwnedEmailRuntimeDestination(input:{
  accessToken:string;userId:string;accountId:string;vercelProjectId:string;environmentId:string;
  environmentKey:string;projectId:string;environment:'preview'|'production';handoffOperationId:string;
  isCurrent():boolean|Promise<boolean>;fetcher?:typeof fetch;
}):Promise<void>{
  try{
    if(typeof window!=='undefined'||!input.accessToken||input.accessToken.length>4096||/[\r\n]/.test(input.accessToken)
      ||!identity.test(input.userId)||!identity.test(input.accountId)||!project.test(input.vercelProjectId)
      ||!identity.test(input.environmentId)||!environmentKey.test(input.environmentKey)
      ||!uuid.test(input.projectId)||!uuid.test(input.handoffOperationId)||!await input.isCurrent())throw new Error();
    const team=input.accountId!==input.userId?`&teamId=${encodeURIComponent(input.accountId)}`:'';
    const response=await(input.fetcher??fetch)(`https://api.vercel.com/v10/projects/${input.vercelProjectId}/env?decrypt=false${team}`,{
      method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000),
      headers:{Authorization:`Bearer ${input.accessToken}`,Accept:'application/json'}});
    if(response.status!==200||Number(response.headers.get('content-length')??0)>262144||!await input.isCurrent())throw new Error();
    const raw=await response.text();if(raw.length>262144)throw new Error();const payload=object(JSON.parse(raw));
    if(!Array.isArray(payload.envs)||payload.envs.length>1000)throw new Error();
    const branch=input.environment==='preview'?`tayar/${input.projectId}/preview`:'';
    const matches=payload.envs.filter(value=>{if(!value||typeof value!=='object'||Array.isArray(value))return false;
      const row=value as Record<string,unknown>,targets=Array.isArray(row.target)?row.target:[];
      return row.id===input.environmentId&&row.key===input.environmentKey&&row.type==='sensitive'
        &&targets.length===1&&targets[0]===input.environment&&String(row.gitBranch??'')===branch
        &&row.comment===`Tayar handoff ${input.handoffOperationId}`;});
    if(matches.length!==1||!await input.isCurrent())throw new Error();
  }catch{throw new Error('Email runtime destination unavailable.');}
}

/** Moves one saved Resend key to its deterministic write-only Vercel slot. */
export async function handoffOwnedEmailRuntime(input:{
  client:RpcClient;handoffId:string;vercelConnectionId:string;projectId:string;ownerId:string;
  vercelConnectionVersion:number;expectedHandoffVersion:number;sourceConnectionId:string;sourceUpdatedAt:string;
  environmentKey:string;environment:'preview'|'production';operationId:string;commitId:string;
  isCurrent():boolean;fetcher?:typeof fetch;
}){
  try{
    if(!environmentKey.test(input.environmentKey))throw new Error();
    return await handoffOwnedSecretToVercel({client:input.client,handoffId:input.handoffId,
      connectionId:input.vercelConnectionId,projectId:input.projectId,ownerId:input.ownerId,
      connectionVersion:input.vercelConnectionVersion,expectedHandoffVersion:input.expectedHandoffVersion,
      sourceConnectionId:input.sourceConnectionId,sourceField:'apiKey',sourceEnvironment:input.environment,
      sourceUpdatedAt:input.sourceUpdatedAt,environmentKey:input.environmentKey,target:input.environment,
      gitBranch:input.environment==='preview'?`tayar/${input.projectId}/preview`:'',operationId:input.operationId,
      commitId:input.commitId,isCurrent:input.isCurrent,fetcher:input.fetcher,
      verifySecret:async value=>{if(!resendKey.test(value)||value.length>512||/[\r\n]/.test(value))throw new Error();}});
  }catch{throw new Error('Email runtime handoff unavailable.');}
}
