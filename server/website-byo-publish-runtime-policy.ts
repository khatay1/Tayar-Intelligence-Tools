import{assertInfrastructureConnection,type InfrastructureConnection}from'../src/modules/website-builder/core/application-infrastructure-connections';
import type{ByoSourceCapabilities}from'../src/modules/website-builder/core/application-byo-source-capabilities';
import type{OwnedRuntimeBinding,OwnedSourceReader}from'./website-owned-source-capture';

const environmentManifest=['SUPABASE_ANON_KEY','SUPABASE_URL']as const;
function bindingIdentity(value:OwnedRuntimeBinding){return JSON.stringify({projectId:value.projectId,ownerId:value.ownerId,
 environment:value.environment,bindingVersion:value.bindingVersion,supabaseConnectionId:value.supabaseConnectionId,
 supabaseConnectionVersion:value.supabaseConnectionVersion,vercelConnectionId:value.vercelConnectionId,
 vercelConnectionVersion:value.vercelConnectionVersion,
 applicationOrigin:value.applicationOrigin,backend:{url:value.backend.url,projectRef:value.backend.projectRef,
 publishableKey:value.backend.publishableKey}});}
function connectionIdentity(value:InfrastructureConnection){assertInfrastructureConnection(value);return JSON.stringify({id:value.id,
 ownerId:value.ownerId,projectId:value.projectId,provider:value.provider,environment:value.environment,accountId:value.accountId,
 targetId:value.targetId,permissions:[...value.permissions].sort(),status:value.status,version:value.version,
 operationId:value.operationId,verifiedAt:value.verifiedAt,updatedAt:value.updatedAt});}
function supported(capabilities:ByoSourceCapabilities){return capabilities.blockers.length===0&&capabilities.needs.auth
 &&capabilities.needs.database&&capabilities.definition.auth.enabled&&!capabilities.needs.integrations&&!capabilities.needs.cms;}

/** Concrete server-only policy for the currently compiled owned runtime. It
 * accepts Auth/data/forms/private pages, refuses every unimplemented runtime
 * capability, and re-reads persisted identities after backend preparation. */
export function createWebsiteByoPublishRuntimePolicy(reader:OwnedSourceReader){
 return{
  async verifyRuntime(binding:OwnedRuntimeBinding,supabase:InfrastructureConnection,vercel:InfrastructureConnection,
   capabilities:ByoSourceCapabilities){
   try{
    if(!supported(capabilities)||!Number.isSafeInteger(binding.bindingVersion)||binding.bindingVersion<1
     ||supabase.provider!=='supabase'||vercel.provider!=='vercel'
     ||binding.backend.projectRef!==supabase.targetId||binding.supabaseConnectionId!==supabase.id
     ||binding.vercelConnectionId!==vercel.id||binding.supabaseConnectionVersion!==supabase.version
     ||binding.vercelConnectionVersion!==vercel.version)return false;
    const latestBinding=await reader.readOwnedRuntimeBinding(binding.projectId,binding.ownerId,binding.environment);
    if(!latestBinding||bindingIdentity(latestBinding)!==bindingIdentity(binding))return false;
    const[latestSupabase,latestVercel]=await Promise.all([
     reader.readConnection(binding.supabaseConnectionId,binding.projectId,binding.ownerId),
     reader.readConnection(binding.vercelConnectionId,binding.projectId,binding.ownerId),
    ]);
    return!!latestSupabase&&!!latestVercel&&connectionIdentity(latestSupabase)===connectionIdentity(supabase)
     &&connectionIdentity(latestVercel)===connectionIdentity(vercel);
   }catch{return false;}
  },
  async requiredEnvironment(capabilities:ByoSourceCapabilities){
   if(!supported(capabilities))throw new Error('BYO publish runtime policy unavailable.');
   return[...environmentManifest];
  },
 };
}
