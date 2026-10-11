import type { SupabaseClient } from '@supabase/supabase-js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const identity=/^[A-Za-z0-9_-]{3,128}$/;
type Client=Pick<SupabaseClient,'rpc'>;type Environment='preview'|'production';
export type OwnedGeneratedRuntimeSecret={sourceConnectionId:'runtime-supabase';sourceField:'apiKey';environmentKey:'SUPABASE_SECRET_KEY'}
 |{sourceConnectionId:'runtime-cron';sourceField:'secret';environmentKey:'CRON_SECRET'};
export interface OwnedRuntimeSecretState{
 stageId:string|null;stageVersion:number;stageOperationId:string|null;sourceUpdatedAt:string|null;
 handoffId:string|null;handoffVersion:number;handoffStatus:'preparing'|'verified'|'removed'|null;
 handoffOperationId:string|null;environmentId:string|null;sourceAvailable:boolean;ready:boolean;
}
function exactSecret(value:OwnedGeneratedRuntimeSecret){return(value.sourceConnectionId==='runtime-supabase'
  &&value.sourceField==='apiKey'&&value.environmentKey==='SUPABASE_SECRET_KEY')||(value.sourceConnectionId==='runtime-cron'
  &&value.sourceField==='secret'&&value.environmentKey==='CRON_SECRET');}
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value as Record<string,unknown>;}

/** Places a generated final-activation value in Vault exactly once per
 * operation. Returned data identifies the staged version but never the value. */
export async function stageOwnedRuntimeSecret(input:{client:Client;stageId:string;projectId:string;ownerId:string;
 expectedStageVersion:number;secret:OwnedGeneratedRuntimeSecret;environment:Environment;operationId:string;value:string;
}):Promise<{stageVersion:number;sourceUpdatedAt:string}>{
 try{
  if(typeof window!=='undefined'||![input.stageId,input.projectId,input.ownerId,input.operationId].every(v=>uuid.test(v))
   ||!Number.isSafeInteger(input.expectedStageVersion)||input.expectedStageVersion<0||!exactSecret(input.secret)
   ||!input.value||new TextEncoder().encode(input.value).length>16384||/[\r\n]/.test(input.value))throw new Error();
  const{data,error}=await input.client.rpc('website_stage_owned_runtime_secret',{p_id:input.stageId,p_project_id:input.projectId,
   p_owner_id:input.ownerId,p_expected_stage_version:input.expectedStageVersion,
   p_source_connection_id:input.secret.sourceConnectionId,p_source_field:input.secret.sourceField,
   p_environment:input.environment,p_environment_key:input.secret.environmentKey,p_operation_id:input.operationId,p_value:input.value});
  if(error)throw new Error();const row=object(data);
  if(Object.keys(row).sort().join(',')!=='sourceUpdatedAt,stageVersion'||!Number.isSafeInteger(row.stageVersion)
   ||(row.stageVersion as number)!==input.expectedStageVersion+1||typeof row.sourceUpdatedAt!=='string'
   ||!Number.isFinite(Date.parse(row.sourceUpdatedAt)))throw new Error();
  return{stageVersion:row.stageVersion as number,sourceUpdatedAt:row.sourceUpdatedAt};
 }catch{throw new Error('Runtime secret staging unavailable.');}
}

/** Reads stage and Vercel receipt metadata without exposing either credential. */
export async function inspectOwnedRuntimeSecretState(input:{client:Client;projectId:string;ownerId:string;
 vercelConnectionId:string;vercelConnectionVersion:number;secret:OwnedGeneratedRuntimeSecret;environment:Environment;
}):Promise<OwnedRuntimeSecretState>{
 try{
  if(typeof window!=='undefined'||![input.projectId,input.ownerId,input.vercelConnectionId].every(v=>uuid.test(v))
   ||!Number.isSafeInteger(input.vercelConnectionVersion)||input.vercelConnectionVersion<1||!exactSecret(input.secret))throw new Error();
  const{data,error}=await input.client.rpc('website_owned_runtime_secret_state_for_worker',{p_project_id:input.projectId,
   p_owner_id:input.ownerId,p_vercel_connection_id:input.vercelConnectionId,
   p_vercel_connection_version:input.vercelConnectionVersion,p_source_connection_id:input.secret.sourceConnectionId,
   p_source_field:input.secret.sourceField,p_environment_key:input.secret.environmentKey,p_environment:input.environment});
  if(error)throw new Error();const row=object(data),keys=['environmentId','handoffId','handoffOperationId','handoffStatus',
   'handoffVersion','ready','sourceAvailable','sourceUpdatedAt','stageId','stageOperationId','stageVersion'];
  if(Object.keys(row).sort().join(',')!==keys.sort().join(','))throw new Error();
  const stageId=row.stageId,handoffId=row.handoffId,status=row.handoffStatus,environmentId=row.environmentId;
  if(!Number.isSafeInteger(row.stageVersion)||(row.stageVersion as number)<0||!Number.isSafeInteger(row.handoffVersion)
   ||(row.handoffVersion as number)<0||typeof row.sourceAvailable!=='boolean'||typeof row.ready!=='boolean'
   ||(stageId===null)!==(row.stageVersion===0)||(stageId===null&&(row.stageOperationId!==null||row.sourceUpdatedAt!==null))
   ||(stageId!==null&&(typeof stageId!=='string'||!uuid.test(stageId)||typeof row.stageOperationId!=='string'
    ||!uuid.test(row.stageOperationId)||typeof row.sourceUpdatedAt!=='string'||!Number.isFinite(Date.parse(row.sourceUpdatedAt))))
   ||(handoffId===null)!==(row.handoffVersion===0)
   ||(handoffId===null&&(status!==null||row.handoffOperationId!==null||environmentId!==null))
   ||(handoffId!==null&&(typeof handoffId!=='string'||!uuid.test(handoffId)||!['preparing','verified','removed'].includes(String(status))
    ||typeof row.handoffOperationId!=='string'||!uuid.test(row.handoffOperationId)))
   ||(environmentId!==null&&(typeof environmentId!=='string'||!identity.test(environmentId)))
   ||(row.ready===true&&(stageId===null||status!=='verified'||environmentId===null||row.sourceAvailable!==false)))throw new Error();
  return structuredClone(row) as unknown as OwnedRuntimeSecretState;
 }catch{throw new Error('Runtime secret state unavailable.');}
}
