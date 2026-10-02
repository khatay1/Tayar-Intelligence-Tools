import type{SupabaseClient}from'@supabase/supabase-js';
import{assertInfrastructureConnection,type InfrastructureConnection}from'../src/modules/website-builder/core/application-infrastructure-connections';
import{validateOwnedApplicationPublicBackend}from'../src/modules/website-builder/core/application-data-runtime';
import type{OwnedRuntimeBinding}from'./website-owned-source-capture';

type Client=Pick<SupabaseClient,'rpc'>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const provider=/^[A-Za-z0-9_-]{3,128}$/;const project=/^prj_[A-Za-z0-9]{8,128}$/;
const names=['SUPABASE_ANON_KEY','SUPABASE_URL']as const;
type Name=typeof names[number];
type Begin={receiptVersion:number;status:'preparing'|'verified';newlyClaimed:boolean;marker:string;environmentIds?:Record<Name,string>};

async function sha256(value:string){return[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))]
 .map(v=>v.toString(16).padStart(2,'0')).join('');}
async function commitId(operationId:string,ids:Record<Name,string>){const hex=await sha256(JSON.stringify({operationId,ids}));
 return`${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-${((parseInt(hex[16],16)&3)|8).toString(16)}${hex.slice(17,20)}-${hex.slice(20,32)}`;}
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value as Record<string,unknown>;}
function ids(value:unknown):Record<Name,string>{const v=object(value);if(Object.keys(v).sort().join(',')!==names.join(',')
 ||names.some(name=>typeof v[name]!=='string'||!provider.test(v[name]as string)))throw new Error();return v as Record<Name,string>;}

/** Prepares only the two public runtime values for the exact owned Preview
 * branch. Provider values are never accepted from HTTP/browser input, logged,
 * returned, or persisted in the receipt table. */
export async function prepareOwnedVercelRuntimeEnvironment(input:{client:Client;projectId:string;ownerId:string;
 operationId:string;binding:OwnedRuntimeBinding;supabase:InfrastructureConnection;vercel:InfrastructureConnection;
 accessToken:string;userId:string;accountId:string;vercelProjectId:string;isCurrent():Promise<boolean>;fetcher?:typeof fetch;
}):Promise<{receiptVersion:number;environmentIds:Record<Name,string>;status:'verified'}>{
 try{
  if(typeof window!=='undefined'||![input.projectId,input.ownerId,input.operationId].every(v=>uuid.test(v))
   ||!input.accessToken||input.accessToken.length>4096||/[\r\n]/.test(input.accessToken)
   ||!provider.test(input.userId)||!provider.test(input.accountId)||!project.test(input.vercelProjectId))throw new Error();
  assertInfrastructureConnection(input.supabase);assertInfrastructureConnection(input.vercel);
  const b=input.binding,s=input.supabase,v=input.vercel,branch=`tayar/${input.projectId}/preview`;
  if(b.projectId!==input.projectId||b.ownerId!==input.ownerId||b.environment!=='preview'
   ||b.supabaseConnectionId!==s.id||b.supabaseConnectionVersion!==s.version||s.provider!=='supabase'||s.targetId!==b.backend.projectRef
   ||b.vercelConnectionId!==v.id||b.vercelConnectionVersion!==v.version||v.provider!=='vercel'||v.targetId!==input.vercelProjectId
   ||s.projectId!==input.projectId||s.ownerId!==input.ownerId||s.environment!=='preview'
   ||v.projectId!==input.projectId||v.ownerId!==input.ownerId||v.environment!=='preview'
   ||!Number.isSafeInteger(b.bindingVersion)||b.bindingVersion<1||!await input.isCurrent())throw new Error();
  validateOwnedApplicationPublicBackend(b.backend,s.targetId!);
  const values:Record<Name,string>={SUPABASE_ANON_KEY:b.backend.publishableKey,SUPABASE_URL:b.backend.url};
  const digests:Record<Name,string>={SUPABASE_ANON_KEY:await sha256(values.SUPABASE_ANON_KEY),SUPABASE_URL:await sha256(values.SUPABASE_URL)};
  const begun=await input.client.rpc('website_begin_vercel_runtime_environment',{p_project_id:input.projectId,p_owner_id:input.ownerId,
   p_binding_version:b.bindingVersion,p_supabase_connection_id:s.id,p_supabase_connection_version:s.version,
   p_vercel_connection_id:v.id,p_vercel_connection_version:v.version,p_vercel_project_id:input.vercelProjectId,
   p_git_branch:branch,p_value_digests:digests,p_operation_id:input.operationId});
  const raw=object(begun.data),begin=raw as unknown as Begin;
  if(begun.error||!Number.isSafeInteger(begin.receiptVersion)||begin.receiptVersion<1
   ||!['preparing','verified'].includes(begin.status)||typeof begin.newlyClaimed!=='boolean'
   ||typeof begin.marker!=='string'||!/^Tayar runtime [0-9a-f-]{36}$/i.test(begin.marker)
   ||(begin.status==='preparing'&&begin.marker!==`Tayar runtime ${input.operationId}`)||!await input.isCurrent())throw new Error();
  if(begin.status==='verified')return{receiptVersion:begin.receiptVersion,environmentIds:ids(begin.environmentIds),status:'verified'};
  const team=input.accountId!==input.userId?`&teamId=${encodeURIComponent(input.accountId)}`:'';
  const path=`https://api.vercel.com/v10/projects/${input.vercelProjectId}/env`;
  const headers={Authorization:`Bearer ${input.accessToken}`,'Content-Type':'application/json',Accept:'application/json'};
  if(begin.newlyClaimed){
   if(!await input.isCurrent())throw new Error();
   try{await(input.fetcher??fetch)(`${path}?upsert=true${team}`,{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000),headers,
    body:JSON.stringify(names.map(name=>({key:name,value:values[name],type:'plain',target:['preview'],gitBranch:branch,comment:begin.marker})))});}catch{/* exact metadata proof resolves an uncertain response */}
  }
  if(!await input.isCurrent())throw new Error();
  const response=await(input.fetcher??fetch)(`${path}?decrypt=false${team}`,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000),headers});
  if(response.status!==200||Number(response.headers.get('content-length')??0)>262144)throw new Error();
  const text=await response.text();if(text.length>262144)throw new Error();const payload=object(JSON.parse(text));
  if(!Array.isArray(payload.envs)||payload.envs.length>1000)throw new Error();const environmentIds={}as Record<Name,string>;
  for(const name of names){const matches=payload.envs.filter(item=>{if(!item||typeof item!=='object'||Array.isArray(item))return false;
   const row=item as Record<string,unknown>,targets=Array.isArray(row.target)?row.target:[];
   return row.key===name&&row.type==='plain'&&row.comment===begin.marker&&targets.length===1&&targets[0]==='preview'
    &&row.gitBranch===branch&&typeof row.id==='string'&&provider.test(row.id);});
   if(matches.length!==1)throw new Error();environmentIds[name]=(matches[0]as Record<string,unknown>).id as string;
  }
  if(new Set(Object.values(environmentIds)).size!==2||!await input.isCurrent())throw new Error();
  const commit=await commitId(input.operationId,environmentIds),args={p_project_id:input.projectId,p_owner_id:input.ownerId,
   p_expected_receipt_version:begin.receiptVersion,p_operation_id:input.operationId,
   p_vercel_environment_ids:environmentIds,p_commit_id:commit},expected=begin.receiptVersion+1;
  const reconcile=async()=>{const result=await input.client.rpc('website_reconcile_vercel_runtime_environment',args);
   return!result.error&&result.data===expected&&await input.isCurrent();};
  if(!await reconcile()){try{const result=await input.client.rpc('website_commit_vercel_runtime_environment',args);
   if(result.error||result.data!==expected||!await input.isCurrent())throw new Error();}catch{if(!await reconcile())throw new Error();}}
  return{receiptVersion:expected,environmentIds,status:'verified'};
 }catch{throw new Error('Vercel runtime environment unavailable.');}
}
