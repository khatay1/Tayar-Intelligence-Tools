import type{SupabaseClient}from'@supabase/supabase-js';
import{assertOwnedSupabaseMigrationMetadata,type OwnedSupabaseMigrationPlan,
 type OwnedSupabaseMigrationStore}from'./website-owned-supabase-migration';

type Client=Pick<SupabaseClient,'rpc'>;type Environment='preview'|'production';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ref=/^[a-z]{20}$/;const object=(value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
function committed(value:unknown){const row=object(value);if(!row||Object.keys(row).some(key=>!['attemptVersion','connectionVersion'].includes(key))
 ||!Number.isSafeInteger(row.attemptVersion)||(row.attemptVersion as number)<1
 ||!Number.isSafeInteger(row.connectionVersion)||(row.connectionVersion as number)<1)throw new Error();
 return{attemptVersion:row.attemptVersion as number,connectionVersion:row.connectionVersion as number};}

/** Concrete service-role adapter for the durable migration-attempt RPCs.
 * The claim token is request-local and never enters plan metadata or results. */
export function createOwnedSupabaseMigrationStore(input:{client:Client;connectionId:string;projectId:string;ownerId:string;
 environment:Environment;connectionVersion:number;expectedAttemptVersion:number;projectRef:string;operationId:string;
 isCurrent():Promise<boolean>;}):OwnedSupabaseMigrationStore{
 if(typeof window!=='undefined'||![input.connectionId,input.projectId,input.ownerId,input.operationId].every(value=>uuid.test(value))
  ||!['preview','production'].includes(input.environment)||!ref.test(input.projectRef)
  ||!Number.isSafeInteger(input.connectionVersion)||input.connectionVersion<1
  ||!Number.isSafeInteger(input.expectedAttemptVersion)||input.expectedAttemptVersion<0)
  throw new Error('Customer Supabase migration store unavailable.');
 const scope={p_connection_id:input.connectionId,p_project_id:input.projectId,p_owner_id:input.ownerId};
 const metadata=(plan:OwnedSupabaseMigrationPlan)=>{assertOwnedSupabaseMigrationMetadata(plan);if(plan.kind!=='additive'||plan.statementCount<1)throw new Error();
  return{p_previous_digest:plan.previousDigest,p_next_digest:plan.nextDigest,p_query_digest:plan.queryDigest};};
 return{
  async prepare(plan){try{const meta=metadata(plan);if(!await input.isCurrent())throw new Error();
   const{data,error}=await input.client.rpc('website_begin_supabase_migration',{...scope,p_environment:input.environment,
    p_connection_version:input.connectionVersion,p_expected_attempt_version:input.expectedAttemptVersion,
    p_project_ref:input.projectRef,p_previous_definition:plan.previous,p_next_definition:plan.next,...meta,
    p_statement_count:plan.statementCount,p_operation_id:input.operationId});
   if(error||!Number.isSafeInteger(data)||data<1||!await input.isCurrent())throw new Error();return data;
  }catch{throw new Error('Customer Supabase migration store unavailable.');}},
  async claim(attemptVersion){try{if(!Number.isSafeInteger(attemptVersion)||attemptVersion<1||!await input.isCurrent())throw new Error();
   const{data,error}=await input.client.rpc('website_claim_supabase_migration',{...scope,
    p_expected_attempt_version:attemptVersion,p_operation_id:input.operationId});const row=object(data);
   if(error||!row||Object.keys(row).some(key=>!['attemptVersion','issueMutation','accessToken'].includes(key))
    ||!Number.isSafeInteger(row.attemptVersion)||(row.attemptVersion as number)<attemptVersion
    ||typeof row.issueMutation!=='boolean'||typeof row.accessToken!=='string'||row.accessToken.length<20
    ||row.accessToken.length>4096||/[\r\n]/.test(row.accessToken)||!await input.isCurrent())throw new Error();
   return{attemptVersion:row.attemptVersion as number,issueMutation:row.issueMutation,accessToken:row.accessToken};
  }catch{throw new Error('Customer Supabase migration store unavailable.');}},
  async commit(attemptVersion,plan,commitId){try{const meta=metadata(plan);if(!Number.isSafeInteger(attemptVersion)||attemptVersion<1
    ||!uuid.test(commitId)||!await input.isCurrent())throw new Error();
   const{data,error}=await input.client.rpc('website_commit_supabase_migration',{...scope,p_expected_attempt_version:attemptVersion,
    p_operation_id:input.operationId,...meta,p_commit_id:commitId});if(error||!await input.isCurrent())throw new Error();return committed(data);
  }catch{throw new Error('Customer Supabase migration store unavailable.');}},
  async reconcile(attemptVersion,plan,commitId){try{const meta=metadata(plan);if(!Number.isSafeInteger(attemptVersion)||attemptVersion<1
    ||!uuid.test(commitId)||!await input.isCurrent())throw new Error();
   const{data,error}=await input.client.rpc('website_reconcile_supabase_migration',{...scope,p_expected_attempt_version:attemptVersion,
    p_operation_id:input.operationId,...meta,p_commit_id:commitId});if(error||data===null||!await input.isCurrent())return null;return committed(data);
  }catch{return null;}}
 };
}
