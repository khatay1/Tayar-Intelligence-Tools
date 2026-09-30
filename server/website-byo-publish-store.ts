import type { SupabaseClient } from '@supabase/supabase-js';
import type { ByoPublishCheckpoint, ByoPublishStage, ByoPublishStore } from './website-byo-publish-worker';

type Client=Pick<SupabaseClient,'rpc'>;
type Scope={client:Client;operationId:string;projectId:string;ownerId:string;environment:'preview'|'production';isCurrent():boolean};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digest=/^[0-9a-f]{64}$/;const sha=/^[0-9a-f]{40}$/;const env=/^[A-Z][A-Z0-9_]{1,99}$/;
const deployment=/^dpl_[A-Za-z0-9]{8,128}$/;const live=/^https:\/\/[a-z0-9-]+[.]vercel[.]app$/;
const stages=new Set<ByoPublishStage>(['created','validated','exporting','exported','observing','blocked','ready']);
const edges=new Set(['created:validated','validated:exporting','exporting:exported','exported:observing',
  'observing:observing','observing:blocked','observing:ready']);

function assertScope(scope:Scope){if(typeof window!=='undefined'||![scope.operationId,scope.projectId,scope.ownerId].every(v=>uuid.test(v))
  ||!['preview','production'].includes(scope.environment)||!scope.isCurrent())throw new Error('BYO publish checkpoint unavailable.');}
function assertEvidence(v:ByoPublishCheckpoint|Omit<ByoPublishCheckpoint,'version'>){
  const empty=v.requiredEnvironment.length===0,source=v.sourceDigest!==null,head=v.headSha!==null,attempt=v.attemptVersion!==null;
  const deployed=v.deploymentId!==null,url=v.liveUrl!==null;
  const valid=v.stage==='created'?empty&&!source&&!head&&!attempt&&!deployed&&!url
    :v.stage==='validated'||v.stage==='exporting'?source&&!head&&!attempt&&!deployed&&!url
    :v.stage==='exported'?source&&head&&!attempt&&!deployed&&!url
    :v.stage==='observing'?source&&head&&attempt&&!url
    :v.stage==='blocked'?source&&head&&attempt&&deployed&&!url
    :source&&head&&attempt&&deployed&&url;
  if(!valid)throw new Error();
}
function checkpoint(value:unknown,scope:Omit<Scope,'client'|'isCurrent'>):ByoPublishCheckpoint{
  if(!value||typeof value!=='object')throw new Error();const v=value as Record<string,unknown>;
  if(!Array.isArray(v.requiredEnvironment)||!v.requiredEnvironment.every(x=>typeof x==='string'))throw new Error();
  const required=v.requiredEnvironment as string[];
  const sorted=[...required].sort();
  if(v.operationId!==scope.operationId||v.projectId!==scope.projectId||v.ownerId!==scope.ownerId||v.environment!==scope.environment
    ||!stages.has(v.stage as ByoPublishStage)||!Number.isSafeInteger(v.version)||(v.version as number)<1
    ||required.length>64||required.some(x=>!env.test(x))||new Set(required).size!==required.length
    ||required.some((x,i)=>x!==sorted[i])||(v.sourceDigest!==null&&(typeof v.sourceDigest!=='string'||!digest.test(v.sourceDigest)))
    ||(v.headSha!==null&&(typeof v.headSha!=='string'||!sha.test(v.headSha)))
    ||(v.attemptVersion!==null&&(!Number.isSafeInteger(v.attemptVersion)||(v.attemptVersion as number)<1))
    ||(v.deploymentId!==null&&(typeof v.deploymentId!=='string'||!deployment.test(v.deploymentId)))
    ||(v.liveUrl!==null&&(typeof v.liveUrl!=='string'||!live.test(v.liveUrl))))throw new Error();
  const row=v as unknown as ByoPublishCheckpoint;assertEvidence(row);return{...row,requiredEnvironment:[...required]};
}
function argumentsFor(scope:Scope,current:ByoPublishCheckpoint,next:Omit<ByoPublishCheckpoint,'version'>){
  if(!edges.has(`${current.stage}:${next.stage}`)||next.operationId!==current.operationId||next.projectId!==current.projectId
    ||next.ownerId!==current.ownerId||next.environment!==current.environment)throw new Error();
  const checked=checkpoint({...next,version:current.version+1},scope);const key=`${scope.operationId}:${current.version}:${next.stage}`;
  return{args:{p_operation_id:scope.operationId,p_project_id:scope.projectId,p_owner_id:scope.ownerId,
    p_environment:scope.environment,p_expected_version:current.version,p_expected_stage:current.stage,p_next_stage:next.stage,
    p_source_digest:checked.sourceDigest,p_required_environment:checked.requiredEnvironment,p_head_sha:checked.headSha,
    p_attempt_version:checked.attemptVersion,p_deployment_id:checked.deploymentId,p_live_url:checked.liveUrl,p_transition_key:key}};
}

export async function initializeWebsiteByoPublishOperation(scope:Scope):Promise<ByoPublishCheckpoint>{
  assertScope(scope);const{data,error}=await scope.client.rpc('website_initialize_byo_publish_operation',{
    p_operation_id:scope.operationId,p_project_id:scope.projectId,p_owner_id:scope.ownerId,p_environment:scope.environment});
  if(error||!scope.isCurrent())throw new Error('BYO publish checkpoint unavailable.');
  try{const saved=checkpoint(data,scope);if(saved.stage!=='created'||saved.version!==1)throw new Error();return saved;
  }catch{throw new Error('BYO publish checkpoint unavailable.');}
}

export function createWebsiteByoPublishStore(scope:Scope):ByoPublishStore{
  assertScope(scope);const exact={operationId:scope.operationId,projectId:scope.projectId,ownerId:scope.ownerId,environment:scope.environment};
  return{
    async read(operationId){assertScope(scope);if(operationId!==scope.operationId)throw new Error('BYO publish checkpoint unavailable.');
      const{data,error}=await scope.client.rpc('website_read_byo_publish_operation',{p_operation_id:scope.operationId,
        p_project_id:scope.projectId,p_owner_id:scope.ownerId,p_environment:scope.environment});
      if(error||!scope.isCurrent())throw new Error('BYO publish checkpoint unavailable.');if(data===null)return null;
      try{return checkpoint(data,exact);}catch{throw new Error('BYO publish checkpoint unavailable.');}},
    async transition(current,next){assertScope(scope);let request:ReturnType<typeof argumentsFor>;
      try{const currentChecked=checkpoint(current,exact);request=argumentsFor(scope,currentChecked,next);}catch{throw new Error('BYO publish checkpoint changed.');}
      const accept=(value:unknown)=>{const saved=checkpoint(value,exact);
        if(saved.version!==current.version+1||saved.stage!==next.stage||saved.sourceDigest!==next.sourceDigest
          ||saved.headSha!==next.headSha||saved.attemptVersion!==next.attemptVersion||saved.deploymentId!==next.deploymentId
          ||saved.liveUrl!==next.liveUrl||saved.requiredEnvironment.length!==next.requiredEnvironment.length
          ||saved.requiredEnvironment.some((v,i)=>v!==next.requiredEnvironment[i]))throw new Error();return saved;};
      const recover=async()=>{const result=await scope.client.rpc('website_reconcile_byo_publish_transition',request.args);
        if(result.error||!scope.isCurrent())throw new Error();return accept(result.data);};
      try{const result=await scope.client.rpc('website_transition_byo_publish_operation',request.args);
        if(!result.error&&scope.isCurrent())return accept(result.data);return await recover();
      }catch{try{return await recover();}catch{throw new Error('BYO publish checkpoint changed.');}}
    },
  };
}
