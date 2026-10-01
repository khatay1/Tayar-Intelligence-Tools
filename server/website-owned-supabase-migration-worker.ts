import type{SupabaseClient}from'@supabase/supabase-js';
import type{ApplicationDefinition}from'../src/modules/website-builder/core/application-model';
import{readApplicationDefinition}from'../src/modules/website-builder/core/application-validation';
import{applicationDefinitionDigest}from'../src/modules/website-builder/core/application-backend-verification';
import{createOwnedSupabaseReadOnlyQuery}from'./website-owned-supabase-catalog';
import{parseOwnedSupabaseCustody,readOwnedSupabasePublicBackend,
 type OwnedSupabaseEnvironment}from'./website-owned-supabase-custody';
import{createOwnedSupabaseLiveSecurityVerifier,verifyOwnedSupabaseProject}from'./website-owned-supabase-project';
import{verifyOwnedSupabaseApplicationRuntime,type OwnedSupabaseRuntimeReader}from'./website-owned-supabase-verifier';
import{migrateOwnedSupabaseApplication,planOwnedSupabaseAdditiveMigration}from'./website-owned-supabase-migration';
import{createOwnedSupabaseMigrationStore}from'./website-owned-supabase-migration-store';

type Client=Pick<SupabaseClient,'rpc'>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ref=/^[a-z]{20}$/,provider=/^[A-Za-z0-9_-]{1,200}$/,slug=/^[a-z0-9][a-z0-9-]{0,199}$/;
const digest=/^[0-9a-f]{64}$/;
const object=(value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
const exact=(row:Record<string,unknown>,keys:string[])=>Object.keys(row).every(key=>keys.includes(key));

interface Attempt{version:number;status:'prepared'|'claimed'|'ready';operationId:string;connectionVersion:number;
 previousDefinition:ApplicationDefinition;nextDefinition:ApplicationDefinition;previousDigest:string;nextDigest:string;
 queryDigest:string;statementCount:number;}
interface Target{connectionId:string;connectionVersion:number;custodyVersion:number;projectRef:string;accountId:string;
 organizationId:string;organizationSlug:string;definition:ApplicationDefinition;attempt:Attempt|null;}

function parseAttempt(value:unknown):Attempt|null{
 if(value===null)return null;const row=object(value);if(!row||!exact(row,['version','status','operationId','connectionVersion',
  'previousDefinition','nextDefinition','previousDigest','nextDigest','queryDigest','statementCount'])
  ||!Number.isSafeInteger(row.version)||(row.version as number)<1||!['prepared','claimed','ready'].includes(String(row.status))
  ||typeof row.operationId!=='string'||!uuid.test(row.operationId)||!Number.isSafeInteger(row.connectionVersion)
  ||(row.connectionVersion as number)<1||![row.previousDigest,row.nextDigest,row.queryDigest].every(value=>typeof value==='string'&&digest.test(value))
  ||row.previousDigest===row.nextDigest||!Number.isSafeInteger(row.statementCount)||(row.statementCount as number)<1
  ||(row.statementCount as number)>512)throw new Error();
 return{version:row.version as number,status:row.status as Attempt['status'],operationId:row.operationId,
  connectionVersion:row.connectionVersion as number,previousDefinition:readApplicationDefinition(row.previousDefinition),
  nextDefinition:readApplicationDefinition(row.nextDefinition),previousDigest:row.previousDigest as string,
  nextDigest:row.nextDigest as string,queryDigest:row.queryDigest as string,statementCount:row.statementCount as number};
}

function parseTarget(value:unknown):Target{
 const row=object(value);if(!row||!exact(row,['connectionId','connectionVersion','custodyVersion','projectRef','accountId',
  'organizationId','organizationSlug','definition','attempt'])||typeof row.connectionId!=='string'||!uuid.test(row.connectionId)
  ||!Number.isSafeInteger(row.connectionVersion)||(row.connectionVersion as number)<1
  ||!Number.isSafeInteger(row.custodyVersion)||(row.custodyVersion as number)<1
  ||typeof row.projectRef!=='string'||!ref.test(row.projectRef)||typeof row.accountId!=='string'||!provider.test(row.accountId)
  ||typeof row.organizationId!=='string'||!provider.test(row.organizationId)
  ||typeof row.organizationSlug!=='string'||!slug.test(row.organizationSlug))throw new Error();
 return{connectionId:row.connectionId,connectionVersion:row.connectionVersion as number,
  custodyVersion:row.custodyVersion as number,projectRef:row.projectRef,accountId:row.accountId,
  organizationId:row.organizationId,organizationSlug:row.organizationSlug,
  definition:readApplicationDefinition(row.definition),attempt:parseAttempt(row.attempt)};
}

/** Trusted composition for one customer-owned additive migration. Public
 * callers provide only Tayar scope; every provider identity and CAS version is
 * selected by service-role projections and rechecked around remote effects. */
export async function migrateWebsiteOwnedSupabaseFromCustody(input:{client:Client;projectId:string;ownerId:string;
 environment:OwnedSupabaseEnvironment;operationId:string;platformSupabaseOrganizationId:string;fetcher?:typeof fetch;
}){
 if(typeof window!=='undefined'||![input.projectId,input.ownerId,input.operationId].every(value=>uuid.test(value))
  ||!['preview','production'].includes(input.environment)||!provider.test(input.platformSupabaseOrganizationId))
  throw new Error('Customer Supabase migration worker unavailable.');
 const fetcher=input.fetcher??fetch;
 const readTarget=async()=>{const{data,error}=await input.client.rpc('website_supabase_migration_target',{
  p_project_id:input.projectId,p_owner_id:input.ownerId,p_environment:input.environment,p_operation_id:input.operationId});
  if(error||data===null)throw new Error();return parseTarget(data);};
 try{
  const target=await readTarget(),definitionDigest=await applicationDefinitionDigest(target.definition);
  const stable=async()=>{try{const latest=await readTarget();if(latest.connectionId!==target.connectionId
    ||latest.projectRef!==target.projectRef||latest.accountId!==target.accountId||latest.organizationId!==target.organizationId
    ||latest.organizationSlug!==target.organizationSlug||latest.custodyVersion!==target.custodyVersion
    ||await applicationDefinitionDigest(latest.definition)!==definitionDigest)return false;
   if(latest.connectionVersion===target.connectionVersion)return true;
   return latest.connectionVersion===target.connectionVersion+1&&latest.attempt?.status==='ready'
    &&latest.attempt.operationId===input.operationId&&latest.attempt.connectionVersion===latest.connectionVersion
    &&latest.attempt.nextDigest===definitionDigest;}catch{return false;}};
  if(!await stable())throw new Error();
  const custodyResult=await input.client.rpc('website_read_supabase_oauth_custody',{p_connection_id:target.connectionId,
   p_project_id:input.projectId,p_owner_id:input.ownerId,p_expected_connection_version:target.connectionVersion});
  if(custodyResult.error||!await stable())throw new Error();
  const custody=parseOwnedSupabaseCustody(custodyResult.data,input.environment,target);
  if(custody.accountId!==target.accountId||custody.organizationId!==target.organizationId
   ||custody.organizationSlug!==target.organizationSlug)throw new Error();
  const ownership={...custody,accountUserId:custody.accountId,platformOrganizationId:input.platformSupabaseOrganizationId,fetcher};
  if(!await verifyOwnedSupabaseProject(ownership)||!await stable())throw new Error();
  const query=createOwnedSupabaseReadOnlyQuery({...custody,fetcher});
  const readDefinition=async()=>{const value=await query('select definition from private.app_schema_revisions where id=true');
   if(!Array.isArray(value)||value.length!==1){throw new Error();}const row=object(value[0]);
   if(!row||!exact(row,['definition']))throw new Error();return readApplicationDefinition(row.definition);};
  const deployed=await readDefinition();if(!await stable())throw new Error();
  const backend=await readOwnedSupabasePublicBackend({custody,fetcher});if(!await stable())throw new Error();
  const reader:OwnedSupabaseRuntimeReader={url:backend.url,readDeployedDefinition:readDefinition,
   readFormRequestRevision:async()=>{const value=await query('select form_request_version from private.app_runtime_capabilities where id=true');
    if(!Array.isArray(value)||value.length!==1){throw new Error();}const row=object(value[0]);if(!row||!exact(row,['form_request_version']))throw new Error();
    return row.form_request_version;},verifyLiveSecurity:createOwnedSupabaseLiveSecurityVerifier({...ownership,isCurrent:stable})};
  const verify=async(definition:ApplicationDefinition)=>{try{if(!await stable())return false;
    await verifyOwnedSupabaseApplicationRuntime({definition,backend,expectedProjectRef:target.projectRef,reader,
     formsRequired:definition.tables.length>0});return await stable();}catch{return false;}};
  if(target.attempt?.status==='ready'&&target.attempt.operationId===input.operationId){
   if(target.attempt.connectionVersion!==target.connectionVersion||target.attempt.nextDigest!==definitionDigest
    ||await applicationDefinitionDigest(target.attempt.nextDefinition)!==target.attempt.nextDigest
    ||!await verify(target.definition)||!await verify(target.definition))throw new Error();
   return{status:'ready' as const,attemptVersion:target.attempt.version,connectionVersion:target.connectionVersion,
    previousDigest:target.attempt.previousDigest,nextDigest:target.attempt.nextDigest,queryDigest:target.attempt.queryDigest};
  }
  let previous=deployed,next=target.definition;
  if(target.attempt&&target.attempt.status!=='ready'){
   if(target.attempt.operationId!==input.operationId||target.attempt.connectionVersion!==target.connectionVersion
    ||target.attempt.nextDigest!==definitionDigest)throw new Error();
   const planned=await planOwnedSupabaseAdditiveMigration(target.attempt.previousDefinition,target.attempt.nextDefinition);
   if(planned.previousDigest!==target.attempt.previousDigest||planned.nextDigest!==target.attempt.nextDigest
    ||planned.queryDigest!==target.attempt.queryDigest||planned.statementCount!==target.attempt.statementCount)throw new Error();
   const deployedDigest=await applicationDefinitionDigest(deployed);
   if(deployedDigest!==target.attempt.previousDigest&&deployedDigest!==target.attempt.nextDigest)throw new Error();
   previous=target.attempt.previousDefinition;next=target.attempt.nextDefinition;
  }
  const store=createOwnedSupabaseMigrationStore({client:input.client,connectionId:target.connectionId,projectId:input.projectId,
   ownerId:input.ownerId,environment:input.environment,connectionVersion:target.connectionVersion,
   expectedAttemptVersion:target.attempt?.version??0,projectRef:target.projectRef,operationId:input.operationId,isCurrent:stable});
  const result=await migrateOwnedSupabaseApplication({projectRef:target.projectRef,operationId:input.operationId,
   previous,next,store,isCurrent:stable,verifyDeployed:verify,fetcher});
  return result.status==='current'?{...result,connectionVersion:target.connectionVersion}:result;
 }catch{throw new Error('Customer Supabase migration worker unavailable.');}
}
