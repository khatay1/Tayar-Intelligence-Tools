import type{SupabaseClient}from'@supabase/supabase-js';
import{assertInfrastructureConnection,type InfrastructureConnection}from'../src/modules/website-builder/core/application-infrastructure-connections';
import{validateOwnedApplicationPublicBackend}from'../src/modules/website-builder/core/application-data-runtime';
import type{OwnedRuntimeBinding,OwnedSourceReader}from'./website-owned-source-capture';

type Client=Pick<SupabaseClient,'rpc'>;const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object=(value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
async function rpc(client:Client,name:string,args:Record<string,unknown>){const{data,error}=await client.rpc(name,args);if(error)return null;return data;}

/** Concrete service-only reader for saved source and BYO runtime metadata. It
 * never reads the legacy Tayar-managed application backend activation path. */
export function createWebsiteOwnedSourceReader(client:Client):OwnedSourceReader{
 return{
  async readSavedProject(projectId,ownerId){
   if(!uuid.test(projectId)||!uuid.test(ownerId))return null;
   const row=object(await rpc(client,'website_byo_saved_project',{p_project_id:projectId,p_owner_id:ownerId}));
   const snapshot=object(row?.snapshot);if(!row||row.projectId!==projectId||row.ownerId!==ownerId||!snapshot)return null;
   return{projectId,ownerId,snapshot:structuredClone(snapshot)};
  },
  async readConnection(connectionId,projectId,ownerId){
   if(![connectionId,projectId,ownerId].every(value=>uuid.test(value)))return null;
   const row=object(await rpc(client,'website_byo_connection_for_worker',{p_connection_id:connectionId,
    p_project_id:projectId,p_owner_id:ownerId}));if(!row)return null;
   try{const value=structuredClone(row)as unknown as InfrastructureConnection;assertInfrastructureConnection(value);
    if(value.id!==connectionId||value.projectId!==projectId||value.ownerId!==ownerId)return null;return value;}catch{return null;}
  },
  async readOwnedRuntimeBinding(projectId,ownerId,environment){
   if(!uuid.test(projectId)||!uuid.test(ownerId)||!['preview','production'].includes(environment))return null;
   const row=object(await rpc(client,'website_byo_runtime_binding_for_worker',{p_project_id:projectId,
    p_owner_id:ownerId,p_environment:environment})),backend=object(row?.backend);
   if(!row||!backend||row.projectId!==projectId||row.ownerId!==ownerId||row.environment!==environment
    ||typeof row.supabaseConnectionId!=='string'||!uuid.test(row.supabaseConnectionId)
    ||typeof row.vercelConnectionId!=='string'||!uuid.test(row.vercelConnectionId)
    ||row.supabaseConnectionId===row.vercelConnectionId||typeof row.applicationOrigin!=='string'
    ||typeof backend.url!=='string'||typeof backend.projectRef!=='string'||typeof backend.publishableKey!=='string')return null;
   try{const origin=new URL(row.applicationOrigin);if(origin.protocol!=='https:'||origin.origin!==row.applicationOrigin
     ||origin.username||origin.password||origin.port||origin.hostname.endsWith('.supabase.co'))return null;
    const publicBackend={url:backend.url,publishableKey:backend.publishableKey,projectRef:backend.projectRef};
    validateOwnedApplicationPublicBackend(publicBackend,publicBackend.projectRef);
    return structuredClone({projectId,ownerId,environment,supabaseConnectionId:row.supabaseConnectionId,
     vercelConnectionId:row.vercelConnectionId,applicationOrigin:row.applicationOrigin,backend:publicBackend}as OwnedRuntimeBinding);
   }catch{return null;}
  },
 };
}
