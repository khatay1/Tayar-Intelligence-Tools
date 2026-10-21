import type {SupabaseClient} from '@supabase/supabase-js';
import {readProductionSourceCandidate} from './website-production-source-candidate';
import {inspectOwnedVercelProductionCandidate,readOwnedVercelProductionDomains} from './website-owned-vercel-promotion';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const provider=/^[A-Za-z0-9_-]{3,128}$/;
const deployment=/^dpl_[A-Za-z0-9]{8,128}$/;
const repository=/^[0-9]{1,32}$/;
const digest=/^[a-f0-9]{64}$/;
const origin=/^https:\/\/[a-z0-9-]+\.vercel\.app$/;
const environmentKey=/^[A-Z][A-Z0-9_]{0,127}$/;
const branch=/^[A-Za-z0-9_./-]{1,200}$/;
const object=(value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,item:unknown)=>item&&typeof item==='object'&&!Array.isArray(item)
  ?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);

function target(value:unknown,input:{operationId:string;projectId:string;ownerId:string}){
  const row=object(value),scope=object(row?.scope);if(!row||!scope
    ||Object.keys(row).sort().join(',')!=='scope,vercelConnectionId,vercelConnectionVersion'
    ||Object.keys(scope).sort().join(',')!=='accountId,candidate,projectId,repositoryId,runtimeEnvironmentIds,runtimeEnvironmentReceiptVersion,sourceBranch')throw new Error();
  const candidate=readProductionSourceCandidate(scope.candidate),runtimeEnvironmentIds=object(scope.runtimeEnvironmentIds);
  if(candidate.operationId!==input.operationId||candidate.projectId!==input.projectId||candidate.ownerId!==input.ownerId
    ||typeof row.vercelConnectionId!=='string'||!uuid.test(row.vercelConnectionId)
    ||!Number.isSafeInteger(row.vercelConnectionVersion)||Number(row.vercelConnectionVersion)<1
    ||typeof scope.accountId!=='string'||!provider.test(scope.accountId)
    ||typeof scope.projectId!=='string'||!/^prj_[A-Za-z0-9]{8,128}$/.test(scope.projectId)
    ||typeof scope.repositoryId!=='string'||!repository.test(scope.repositoryId)
    ||!Number.isSafeInteger(scope.runtimeEnvironmentReceiptVersion)||Number(scope.runtimeEnvironmentReceiptVersion)<1
    ||!runtimeEnvironmentIds||!Object.keys(runtimeEnvironmentIds).length||Object.keys(runtimeEnvironmentIds).length>64
    ||Object.entries(runtimeEnvironmentIds).some(([key,id])=>!environmentKey.test(key)||typeof id!=='string'||!/^env_[A-Za-z0-9]{3,128}$/.test(id))
    ||new Set(Object.values(runtimeEnvironmentIds)).size!==Object.values(runtimeEnvironmentIds).length
    ||scope.sourceBranch!==`tayar/${input.projectId}/production`)throw new Error();
  return{raw:structuredClone(row),candidate,accountId:scope.accountId,vercelProjectId:scope.projectId,
    sourceBranch:scope.sourceBranch,vercelConnectionId:row.vercelConnectionId,vercelConnectionVersion:Number(row.vercelConnectionVersion)};
}

function attestation(value:unknown,input:{operationId:string}){
  const row=object(value);if(!row||Object.keys(row).sort().join(',')!=='deploymentId,liveUrl,operationId,runtimeDigest,sourceDigest,status'
    ||row.status!=='runtime-verified'||row.operationId!==input.operationId
    ||typeof row.deploymentId!=='string'||!deployment.test(row.deploymentId)
    ||typeof row.liveUrl!=='string'||!origin.test(row.liveUrl)
    ||typeof row.sourceDigest!=='string'||!digest.test(row.sourceDigest)
    ||typeof row.runtimeDigest!=='string'||!digest.test(row.runtimeDigest))throw new Error();
  return row as {operationId:string;deploymentId:string;liveUrl:string;sourceDigest:string;runtimeDigest:string};
}

/** Read-only final precondition. It binds the current private Production source,
 * attestation, provider deployment and verified production domains. It never
 * promotes, assigns an alias, creates a deployment or writes a receipt. */
export async function inspectWebsiteProductionActivationReadiness(input:{
  client:Pick<SupabaseClient,'rpc'>;operationId:string;projectId:string;ownerId:string;
  isCurrent():Promise<boolean>;fetcher?:typeof fetch;
}){
  try{
    if(typeof window!=='undefined'||![input.operationId,input.projectId,input.ownerId].every(value=>uuid.test(value))
      ||!await input.isCurrent())throw new Error();
    const readTarget=async()=>{const result=await input.client.rpc('website_production_staging_target',{
      p_operation_id:input.operationId,p_project_id:input.projectId,p_owner_id:input.ownerId});
      if(result.error||!await input.isCurrent())throw new Error();return target(result.data,input);};
    const selected=await readTarget();
    const proofResult=await input.client.rpc('website_read_production_runtime_attestation',{
      p_operation_id:input.operationId,p_project_id:input.projectId,p_owner_id:input.ownerId});
    if(proofResult.error||!await input.isCurrent())throw new Error();const proof=attestation(proofResult.data,input);
    if(proof.sourceDigest!==selected.candidate.sourceDigest||proof.runtimeDigest!==selected.candidate.runtimeDigest)throw new Error();
    const custodyResult=await input.client.rpc('website_read_vercel_integration_custody',{
      p_connection_id:selected.vercelConnectionId,p_project_id:input.projectId,p_owner_id:input.ownerId,
      p_expected_connection_version:selected.vercelConnectionVersion});
    const custody=object(custodyResult.data);if(custodyResult.error||!custody||typeof custody.accessToken!=='string'||!custody.accessToken
      ||custody.accessToken.length>4096||/[\r\n]/.test(custody.accessToken)||custody.environment!=='production'
      ||custody.accountId!==selected.accountId||custody.vercelProjectId!==selected.vercelProjectId
      ||typeof custody.productionBranch!=='string'||!branch.test(custody.productionBranch)
      ||custody.productionBranch.includes('..')||!await input.isCurrent())throw new Error();
    const current=async()=>await input.isCurrent()&&canonical((await readTarget()).raw)===canonical(selected.raw);
    const deployed=await inspectOwnedVercelProductionCandidate({accessToken:custody.accessToken,accountId:selected.accountId,
      projectId:selected.vercelProjectId,deploymentId:proof.deploymentId,sourceCommitSha:selected.candidate.headSha,
      sourceBranch:selected.sourceBranch,isCurrent:current,fetcher:input.fetcher});
    if(deployed.liveUrl!==proof.liveUrl||!await current())throw new Error();
    const aliases=await readOwnedVercelProductionDomains({accessToken:custody.accessToken,accountId:selected.accountId,
      projectId:selected.vercelProjectId,productionBranch:custody.productionBranch,isCurrent:current,fetcher:input.fetcher});
    if(!await current())throw new Error();
    return{status:'activation-ready' as const,operationId:input.operationId,projectId:input.projectId,
      deploymentId:proof.deploymentId,sourceDigest:proof.sourceDigest,runtimeDigest:proof.runtimeDigest,
      stagingUrl:proof.liveUrl,productionAliases:aliases};
  }catch{throw new Error('Production activation readiness unavailable.');}
}
