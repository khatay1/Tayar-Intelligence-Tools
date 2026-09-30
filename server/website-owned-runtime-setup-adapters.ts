import type{SupabaseClient}from'@supabase/supabase-js';
import{validateOwnedApplicationPublicBackend,type ApplicationPublicBackend}from'../src/modules/website-builder/core/application-data-runtime';
import{createOwnedSupabaseReadOnlyQuery}from'./website-owned-supabase-catalog';
import{createOwnedSupabaseLiveSecurityVerifier,verifyOwnedSupabaseProject}from'./website-owned-supabase-project';
import{verifyOwnedSupabaseApplicationRuntime,type OwnedSupabaseRuntimeReader}from'./website-owned-supabase-verifier';
import{setupWebsiteOwnedRuntimeBinding,type OwnedRuntimeSetupTargets}from'./website-owned-runtime-binding';
import{readOwnedVercelProductionDomains}from'./website-owned-vercel-promotion';
import{verifyOwnedVercelProject}from'./website-owned-vercel-project';
import type{SourceReader}from'../src/modules/website-builder/services/websiteGithubExportSourceService';

type Client=Pick<SupabaseClient,'rpc'>;type Environment='preview'|'production';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const provider=/^[A-Za-z0-9_-]{1,200}$/,slug=/^[a-z0-9][a-z0-9-]{0,199}$/;
const ref=/^[a-z]{20}$/,project=/^prj_[A-Za-z0-9]{8,128}$/;
const gitName=/^[A-Za-z0-9_.-]{1,100}$/,branch=/^[A-Za-z0-9_./-]{1,200}$/;
const object=(value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
const exact=(row:Record<string,unknown>,keys:string[])=>Object.keys(row).every(key=>keys.includes(key));
const currentDate=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)>Date.now();

interface SupabaseCustody{accountId:string;organizationId:string;organizationSlug:string;projectRef:string;
 environment:Environment;accessToken:string;}
interface VercelCustody{userId:string;accountId:string;vercelProjectId:string;repositoryId:string;
 repositoryOwner:string;repositoryName:string;productionBranch:string;environment:Environment;accessToken:string;}

function parseSupabaseCustody(value:unknown,environment:Environment,target:OwnedRuntimeSetupTargets['supabase']):SupabaseCustody{
 const row=object(value),grant=object(row?.grant);if(!row||!grant||!exact(row,['version','accountId','organizationId','organizationSlug',
  'projectRef','environment','accessExpiresAt','custodyExpiresAt','grant'])||!exact(grant,['accessToken','refreshToken'])
  ||!Number.isSafeInteger(row.version)||(row.version as number)<1||typeof row.accountId!=='string'||!provider.test(row.accountId)
  ||typeof row.organizationId!=='string'||!provider.test(row.organizationId)||typeof row.organizationSlug!=='string'||!slug.test(row.organizationSlug)
  ||row.projectRef!==target.projectRef||!ref.test(String(row.projectRef))||row.environment!==environment
  ||!currentDate(row.accessExpiresAt)||!currentDate(row.custodyExpiresAt)||typeof grant.accessToken!=='string'
  ||grant.accessToken.length<20||grant.accessToken.length>4096||/[\r\n]/.test(grant.accessToken)
  ||typeof grant.refreshToken!=='string'||grant.refreshToken.length<20||grant.refreshToken.length>4096)throw new Error();
 return{accountId:row.accountId,organizationId:row.organizationId,organizationSlug:row.organizationSlug,
  projectRef:row.projectRef as string,environment,accessToken:grant.accessToken};
}

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

async function publicBackend(input:{custody:SupabaseCustody;fetcher:typeof fetch}):Promise<ApplicationPublicBackend>{
 const response=await input.fetcher(`https://api.supabase.com/v1/projects/${input.custody.projectRef}/api-keys?reveal=true`,{
  method:'GET',headers:{Authorization:`Bearer ${input.custody.accessToken}`,Accept:'application/json'},redirect:'error',cache:'no-store',
  signal:AbortSignal.timeout(8000)});
 if(response.status!==200||Number(response.headers.get('content-length')??0)>131_072)throw new Error();
 const text=await response.text();if(text.length>131_072)throw new Error();const value:unknown=JSON.parse(text);
 if(!Array.isArray(value)||value.length>32)throw new Error();
 const keys=value.map(item=>{const row=object(item);if(!row||typeof row.type!=='string'||typeof row.api_key!=='string'
  ||(row.name!=null&&typeof row.name!=='string'))throw new Error();return row;});
 const publishable=keys.filter(key=>key.type==='publishable'&&/^sb_publishable_[A-Za-z0-9_-]+$/.test(String(key.api_key)));
 const legacy=keys.filter(key=>key.type==='legacy'&&key.name==='anon');
 const selected=publishable.length===1?publishable[0]:publishable.length===0&&legacy.length===1?legacy[0]:null;
 if(!selected)throw new Error();const backend={url:`https://${input.custody.projectRef}.supabase.co`,
  projectRef:input.custody.projectRef,publishableKey:String(selected.api_key)};
 validateOwnedApplicationPublicBackend(backend,input.custody.projectRef);return backend;
}

function runtimeReader(custody:SupabaseCustody,isCurrent:()=>Promise<boolean>,fetcher:typeof fetch):OwnedSupabaseRuntimeReader{
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
   if(result.error||!await isCurrent())throw new Error();const custody=parseSupabaseCustody(result.data,input.environment,targets.supabase);
   const ownership={...custody,accountUserId:custody.accountId,platformOrganizationId:input.platformSupabaseOrganizationId,fetcher};
   if(!await verifyOwnedSupabaseProject(ownership)||!await isCurrent())throw new Error();
   const backend=await publicBackend({custody,fetcher});if(!await isCurrent())throw new Error();
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
