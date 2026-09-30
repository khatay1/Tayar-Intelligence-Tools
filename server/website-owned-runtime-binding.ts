import type{SupabaseClient}from'@supabase/supabase-js';
import{validateOwnedApplicationPublicBackend,type ApplicationPublicBackend}from'../src/modules/website-builder/core/application-data-runtime';
import type{ApplicationDefinition}from'../src/modules/website-builder/core/application-model';
import{readApplicationDefinition}from'../src/modules/website-builder/core/application-validation';
import{websiteProjectReleaseDigest}from'../src/modules/website-builder/core/website-project-release-digest';
import type{SourceReader}from'../src/modules/website-builder/services/websiteGithubExportSourceService';

type Client=Pick<SupabaseClient,'rpc'>;type Environment='preview'|'production';
type Target={connectionId:string;version:number};
export interface OwnedRuntimeSetupTargets{supabase:Target&{projectRef:string};vercel:Target&{projectId:string};}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ref=/^[a-z]{20}$/;const vercel=/^prj_[A-Za-z0-9]{8,128}$/;
const object=(value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
function target(value:unknown,kind:'supabase'|'vercel'){
 const row=object(value),identity=kind==='supabase'?row?.projectRef:row?.projectId;
 if(!row||Object.keys(row).some(key=>!['connectionId','version',kind==='supabase'?'projectRef':'projectId'].includes(key))
  ||typeof row.connectionId!=='string'||!uuid.test(row.connectionId)||!Number.isSafeInteger(row.version)||(row.version as number)<1
  ||typeof identity!=='string'||!(kind==='supabase'?ref:vercel).test(identity))throw new Error();
 return{connectionId:row.connectionId,version:row.version as number,[kind==='supabase'?'projectRef':'projectId']:identity};
}
function parse(value:unknown):OwnedRuntimeSetupTargets{
 const row=object(value);if(!row||Object.keys(row).some(key=>!['supabase','vercel'].includes(key)))throw new Error();
 const supabase=target(row.supabase,'supabase')as OwnedRuntimeSetupTargets['supabase'];
 const vercelTarget=target(row.vercel,'vercel')as OwnedRuntimeSetupTargets['vercel'];
 if(supabase.connectionId===vercelTarget.connectionId)throw new Error();return{supabase,vercel:vercelTarget};
}
const identity=(value:OwnedRuntimeSetupTargets)=>JSON.stringify(value);

/** Server-only setup worker. Target IDs come from a service-role projection;
 * supplied callbacks are live provider verifiers, not browser observations. */
export async function setupWebsiteOwnedRuntimeBinding(input:{client:Client;reader:SourceReader;
 projectId:string;ownerId:string;environment:Environment;operationId:string;expectedBindingVersion:number;
 platformOrigin:string;
 verifySupabase(context:{definition:ApplicationDefinition;targets:OwnedRuntimeSetupTargets;isCurrent():Promise<boolean>}):Promise<{verified:true;backend:ApplicationPublicBackend}>;
 verifyVercel(context:{targets:OwnedRuntimeSetupTargets;isCurrent():Promise<boolean>}):Promise<{verified:true;projectId:string;applicationOrigin:string}>;
}){
 if(typeof window!=='undefined'||![input.projectId,input.ownerId,input.operationId].every(value=>uuid.test(value))
  ||!['preview','production'].includes(input.environment)||!Number.isSafeInteger(input.expectedBindingVersion)
  ||input.expectedBindingVersion<0)throw new Error('BYO runtime setup unavailable.');
 const readTargets=async()=>{const{data,error}=await input.client.rpc('website_byo_runtime_setup_targets',{
  p_project_id:input.projectId,p_owner_id:input.ownerId,p_environment:input.environment});if(error||data===null)throw new Error();return parse(data);};
 try{
  const targets=await readTargets(),captured=identity(targets),saved=await input.reader.readSavedProject(input.projectId,input.ownerId);
  if(!saved||saved.projectId!==input.projectId||saved.ownerId!==input.ownerId||!object(saved.snapshot.application))throw new Error();
  const snapshotDigest=await websiteProjectReleaseDigest(saved.snapshot),application=structuredClone(saved.snapshot.application as Record<string,unknown>);
  const definition=readApplicationDefinition(application);
  const isCurrent=async()=>{try{const latest=await input.reader.readSavedProject(input.projectId,input.ownerId);
   return identity(await readTargets())===captured&&!!latest&&latest.projectId===input.projectId&&latest.ownerId===input.ownerId
    &&await websiteProjectReleaseDigest(latest.snapshot)===snapshotDigest;}catch{return false;}};
  if(!await isCurrent())throw new Error();
  const supabase=await input.verifySupabase({definition:structuredClone(definition),targets:structuredClone(targets),isCurrent});
  if(!supabase||supabase.verified!==true||!await isCurrent())throw new Error();
  const backendRow=object(supabase.backend);
  if(!backendRow||Object.keys(backendRow).some(key=>!['url','projectRef','publishableKey'].includes(key))
   ||typeof backendRow.url!=='string'||typeof backendRow.projectRef!=='string'||typeof backendRow.publishableKey!=='string')throw new Error();
  const backend={url:backendRow.url,projectRef:backendRow.projectRef,publishableKey:backendRow.publishableKey};
  validateOwnedApplicationPublicBackend(backend,targets.supabase.projectRef);
  const observed=await input.verifyVercel({targets:structuredClone(targets),isCurrent});
  if(!observed||observed.verified!==true||observed.projectId!==targets.vercel.projectId||!await isCurrent())throw new Error();
  const origin=new URL(observed.applicationOrigin),platform=new URL(input.platformOrigin);
  if(platform.protocol!=='https:'||platform.origin!==input.platformOrigin||origin.protocol!=='https:'
   ||origin.origin!==observed.applicationOrigin||origin.username||origin.password||origin.port
   ||origin.origin===platform.origin||origin.hostname.endsWith('.supabase.co'))throw new Error();
  const args={p_project_id:input.projectId,p_owner_id:input.ownerId,p_environment:input.environment,
   p_expected_version:input.expectedBindingVersion,p_supabase_connection_id:targets.supabase.connectionId,
   p_supabase_connection_version:targets.supabase.version,p_vercel_connection_id:targets.vercel.connectionId,
   p_vercel_connection_version:targets.vercel.version,p_application_origin:origin.origin,
   p_publishable_key:backend.publishableKey,p_application_definition:application,p_commit_id:input.operationId};
  const reconcile=async()=>{const result=await input.client.rpc('website_reconcile_byo_runtime_binding',args);
   if(result.error||result.data!==input.expectedBindingVersion+1||!await isCurrent())throw new Error();return result.data as number;};
  const existing=await reconcile().catch(()=>null);if(existing)return{version:existing,targets:structuredClone(targets),backend:structuredClone(backend),applicationOrigin:origin.origin};
  const result=await input.client.rpc('website_record_byo_runtime_binding',args);
  const version=!result.error&&result.data===input.expectedBindingVersion+1&&await isCurrent()?result.data:await reconcile();
  return{version,targets:structuredClone(targets),backend:structuredClone(backend),applicationOrigin:origin.origin};
 }catch{throw new Error('BYO runtime setup unavailable.');}
}
