import type{ApplicationDefinition}from'../src/modules/website-builder/core/application-model';
import{applicationDefinitionDigest}from'../src/modules/website-builder/core/application-backend-verification';
import{compileAdditiveApplicationMigration}from'../src/modules/website-builder/core/application-schema-sql';
import{readApplicationDefinition}from'../src/modules/website-builder/core/application-validation';

const ref=/^[a-z]{20}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digest=/^[0-9a-f]{64}$/;
const sha=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),
 byte=>byte.toString(16).padStart(2,'0')).join('');

export interface OwnedSupabaseMigrationPlan{
 kind:'current'|'additive';previous:ApplicationDefinition;next:ApplicationDefinition;
 previousDigest:string;nextDigest:string;queryDigest:string;statementCount:number;query:string;
}
export interface OwnedSupabaseMigrationStore{
 prepare(plan:OwnedSupabaseMigrationPlan):Promise<number>;
 claim(attemptVersion:number):Promise<{attemptVersion:number;issueMutation:boolean;accessToken:string}>;
 commit(attemptVersion:number,plan:OwnedSupabaseMigrationPlan,commitId:string):Promise<{attemptVersion:number;connectionVersion:number}>;
 reconcile(attemptVersion:number,plan:OwnedSupabaseMigrationPlan,commitId:string):Promise<{attemptVersion:number;connectionVersion:number}|null>;
}

/** Compiler output is the authority: existing tables/fields/auth/roles cannot be
 * removed, reordered or changed, and required columns need a safe default. */
export async function planOwnedSupabaseAdditiveMigration(previous:ApplicationDefinition,next:ApplicationDefinition):Promise<OwnedSupabaseMigrationPlan>{
 if(typeof window!=='undefined')throw new Error('Customer Supabase migration planning requires a server runtime.');
 try{
  const before=readApplicationDefinition(previous),after=readApplicationDefinition(next);
  const statements=compileAdditiveApplicationMigration(before,after);
  if(statements.length>512||statements.some(statement=>typeof statement!=='string'||!statement.trim()
    ||/^\s*(?:begin|commit|rollback)(?:\s|;|$)/i.test(statement)))throw new Error();
  const body=statements.length?`begin;\nset local lock_timeout='5s';\nset local statement_timeout='60s';\n${statements.join('\n')}\ncommit;`:'';
  if(body.length>1_048_576)throw new Error();
  const previousDigest=await applicationDefinitionDigest(before),nextDigest=await applicationDefinitionDigest(after);
  return{kind:statements.length?'additive':'current',previous:structuredClone(before),next:structuredClone(after),
   previousDigest,nextDigest,queryDigest:await sha(body),statementCount:statements.length,query:body};
 }catch{throw new Error('Customer Supabase migration is not safely additive.');}
}

async function commitId(operationId:string,attemptVersion:number,plan:OwnedSupabaseMigrationPlan){
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({operationId,attemptVersion,
  previousDigest:plan.previousDigest,nextDigest:plan.nextDigest,queryDigest:plan.queryDigest}))));
 bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const hex=[...bytes.slice(0,16)].map(v=>v.toString(16).padStart(2,'0')).join('');
 return`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

/** The durable store must persist prepare/claim before issueMutation=true.
 * A claimed retry is verification-only: an uncertain Management API request
 * is never repeated automatically. Two identical revision proofs are required. */
export async function migrateOwnedSupabaseApplication(input:{projectRef:string;operationId:string;
 previous:ApplicationDefinition;next:ApplicationDefinition;store:OwnedSupabaseMigrationStore;
 isCurrent():Promise<boolean>;verifyDeployed(definition:ApplicationDefinition):Promise<boolean>;fetcher?:typeof fetch;
}){
 if(typeof window!=='undefined'||!ref.test(input.projectRef)||!uuid.test(input.operationId)||!await input.isCurrent())
  throw new Error('Customer Supabase migration unavailable.');
 const plan=await planOwnedSupabaseAdditiveMigration(input.previous,input.next);
 const verify=async()=>await input.isCurrent()&&await input.verifyDeployed(structuredClone(plan.next))&&await input.isCurrent();
 try{
  if(plan.kind==='current'){
   if(!await verify()||!await verify())throw new Error();
   return{status:'current' as const,previousDigest:plan.previousDigest,nextDigest:plan.nextDigest,queryDigest:plan.queryDigest};
  }
  const prepared=await input.store.prepare(plan);if(!Number.isSafeInteger(prepared)||prepared<1||!await input.isCurrent())throw new Error();
  const claimed=await input.store.claim(prepared);if(!Number.isSafeInteger(claimed.attemptVersion)||claimed.attemptVersion<prepared
   ||typeof claimed.issueMutation!=='boolean'||typeof claimed.accessToken!=='string'||claimed.accessToken.length<20
   ||claimed.accessToken.length>4096||/[\r\n]/.test(claimed.accessToken)||!await input.isCurrent())throw new Error();
  if(claimed.issueMutation){try{const response=await(input.fetcher??fetch)(`https://api.supabase.com/v1/projects/${input.projectRef}/database/query`,{
    method:'POST',headers:{Authorization:`Bearer ${claimed.accessToken}`,'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({query:plan.query}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(60_000)});
   if(response.status!==201)throw new Error();}catch{/* uncertain result: reconcile by revision, never repeat */}}
  if(!await verify()||!await verify())throw new Error();
  const id=await commitId(input.operationId,claimed.attemptVersion,plan);
  try{const committed=await input.store.commit(claimed.attemptVersion,plan,id);
   if(committed.attemptVersion===claimed.attemptVersion+1&&Number.isSafeInteger(committed.connectionVersion)
    &&committed.connectionVersion>0&&await input.isCurrent())return{status:'ready' as const,...committed,
     previousDigest:plan.previousDigest,nextDigest:plan.nextDigest,queryDigest:plan.queryDigest};}catch{/* reconcile below */}
  const recovered=await input.store.reconcile(claimed.attemptVersion,plan,id);
  if(!recovered||recovered.attemptVersion!==claimed.attemptVersion+1||!Number.isSafeInteger(recovered.connectionVersion)
   ||recovered.connectionVersion<1||!await input.isCurrent())throw new Error();
  return{status:'ready' as const,...recovered,previousDigest:plan.previousDigest,nextDigest:plan.nextDigest,queryDigest:plan.queryDigest};
 }catch{throw new Error('Customer Supabase migration unavailable.');}
}

export function assertOwnedSupabaseMigrationMetadata(value:{previousDigest:string;nextDigest:string;queryDigest:string}){
 if(!digest.test(value.previousDigest)||!digest.test(value.nextDigest)||!digest.test(value.queryDigest)
  ||value.previousDigest===value.nextDigest)throw new Error('Customer Supabase migration metadata is invalid.');
}
