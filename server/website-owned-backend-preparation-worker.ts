import type{SupabaseClient}from'@supabase/supabase-js';
import type{SourceReader}from'../src/modules/website-builder/services/websiteGithubExportSourceService';
import{migrateWebsiteOwnedSupabaseFromCustody}from'./website-owned-supabase-migration-worker';
import{setupWebsiteOwnedRuntimeBindingFromCustody}from'./website-owned-runtime-setup-adapters';

type Client=Pick<SupabaseClient,'rpc'>;type Environment='preview'|'production';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const provider=/^[A-Za-z0-9_-]{1,200}$/;
const object=(value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;

interface PreparationState{bindingVersion:number;expectedBindingVersion:number;operationCommitted:boolean;}
function parseState(value:unknown):PreparationState{
 const row=object(value);if(!row||Object.keys(row).some(key=>!['bindingVersion','expectedBindingVersion','operationCommitted'].includes(key))
  ||!Number.isSafeInteger(row.bindingVersion)||(row.bindingVersion as number)<0
  ||!Number.isSafeInteger(row.expectedBindingVersion)||(row.expectedBindingVersion as number)<0
  ||typeof row.operationCommitted!=='boolean')throw new Error();
 const bindingVersion=row.bindingVersion as number,expectedBindingVersion=row.expectedBindingVersion as number;
 if(row.operationCommitted?bindingVersion!==expectedBindingVersion+1:bindingVersion!==expectedBindingVersion)throw new Error();
 return{bindingVersion,expectedBindingVersion,operationCommitted:row.operationCommitted};
}

type Input={client:Client;reader:SourceReader;projectId:string;ownerId:string;environment:Environment;operationId:string;
 platformOrigin:string;platformSupabaseOrganizationId:string;platformVercelAccountId:string;fetcher?:typeof fetch;};
type MigrationRunner=typeof migrateWebsiteOwnedSupabaseFromCustody;
type BindingRunner=typeof setupWebsiteOwnedRuntimeBindingFromCustody;

/** Unmounted server-only composition. Browser-callable scope contains no
 * provider target or CAS version: migration and binding identities are loaded
 * by service-role projections, with migration completion ordered first. */
export function createWebsiteOwnedBackendPreparationWorker(dependencies:{migrate:MigrationRunner;setup:BindingRunner}){
 return async function prepareWebsiteOwnedBackend(input:Input){
  if(typeof window!=='undefined'||![input.projectId,input.ownerId,input.operationId].every(value=>uuid.test(value))
   ||!['preview','production'].includes(input.environment)||!provider.test(input.platformSupabaseOrganizationId)
   ||!provider.test(input.platformVercelAccountId))throw new Error('Customer backend preparation unavailable.');
  try{
   const migration=await dependencies.migrate({client:input.client,projectId:input.projectId,ownerId:input.ownerId,
    environment:input.environment,operationId:input.operationId,
    platformSupabaseOrganizationId:input.platformSupabaseOrganizationId,fetcher:input.fetcher});
   if(!['current','ready'].includes(migration.status))throw new Error();
   const{data,error}=await input.client.rpc('website_byo_backend_preparation_state',{p_project_id:input.projectId,
    p_owner_id:input.ownerId,p_environment:input.environment,p_operation_id:input.operationId});
   if(error||data===null)throw new Error();const state=parseState(data);
   const binding=await dependencies.setup({client:input.client,reader:input.reader,projectId:input.projectId,
    ownerId:input.ownerId,environment:input.environment,operationId:input.operationId,
    expectedBindingVersion:state.expectedBindingVersion,platformOrigin:input.platformOrigin,
    platformSupabaseOrganizationId:input.platformSupabaseOrganizationId,
    platformVercelAccountId:input.platformVercelAccountId,fetcher:input.fetcher});
   if(binding.version!==state.expectedBindingVersion+1)throw new Error();
   return{status:'ready' as const,migrationStatus:migration.status,bindingVersion:binding.version,
    reconciled:state.operationCommitted};
  }catch{throw new Error('Customer backend preparation unavailable.');}
 };
}

export const prepareWebsiteOwnedBackend=createWebsiteOwnedBackendPreparationWorker({
 migrate:migrateWebsiteOwnedSupabaseFromCustody,setup:setupWebsiteOwnedRuntimeBindingFromCustody});
