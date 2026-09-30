import type { OwnedVercelDeploymentReport } from './website-owned-vercel-deployment';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha=/^[0-9a-f]{40}$/;const digest=/^[0-9a-f]{64}$/;const env=/^[A-Z][A-Z0-9_]{1,99}$/;
export type ByoPublishStage='created'|'validated'|'exporting'|'exported'|'observing'|'blocked'|'ready';
export interface ByoPublishCheckpoint{operationId:string;projectId:string;ownerId:string;environment:'preview'|'production';
  stage:ByoPublishStage;version:number;sourceDigest:string|null;requiredEnvironment:string[];headSha:string|null;
  attemptVersion:number|null;deploymentId:string|null;liveUrl:string|null;}
export interface ByoPublishStore{read(operationId:string):Promise<ByoPublishCheckpoint|null>;
  transition(current:ByoPublishCheckpoint,next:Omit<ByoPublishCheckpoint,'version'>):Promise<ByoPublishCheckpoint>;}

/** Single source-only coordinator for the already validated BYO workers. The
 * durable store must CAS every transition; side-effect stages are persisted
 * before calling GitHub/Vercel so retries reuse the same operation and commit. */
export async function runByoPublishWorker(input:{
  operationId:string;projectId:string;ownerId:string;environment:'preview'|'production';store:ByoPublishStore;
  isCurrent():Promise<boolean>;validate():Promise<{sourceDigest:string;requiredEnvironment:string[]}>;
  exportGitHub(operationId:string):Promise<{status:'unchanged'|'exported'|'recovery-required';headSha:string}>;
  beginDeployment(headSha:string,requiredEnvironment:string[]):Promise<number>;
  discoverDeployment(headSha:string):Promise<string|null>;
  inspectDeployment(deploymentId:string,headSha:string,requiredEnvironment:string[]):Promise<OwnedVercelDeploymentReport>;
  commitObservation(attemptVersion:number,report:OwnedVercelDeploymentReport):Promise<number>;
}):Promise<{status:'pending'|'blocked'|'ready';checkpoint:ByoPublishCheckpoint}>{
  if(typeof window!=='undefined'||![input.operationId,input.projectId,input.ownerId].every(v=>uuid.test(v))
    ||!['preview','production'].includes(input.environment)||!await input.isCurrent())throw new Error('BYO publish unavailable.');
  let state=await input.store.read(input.operationId);
  if(!state||state.operationId!==input.operationId||state.projectId!==input.projectId||state.ownerId!==input.ownerId
    ||state.environment!==input.environment||!Number.isSafeInteger(state.version)||state.version<1)throw new Error('BYO publish unavailable.');
  const move=async(next:Omit<ByoPublishCheckpoint,'version'>)=>{if(!await input.isCurrent())throw new Error();
    // Runtime object spreads retain `version` even when Omit hides it. The
    // durable store, rather than its caller, owns the next CAS version.
    const payload:Omit<ByoPublishCheckpoint,'version'>={operationId:next.operationId,projectId:next.projectId,
      ownerId:next.ownerId,environment:next.environment,stage:next.stage,sourceDigest:next.sourceDigest,
      requiredEnvironment:[...next.requiredEnvironment],headSha:next.headSha,attemptVersion:next.attemptVersion,
      deploymentId:next.deploymentId,liveUrl:next.liveUrl};
    const saved=await input.store.transition(state!,payload);if(saved.version!==state!.version+1||!await input.isCurrent())throw new Error();state=saved;};
  try{
    if(state.stage==='ready')return{status:'ready',checkpoint:state};
    if(state.stage==='blocked')return{status:'blocked',checkpoint:state};
    if(state.stage==='created'){
      const proof=await input.validate(),required=[...proof.requiredEnvironment].sort();
      if(!digest.test(proof.sourceDigest)||required.length>64||required.some(v=>!env.test(v))||new Set(required).size!==required.length)throw new Error();
      await move({...state,stage:'validated',sourceDigest:proof.sourceDigest,requiredEnvironment:required});
    }
    if(state.stage==='validated')await move({...state,stage:'exporting'});
    if(state.stage==='exporting'){
      const exported=await input.exportGitHub(input.operationId);
      if(exported.status==='recovery-required')return{status:'pending',checkpoint:state};
      if(!sha.test(exported.headSha))throw new Error();await move({...state,stage:'exported',headSha:exported.headSha});
    }
    if(state.stage==='exported'){
      if(!state.headSha)throw new Error();const attempt=await input.beginDeployment(state.headSha,state.requiredEnvironment);
      if(!Number.isSafeInteger(attempt)||attempt<1)throw new Error();await move({...state,stage:'observing',attemptVersion:attempt});
    }
    if(state.stage==='observing'){
      if(!state.headSha||!state.attemptVersion)throw new Error();let deploymentId=state.deploymentId;
      if(!deploymentId){deploymentId=await input.discoverDeployment(state.headSha);if(!deploymentId)return{status:'pending',checkpoint:state};
        await move({...state,deploymentId});}
      const report=await input.inspectDeployment(deploymentId,state.headSha,state.requiredEnvironment);
      const nextAttempt=await input.commitObservation(state.attemptVersion,report);
      if(!Number.isSafeInteger(nextAttempt)||nextAttempt!==state.attemptVersion+1)throw new Error();
      if(report.status==='connecting'){await move({...state,attemptVersion:nextAttempt});return{status:'pending',checkpoint:state};}
      if(report.status!=='ready'){await move({...state,stage:'blocked',attemptVersion:nextAttempt,liveUrl:null});return{status:'blocked',checkpoint:state};}
      if(!report.liveUrl)throw new Error();await move({...state,stage:'ready',attemptVersion:nextAttempt,liveUrl:report.liveUrl});
      return{status:'ready',checkpoint:state};
    }
    return{status:'pending',checkpoint:state};
  }catch{throw new Error('BYO publish unavailable.');}
}
