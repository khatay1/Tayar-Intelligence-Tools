import type { SupabaseClient } from '@supabase/supabase-js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const provider=/^[A-Za-z0-9_-]{3,128}$/; const project=/^prj_[A-Za-z0-9]{8,128}$/;
const key=/^[A-Z][A-Z0-9_]{1,99}$/; const branch=/^[A-Za-z0-9_./-]{1,200}$/;
const connection=/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/; const field=/^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

type RpcClient=Pick<SupabaseClient,'rpc'>;
type BeginResult={handoffVersion:number;accessToken:string;secretValue:string;userId:string;accountId:string;vercelProjectId:string};
type RemovalResult={alreadyRemoved:boolean;handoffVersion:number;accessToken?:string;userId?:string;accountId?:string;
  vercelProjectId?:string;environmentId?:string;environmentKey?:string;target?:string;gitBranch?:string};

function validBranch(value:string){return value===''||(branch.test(value)&&!value.includes('..')&&!value.startsWith('/')&&!value.endsWith('/'));}
function parseObject(raw:string):Record<string,unknown>{const value:unknown=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value as Record<string,unknown>;}
function verifiedHandoff(value:unknown,expectedVersion:number){
  if(value===null)return null;
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();
  const row=value as Record<string,unknown>;
  if(Object.keys(row).sort().join(',')!=='environmentId,handoffVersion'
    ||row.handoffVersion!==expectedVersion||typeof row.environmentId!=='string'||!provider.test(row.environmentId))throw new Error();
  return{handoffVersion:expectedVersion,environmentId:row.environmentId};
}

/** Copies one Vault value into a write-only customer Vercel variable, verifies
 * destination metadata, then commits the receipt and erases Tayar's Vault copy. */
export async function handoffOwnedSecretToVercel(input:{
  client:RpcClient; handoffId:string; connectionId:string; projectId:string; ownerId:string;
  connectionVersion:number; expectedHandoffVersion:number; sourceConnectionId:string;
  sourceField:string; sourceEnvironment:'preview'|'staging'|'production'; sourceUpdatedAt:string;
  environmentKey:string; target:'preview'|'production'; gitBranch:string; operationId:string;
  commitId:string; isCurrent():boolean; fetcher?:typeof fetch;
  verifySecret?(value:string,context:{handoffVersion:number}):Promise<void>;
}):Promise<{handoffVersion:number;environmentId:string;status:'verified'}>{
  if(typeof window!=='undefined'||![input.handoffId,input.connectionId,input.projectId,input.ownerId,input.operationId,input.commitId].every(v=>uuid.test(v))
    ||!Number.isSafeInteger(input.connectionVersion)||input.connectionVersion<1
    ||!Number.isSafeInteger(input.expectedHandoffVersion)||input.expectedHandoffVersion<0
    ||!connection.test(input.sourceConnectionId)||!field.test(input.sourceField)||!key.test(input.environmentKey)
    ||!['preview','staging','production'].includes(input.sourceEnvironment)||!['preview','production'].includes(input.target)
    ||!validBranch(input.gitBranch)||(input.target==='production'&&input.gitBranch!=='')
    ||!Number.isFinite(Date.parse(input.sourceUpdatedAt))||!input.isCurrent())throw new Error('Vercel secret handoff unavailable.');
  const completedArgs={p_id:input.handoffId,p_connection_id:input.connectionId,p_project_id:input.projectId,p_owner_id:input.ownerId,
    p_connection_version:input.connectionVersion,p_expected_handoff_version:input.expectedHandoffVersion,
    p_source_connection_id:input.sourceConnectionId,p_source_field:input.sourceField,
    p_source_environment:input.sourceEnvironment,p_environment_key:input.environmentKey,
    p_target:input.target,p_git_branch:input.gitBranch,p_operation_id:input.operationId};
  const completed=await input.client.rpc('website_reconcile_completed_vercel_secret_handoff',completedArgs);
  if(completed.error||!input.isCurrent())throw new Error('Vercel secret handoff unavailable.');
  const verified=verifiedHandoff(completed.data,input.expectedHandoffVersion+2);
  if(verified)return{...verified,status:'verified'};
  const base={p_id:input.handoffId,p_connection_id:input.connectionId,p_project_id:input.projectId,p_owner_id:input.ownerId,
    p_connection_version:input.connectionVersion,p_expected_handoff_version:input.expectedHandoffVersion,
    p_source_connection_id:input.sourceConnectionId,p_source_field:input.sourceField,
    p_source_environment:input.sourceEnvironment,p_source_updated_at:input.sourceUpdatedAt,
    p_environment_key:input.environmentKey,p_target:input.target,p_git_branch:input.gitBranch,p_operation_id:input.operationId};
  const begun=await input.client.rpc('website_begin_vercel_secret_handoff',base);
  const data=begun.data as BeginResult|null;
  if(begun.error||!data||!Number.isSafeInteger(data.handoffVersion)||data.handoffVersion<1
    ||typeof data.accessToken!=='string'||data.accessToken.length<20||data.accessToken.length>4096||/[\r\n]/.test(data.accessToken)
    ||typeof data.secretValue!=='string'||!data.secretValue||new TextEncoder().encode(data.secretValue).length>16384
    ||!provider.test(data.userId)||!provider.test(data.accountId)||!project.test(data.vercelProjectId)||!input.isCurrent())
    throw new Error('Vercel secret handoff unavailable.');
  if(input.verifySecret){
    try{await input.verifySecret(data.secretValue,{handoffVersion:data.handoffVersion});}
    catch{throw new Error('Vercel secret handoff unavailable.');}
    if(!input.isCurrent())throw new Error('Vercel secret handoff unavailable.');
  }
  const fetcher=input.fetcher??fetch; const team=data.accountId!==data.userId?`&teamId=${encodeURIComponent(data.accountId)}`:'';
  const marker=`Tayar handoff ${input.operationId}`; const target=[input.target];
  const headers={Authorization:`Bearer ${data.accessToken}`,'Content-Type':'application/json',Accept:'application/json'};
  const path=`/v10/projects/${data.vercelProjectId}/env`;
  try{
    if(!input.isCurrent())throw new Error();
    try{await fetcher(`https://api.vercel.com${path}?upsert=true${team}`,{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000),headers,
      body:JSON.stringify({key:input.environmentKey,value:data.secretValue,type:'sensitive',target,
        ...(input.gitBranch?{gitBranch:input.gitBranch}:{}),comment:marker})});}catch{/* verify exact marker after an uncertain response */}
    if(!input.isCurrent())throw new Error();
    const response=await fetcher(`https://api.vercel.com${path}?decrypt=false${team}`,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000),headers});
    if(response.status!==200||Number(response.headers.get('content-length')??0)>262144)throw new Error();
    const raw=await response.text();if(raw.length>262144)throw new Error();const payload=parseObject(raw);
    if(!Array.isArray(payload.envs)||payload.envs.length>1000)throw new Error();
    const matches=payload.envs.filter(value=>{if(!value||typeof value!=='object'||Array.isArray(value))return false;const row=value as Record<string,unknown>;
      const targets=Array.isArray(row.target)?row.target:[];return row.key===input.environmentKey&&row.type==='sensitive'
        &&row.comment===marker&&targets.length===1&&targets[0]===input.target
        &&String(row.gitBranch??'')===input.gitBranch&&typeof row.id==='string'&&provider.test(row.id);});
    if(matches.length!==1||!input.isCurrent())throw new Error();const environmentId=(matches[0] as Record<string,unknown>).id as string;
    const commitArgs={p_id:input.handoffId,p_project_id:input.projectId,p_owner_id:input.ownerId,
      p_expected_handoff_version:data.handoffVersion,p_operation_id:input.operationId,
      p_vercel_environment_id:environmentId,p_commit_id:input.commitId};
    const expected=data.handoffVersion+1;const reconcile=async()=>{const result=await input.client.rpc('website_reconcile_vercel_secret_handoff',commitArgs);
      return !result.error&&result.data===expected&&input.isCurrent();};
    if(!await reconcile()){try{const result=await input.client.rpc('website_commit_vercel_secret_handoff',commitArgs);
      if(result.error||result.data!==expected||!input.isCurrent())throw new Error();}catch{if(!await reconcile())throw new Error();}}
    return{handoffVersion:expected,environmentId,status:'verified'};
  }catch{throw new Error('Vercel secret handoff unavailable.');}
}

/** Deletes only the destination ID recorded by the verified receipt. A second
 * non-decrypting list must prove that ID absent before the receipt is removed. */
export async function removeOwnedSecretFromVercel(input:{
  client:RpcClient;handoffId:string;projectId:string;ownerId:string;connectionVersion:number;
  expectedHandoffVersion:number;operationId:string;commitId:string;isCurrent():boolean;fetcher?:typeof fetch;
}):Promise<{handoffVersion:number;status:'removed'}>{
  if(typeof window!=='undefined'||![input.handoffId,input.projectId,input.ownerId,input.operationId,input.commitId].every(v=>uuid.test(v))
    ||!Number.isSafeInteger(input.connectionVersion)||input.connectionVersion<1
    ||!Number.isSafeInteger(input.expectedHandoffVersion)||input.expectedHandoffVersion<1||!input.isCurrent())
    throw new Error('Vercel secret removal unavailable.');
  const completedArgs={p_id:input.handoffId,p_project_id:input.projectId,p_owner_id:input.ownerId,
    p_expected_handoff_version:input.expectedHandoffVersion,p_operation_id:input.operationId,p_commit_id:input.commitId};
  const completed=await input.client.rpc('website_reconcile_completed_vercel_secret_removal',completedArgs);
  if(completed.error||!input.isCurrent()||(completed.data!=null&&completed.data!==input.expectedHandoffVersion+2))
    throw new Error('Vercel secret removal unavailable.');
  if(completed.data===input.expectedHandoffVersion+2)return{handoffVersion:completed.data,status:'removed'};
  const begun=await input.client.rpc('website_begin_vercel_secret_removal',{p_id:input.handoffId,
    p_project_id:input.projectId,p_owner_id:input.ownerId,p_connection_version:input.connectionVersion,
    p_expected_handoff_version:input.expectedHandoffVersion,p_operation_id:input.operationId});
  const data=begun.data as RemovalResult|null;
  if(begun.error||!data||!Number.isSafeInteger(data.handoffVersion)||data.handoffVersion<2||!input.isCurrent())
    throw new Error('Vercel secret removal unavailable.');
  if(data.alreadyRemoved===true){if(data.handoffVersion!==input.expectedHandoffVersion+2)throw new Error('Vercel secret removal unavailable.');
    return{handoffVersion:data.handoffVersion,status:'removed'};}
  if(data.alreadyRemoved!==false||data.handoffVersion!==input.expectedHandoffVersion+1
    ||typeof data.accessToken!=='string'||data.accessToken.length<20||data.accessToken.length>4096||/[\r\n]/.test(data.accessToken)
    ||typeof data.userId!=='string'||!provider.test(data.userId)||typeof data.accountId!=='string'||!provider.test(data.accountId)
    ||typeof data.vercelProjectId!=='string'||!project.test(data.vercelProjectId)
    ||typeof data.environmentId!=='string'||!provider.test(data.environmentId)
    ||typeof data.environmentKey!=='string'||!key.test(data.environmentKey)
    ||!['preview','production'].includes(String(data.target))||typeof data.gitBranch!=='string'||!validBranch(data.gitBranch)
    ||(data.target==='production'&&data.gitBranch!==''))throw new Error('Vercel secret removal unavailable.');
  const fetcher=input.fetcher??fetch;const team=data.accountId!==data.userId?`&teamId=${encodeURIComponent(data.accountId)}`:'';
  const headers={Authorization:`Bearer ${data.accessToken}`,'Content-Type':'application/json',Accept:'application/json'};
  const listUrl=`https://api.vercel.com/v10/projects/${data.vercelProjectId}/env?decrypt=false${team}`;
  const read=async()=>{const response=await fetcher(listUrl,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000),headers});
    if(response.status!==200||Number(response.headers.get('content-length')??0)>262144)throw new Error();const raw=await response.text();
    if(raw.length>262144)throw new Error();const payload=parseObject(raw);if(!Array.isArray(payload.envs)||payload.envs.length>1000)throw new Error();return payload.envs;};
  try{
    const before=await read();if(!input.isCurrent())throw new Error();const found=before.filter(value=>{if(!value||typeof value!=='object'||Array.isArray(value))return false;
      return(value as Record<string,unknown>).id===data.environmentId;});
    if(found.length>1)throw new Error();
    if(found.length===1){const row=found[0] as Record<string,unknown>,targets=Array.isArray(row.target)?row.target:[];
      if(row.key!==data.environmentKey||row.type!=='sensitive'||targets.length!==1||targets[0]!==data.target
        ||String(row.gitBranch??'')!==data.gitBranch)throw new Error();
      try{await fetcher(`https://api.vercel.com/v9/projects/${data.vercelProjectId}/env/${data.environmentId}?${team.slice(1)}`,
        {method:'DELETE',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000),headers});}catch{/* absence proof resolves uncertain DELETE */}
    }
    if(!input.isCurrent())throw new Error();const after=await read();
    if(after.some(value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&(value as Record<string,unknown>).id===data.environmentId)
      ||!input.isCurrent())throw new Error();
    const args={p_id:input.handoffId,p_project_id:input.projectId,p_owner_id:input.ownerId,
      p_expected_removal_version:data.handoffVersion,p_operation_id:input.operationId,
      p_vercel_environment_id:data.environmentId,p_commit_id:input.commitId};const expected=data.handoffVersion+1;
    const reconcile=async()=>{const result=await input.client.rpc('website_reconcile_vercel_secret_removal',args);
      return !result.error&&result.data===expected&&input.isCurrent();};
    if(!await reconcile()){try{const result=await input.client.rpc('website_commit_vercel_secret_removal',args);
      if(result.error||result.data!==expected||!input.isCurrent())throw new Error();}catch{if(!await reconcile())throw new Error();}}
    return{handoffVersion:expected,status:'removed'};
  }catch{throw new Error('Vercel secret removal unavailable.');}
}
