import type { SupabaseClient } from '@supabase/supabase-js';
import type { OwnedVercelPromotionReport } from '../../../../server/website-owned-vercel-promotion';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const provider=/^[A-Za-z0-9_-]{3,128}$/,project=/^prj_[A-Za-z0-9]{8,128}$/;
const deployment=/^dpl_[A-Za-z0-9]{8,128}$/,sha=/^[0-9a-f]{40}$/;
const branch=/^[A-Za-z0-9_./-]{1,200}$/;
const environmentName=/^[A-Z][A-Z0-9_]{1,99}$/;
const hostname=/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?[.])+(?:[a-z]{2,63}|vercel[.]app)$/;
type Client=Pick<SupabaseClient,'rpc'>;

function aliases(values:string[]){const sorted=[...values].sort();if(!sorted.length||sorted.length>100||new Set(sorted).size!==sorted.length||sorted.some(v=>!hostname.test(v)))throw new Error();return sorted;}

export async function beginWebsiteVercelPromotion(input:{client:Client;previewConnectionId:string;productionConnectionId:string;
  projectId:string;ownerId:string;previewConnectionVersion:number;productionConnectionVersion:number;previewAttemptVersion:number;
  expectedPromotionVersion:number;vercelProjectId:string;deploymentId:string;sourceCommitSha:string;expectedAliases:string[];
  runtimeEnvironmentReceiptVersion:number;runtimeEnvironmentIds:Record<string,string>;operationId:string;isCurrent():boolean;}):Promise<number>{
  let expected:string[];try{expected=aliases(input.expectedAliases);}catch{throw new Error('Vercel promotion unavailable.');}
  const environmentIds=Object.fromEntries(Object.entries(input.runtimeEnvironmentIds).sort(([a],[b])=>a.localeCompare(b)));
  if(typeof window!=='undefined'||![input.previewConnectionId,input.productionConnectionId,input.projectId,input.ownerId,input.operationId].every(value=>uuid.test(value))
    ||input.previewConnectionId===input.productionConnectionId||![input.previewConnectionVersion,input.productionConnectionVersion,input.previewAttemptVersion].every(v=>Number.isSafeInteger(v)&&v>0)
    ||!Number.isSafeInteger(input.expectedPromotionVersion)||input.expectedPromotionVersion<0||!project.test(input.vercelProjectId)
    ||!deployment.test(input.deploymentId)||!sha.test(input.sourceCommitSha)
    ||!Number.isSafeInteger(input.runtimeEnvironmentReceiptVersion)||input.runtimeEnvironmentReceiptVersion<1
    ||Object.keys(environmentIds).length!==2||Object.keys(environmentIds).some(key=>!environmentName.test(key))
    ||Object.keys(environmentIds).join(',')!=='SUPABASE_ANON_KEY,SUPABASE_URL'
    ||Object.values(environmentIds).some(value=>!provider.test(value))||new Set(Object.values(environmentIds)).size!==2
    ||!input.isCurrent())throw new Error('Vercel promotion unavailable.');
  const{data,error}=await input.client.rpc('website_begin_vercel_promotion',{p_preview_connection_id:input.previewConnectionId,
    p_production_connection_id:input.productionConnectionId,p_project_id:input.projectId,p_owner_id:input.ownerId,
    p_preview_connection_version:input.previewConnectionVersion,p_production_connection_version:input.productionConnectionVersion,
    p_preview_attempt_version:input.previewAttemptVersion,p_expected_promotion_version:input.expectedPromotionVersion,
    p_runtime_environment_receipt_version:input.runtimeEnvironmentReceiptVersion,p_runtime_environment_ids:environmentIds,
    p_vercel_project_id:input.vercelProjectId,p_deployment_id:input.deploymentId,p_source_commit_sha:input.sourceCommitSha,
    p_expected_aliases:expected,p_operation_id:input.operationId});
  if(error||!Number.isSafeInteger(data)||data<1||!input.isCurrent())throw new Error('Vercel promotion unavailable.');return data;
}

export async function claimWebsiteVercelPromotion(input:{client:Client;productionConnectionId:string;projectId:string;ownerId:string;
  expectedPromotionVersion:number;operationId:string;isCurrent():boolean;}):Promise<{promotionVersion:number;issuePromotion:boolean;accessToken:string;accountId:string;productionBranch:string}>{
  if(typeof window!=='undefined'||![input.productionConnectionId,input.projectId,input.ownerId,input.operationId].every(value=>uuid.test(value))
    ||!Number.isSafeInteger(input.expectedPromotionVersion)||input.expectedPromotionVersion<1||!input.isCurrent())throw new Error('Vercel promotion unavailable.');
  const{data,error}=await input.client.rpc('website_claim_vercel_promotion',{p_production_connection_id:input.productionConnectionId,
    p_project_id:input.projectId,p_owner_id:input.ownerId,p_expected_promotion_version:input.expectedPromotionVersion,p_operation_id:input.operationId});
  if(error||!data||typeof data!=='object'||!Number.isSafeInteger(data.promotionVersion)||data.promotionVersion<1
    ||typeof data.issuePromotion!=='boolean'||typeof data.accessToken!=='string'||!data.accessToken||data.accessToken.length>4096||/[\r\n]/.test(data.accessToken)
    ||typeof data.accountId!=='string'||!provider.test(data.accountId)||typeof data.productionBranch!=='string'||!branch.test(data.productionBranch)
    ||data.productionBranch.includes('..')||!input.isCurrent())
    throw new Error('Vercel promotion unavailable.');return data;
}

export async function commitWebsiteVercelPromotion(input:{client:Client;productionConnectionId:string;projectId:string;ownerId:string;
  expectedPromotionVersion:number;operationId:string;commitId:string;report:OwnedVercelPromotionReport;isCurrent():boolean;
}):Promise<{promotionVersion:number;connectionVersion:number}>{
  let observed:string[];try{observed=aliases(input.report.aliases);}catch{throw new Error('Vercel promotion unavailable.');}
  if(typeof window!=='undefined'||![input.productionConnectionId,input.projectId,input.ownerId,input.operationId,input.commitId].every(value=>uuid.test(value))
    ||!Number.isSafeInteger(input.expectedPromotionVersion)||input.expectedPromotionVersion<1||input.report.status!=='ready'
    ||!deployment.test(input.report.deploymentId)||!sha.test(input.report.sourceCommitSha)||input.report.liveUrl!==`https://${observed[0]}`||!input.isCurrent())
    throw new Error('Vercel promotion unavailable.');
  const args={p_production_connection_id:input.productionConnectionId,p_project_id:input.projectId,p_owner_id:input.ownerId,
    p_expected_promotion_version:input.expectedPromotionVersion,p_operation_id:input.operationId,p_deployment_id:input.report.deploymentId,
    p_source_commit_sha:input.report.sourceCommitSha,p_observed_aliases:observed,p_live_url:input.report.liveUrl,p_commit_id:input.commitId};
  const reconcile=()=>input.client.rpc('website_reconcile_vercel_promotion',args);
  try{const{data,error}=await input.client.rpc('website_commit_vercel_promotion',args);if(!error&&data?.promotionVersion===input.expectedPromotionVersion+1
      &&Number.isSafeInteger(data.connectionVersion)&&input.isCurrent())return data;
    const recovered=await reconcile();if(!recovered.error&&recovered.data?.promotionVersion===input.expectedPromotionVersion+1
      &&Number.isSafeInteger(recovered.data.connectionVersion)&&input.isCurrent())return recovered.data;
  }catch{try{const recovered=await reconcile();if(!recovered.error&&recovered.data?.promotionVersion===input.expectedPromotionVersion+1
      &&Number.isSafeInteger(recovered.data.connectionVersion)&&input.isCurrent())return recovered.data;}catch{/* safe error */}}
  throw new Error('Vercel promotion unavailable.');
}
