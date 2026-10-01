import type{SupabaseClient}from'@supabase/supabase-js';
import{createOwnedSupabaseReadOnlyQuery}from'./website-owned-supabase-catalog';
import{createOwnedSupabaseLiveSecurityVerifier,verifyOwnedSupabaseProject}from'./website-owned-supabase-project';
import{verifyOwnedSupabaseApplicationRuntime,type OwnedSupabaseRuntimeReader}from'./website-owned-supabase-verifier';
import{parseOwnedSupabaseCustody,readOwnedSupabasePublicBackend,
 type OwnedSupabaseCustody}from'./website-owned-supabase-custody';
import{setupWebsiteOwnedRuntimeBinding,type OwnedRuntimeSetupTargets}from'./website-owned-runtime-binding';
import{readOwnedVercelProductionDomains}from'./website-owned-vercel-promotion';
import{verifyOwnedVercelProject}from'./website-owned-vercel-project';
import type{SourceReader}from'../src/modules/website-builder/services/websiteGithubExportSourceService';

type Client=Pick<SupabaseClient,'rpc'>;type Environment='preview'|'production';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const provider=/^[A-Za-z0-9_-]{1,200}$/,project=/^prj_[A-Za-z0-9]{8,128}$/;
const gitName=/^[A-Za-z0-9_.-]{1,100}$/,branch=/^[A-Za-z0-9_./-]{1,200}$/;
const object=(value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
const exact=(row:Record<string,unknown>,keys:string[])=>Object.keys(row).every(key=>keys.includes(key));
const currentDate=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)>Date.now();

interface VercelCustody{userId:string;accountId:string;vercelProjectId:string;repositoryId:string;
 repositoryOwner:string;repositoryName:string;productionBranch:string;environment:Environment;accessToken:string;}

function parseVercelCustody(value:unknown,environment:Environment,target:OwnedRuntimeSetupTargets['vercel']):VercelCustody{
 const row=object(value);if(!row||!exact(row,['userId','accountId','configurationId','vercelProjectId','repositoryId',
  'repositoryOwner','repositoryName','productionBranch','environment','custodyExpiresAt','accessToken'])
  ||typeof row.userId!=='string'||!provider.test(row.userId)||typeof row.accountId!=='string'||!provider.test(row.accountId)
  ||typeof row.configurationId!=='string'||!/^icfg_[A-Za-z0-9]{8,128}$/.test(row.configurationId)
  ||row.vercelProjectId!==target.projectId||!project.test(String(row.vercelProjectId))
  ||typeof row.repositoryId!=='string'||!/^\d{1,30}$/.test(row.repositoryId)
  ||typeof row.repositoryOwner!=='string'||!gitName.test(row.repositoryOwner)||typeof row.repositoryName!=='string'||!gitName.test(row.repositoryName)
  ||typeof row.productionBranch!=='string'||!branch.test(row.productionBranch)||row.productionBranch.includes('..')
  ||row.environment!==environment||!currentDate(row.custodyExpiresAt)||typeof row.accessToken!=='string'
  ||row.accessToken.length<20||row.accessToken.length>4096||/[\r\n]/.test(row.accessToken))throw new Error();
 return row as unknown as VercelCustody;
}

function runtimeReader(custody:OwnedSupabaseCustody,isCurrent:()=>Promise<boolean>,fetcher:typeof fetch):OwnedSupabaseRuntimeReader{
 const query=createOwnedSupabaseReadOnlyQuery({...custody,fetcher});
 const scalar=async(sql:string,key:string)=>{if(!await isCurrent())throw new Error();const value=await query(sql);
  if(!Array.isArray(value)||value.length!==1)throw new Error();const row=object(value[0]);
  if(!row||!exact(row,[key])||!await isCurrent())throw new Error();return row[key];};
 return{url:`https://${custody.projectRef}.supabase.co`,
  readDeployedDefinition:()=>scalar("select definition from private.app_schema_revisions where id=true",'definition'),
  readFormRequestRevision:()=>scalar("select form_request_version from private.app_runtime_capabilities where id=true",'form_request_version'),
  verifyLiveSecurity:async()=>false};
}

/** Server-only composition. OAuth grants are read from exact leased custody,
 * used request-locally and never returned, logged or written into project data. */
export async function setupWebsiteOwnedRuntimeBindingFromCustody(input:{client:Client;reader:SourceReader;
 projectId:string;ownerId:string;environment:Environment;operationId:string;expectedBindingVersion:number;
 platformOrigin:string;platformSupabaseOrganizationId:string;platformVercelAccountId:string;fetcher?:typeof fetch;
}){
 if(typeof window!=='undefined'||![input.projectId,input.ownerId,input.operationId].every(value=>uuid.test(value))
  ||!provider.test(input.platformSupabaseOrganizationId)||!provider.test(input.platformVercelAccountId))
  throw new Error('BYO runtime setup adapters unavailable.');
 const fetcher=input.fetcher??fetch;
 try{return await setupWebsiteOwnedRuntimeBinding({...input,
  verifySupabase:async({definition,targets,isCurrent})=>{
   const result=await input.client.rpc('website_read_supabase_oauth_custody',{p_connection_id:targets.supabase.connectionId,
    p_project_id:input.projectId,p_owner_id:input.ownerId,p_expected_connection_version:targets.supabase.version});
   if(result.error||!await isCurrent())throw new Error();const custody=parseOwnedSupabaseCustody(result.data,input.environment,targets.supabase);
   const ownership={...custody,accountUserId:custody.accountId,platformOrganizationId:input.platformSupabaseOrganizationId,fetcher};
   if(!await verifyOwnedSupabaseProject(ownership)||!await isCurrent())throw new Error();
   const backend=await readOwnedSupabasePublicBackend({custody,fetcher});if(!await isCurrent())throw new Error();
   const reader=runtimeReader(custody,isCurrent,fetcher);
   reader.verifyLiveSecurity=createOwnedSupabaseLiveSecurityVerifier({...ownership,isCurrent});
   await verifyOwnedSupabaseApplicationRuntime({definition,backend,expectedProjectRef:targets.supabase.projectRef,
    reader,formsRequired:definition.tables.length>0});
   if(!await isCurrent())throw new Error();return{verified:true as const,backend};
  },
  verifyVercel:async({targets,isCurrent})=>{
   const result=await input.client.rpc('website_read_vercel_integration_custody',{p_connection_id:targets.vercel.connectionId,
    p_project_id:input.projectId,p_owner_id:input.ownerId,p_expected_connection_version:targets.vercel.version});
   if(result.error||!await isCurrent())throw new Error();const custody=parseVercelCustody(result.data,input.environment,targets.vercel);
   const proof={...custody,projectId:custody.vercelProjectId,platformAccountId:input.platformVercelAccountId,isCurrent,fetcher};
   if(!await verifyOwnedVercelProject(proof)||!await isCurrent())throw new Error();
   const domains=await readOwnedVercelProductionDomains({accessToken:custody.accessToken,accountId:custody.accountId,
    projectId:custody.vercelProjectId,productionBranch:custody.productionBranch,isCurrent,fetcher});
   if(!await verifyOwnedVercelProject(proof)||!await isCurrent())throw new Error();
   return{verified:true as const,projectId:custody.vercelProjectId,applicationOrigin:`https://${domains[0]}`};
  }});}catch{throw new Error('BYO runtime setup adapters unavailable.');}
}
