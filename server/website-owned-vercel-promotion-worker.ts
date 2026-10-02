import type {SupabaseClient} from '@supabase/supabase-js';
import {promoteAndVerifyOwnedVercelDeployment,readOwnedVercelProductionDomains,
  type OwnedVercelPromotionReport} from './website-owned-vercel-promotion';
import {beginWebsiteVercelPromotion,claimWebsiteVercelPromotion,commitWebsiteVercelPromotion}
  from '../src/modules/website-builder/services/websiteVercelPromotionService';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const provider=/^[A-Za-z0-9_-]{3,128}$/,project=/^prj_[A-Za-z0-9]{8,128}$/;
const deployment=/^dpl_[A-Za-z0-9]{8,128}$/,sha=/^[0-9a-f]{40}$/;
const branch=/^[A-Za-z0-9_./-]{1,200}$/;type Client=Pick<SupabaseClient,'rpc'>;
const hostname=/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?[.])+(?:[a-z]{2,63}|vercel[.]app)$/;

async function commitId(operationId:string,version:number,report:OwnedVercelPromotionReport){
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({operationId,version,report}))));
  bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const hex=[...bytes.slice(0,16)].map(v=>v.toString(16).padStart(2,'0')).join('');
  return`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

/** Trusted, source-only production stage. The caller must obtain the production
 * custody lease through the existing service-role boundary; nothing is mounted. */
export async function runWebsiteOwnedVercelPromotion(input:{client:Client;operationId:string;projectId:string;ownerId:string;
  previewConnectionId:string;productionConnectionId:string;previewConnectionVersion:number;productionConnectionVersion:number;
  previewAttemptVersion:number;vercelProjectId:string;deploymentId:string;sourceCommitSha:string;sourceBranch:string;
  runtimeEnvironmentReceiptVersion:number;runtimeEnvironmentIds:Record<string,string>;
  accessToken:string;accountId:string;productionBranch:string;isCurrent():Promise<boolean>;fetcher?:typeof fetch;
}){
  if(typeof window!=='undefined'||![input.operationId,input.projectId,input.ownerId,input.previewConnectionId,input.productionConnectionId].every(v=>uuid.test(v))
    ||input.previewConnectionId===input.productionConnectionId||![input.previewConnectionVersion,input.productionConnectionVersion,input.previewAttemptVersion].every(v=>Number.isSafeInteger(v)&&v>0)
    ||!project.test(input.vercelProjectId)||!deployment.test(input.deploymentId)||!sha.test(input.sourceCommitSha)
    ||!provider.test(input.accountId)||![input.sourceBranch,input.productionBranch].every(v=>branch.test(v)&&!v.includes('..'))
    ||!input.accessToken||input.accessToken.length>4096||/[\r\n]/.test(input.accessToken)||!await input.isCurrent())throw new Error('Vercel promotion unavailable.');
  try{
    const prior=await input.client.rpc('website_vercel_promotion_for_worker',{p_production_connection_id:input.productionConnectionId,
      p_project_id:input.projectId,p_owner_id:input.ownerId});if(prior.error||!await input.isCurrent())throw new Error();
    const row=prior.data as Record<string,unknown>|null,version=row===null?0:row.version;
    if(!Number.isSafeInteger(version)||(version as number)<0)throw new Error();
    if(row?.status==='ready'&&row.operationId===input.operationId){
      const aliases=Array.isArray(row.observedAliases)?row.observedAliases:[],ids=row.runtimeEnvironmentIds;
      const expectedIds=Object.fromEntries(Object.entries(input.runtimeEnvironmentIds).sort(([a],[b])=>a.localeCompare(b)));
      if(row.deploymentId!==input.deploymentId||row.sourceCommitSha!==input.sourceCommitSha
        ||row.productionConnectionVersion!==input.productionConnectionVersion
        ||row.runtimeEnvironmentReceiptVersion!==input.runtimeEnvironmentReceiptVersion
        ||!ids||typeof ids!=='object'||Array.isArray(ids)
        ||JSON.stringify(Object.fromEntries(Object.entries(ids).sort(([a],[b])=>a.localeCompare(b))))!==JSON.stringify(expectedIds)
        ||!aliases.length||aliases.length>100||aliases.some(value=>typeof value!=='string'||!hostname.test(value))
        ||new Set(aliases).size!==aliases.length||[...aliases].sort().join(',')!==aliases.join(',')
        ||row.liveUrl!==`https://${aliases[0]}`)throw new Error();
      return{status:'ready' as const,deploymentId:input.deploymentId,sourceCommitSha:input.sourceCommitSha,
        aliases:aliases as string[],liveUrl:row.liveUrl as string,promotionVersion:version as number,
        connectionVersion:row.productionConnectionVersion as number};
    }
    const expectedAliases=await readOwnedVercelProductionDomains({accessToken:input.accessToken,accountId:input.accountId,
      projectId:input.vercelProjectId,productionBranch:input.productionBranch,isCurrent:input.isCurrent,fetcher:input.fetcher});
    const prepared=await beginWebsiteVercelPromotion({client:input.client,previewConnectionId:input.previewConnectionId,
      productionConnectionId:input.productionConnectionId,projectId:input.projectId,ownerId:input.ownerId,
      previewConnectionVersion:input.previewConnectionVersion,productionConnectionVersion:input.productionConnectionVersion,
      previewAttemptVersion:input.previewAttemptVersion,expectedPromotionVersion:version as number,vercelProjectId:input.vercelProjectId,
      deploymentId:input.deploymentId,sourceCommitSha:input.sourceCommitSha,expectedAliases,
      runtimeEnvironmentReceiptVersion:input.runtimeEnvironmentReceiptVersion,runtimeEnvironmentIds:input.runtimeEnvironmentIds,
      operationId:input.operationId,isCurrent:()=>true});
    const claimed=await claimWebsiteVercelPromotion({client:input.client,productionConnectionId:input.productionConnectionId,
      projectId:input.projectId,ownerId:input.ownerId,expectedPromotionVersion:prepared,operationId:input.operationId,isCurrent:()=>true});
    if(claimed.accountId!==input.accountId||claimed.productionBranch!==input.productionBranch||claimed.accessToken!==input.accessToken
      ||!await input.isCurrent())throw new Error();
    const report=await promoteAndVerifyOwnedVercelDeployment({accessToken:claimed.accessToken,accountId:claimed.accountId,
      projectId:input.vercelProjectId,deploymentId:input.deploymentId,sourceCommitSha:input.sourceCommitSha,
      sourceBranch:input.sourceBranch,expectedAliases,issuePromotion:claimed.issuePromotion,isCurrent:input.isCurrent,fetcher:input.fetcher});
    const committed=await commitWebsiteVercelPromotion({client:input.client,productionConnectionId:input.productionConnectionId,
      projectId:input.projectId,ownerId:input.ownerId,expectedPromotionVersion:claimed.promotionVersion,operationId:input.operationId,
      commitId:await commitId(input.operationId,claimed.promotionVersion,report),report,isCurrent:()=>true});
    if(!await input.isCurrent())throw new Error();return{...report,promotionVersion:committed.promotionVersion,connectionVersion:committed.connectionVersion};
  }catch{throw new Error('Vercel promotion unavailable.');}
}
