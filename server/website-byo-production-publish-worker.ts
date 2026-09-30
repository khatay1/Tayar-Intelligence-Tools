import type {ByoPublishCheckpoint,ByoPublishStore} from './website-byo-publish-worker';
import type {OwnedVercelPromotionReport} from './website-owned-vercel-promotion';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digest=/^[0-9a-f]{64}$/,sha=/^[0-9a-f]{40}$/,deployment=/^dpl_[A-Za-z0-9]{8,128}$/;
const hostname=/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?[.])+(?:[a-z]{2,63}|vercel[.]app)$/;

function preview(value:ByoPublishCheckpoint,input:{previewOperationId:string;projectId:string;ownerId:string}){
  return value.operationId===input.previewOperationId&&value.projectId===input.projectId&&value.ownerId===input.ownerId
    &&value.environment==='preview'&&value.stage==='ready'&&digest.test(value.sourceDigest??'')&&sha.test(value.headSha??'')
    &&Number.isSafeInteger(value.attemptVersion)&&Number(value.attemptVersion)>0&&deployment.test(value.deploymentId??'')&&!!value.liveUrl;
}

/** Production never exports or triggers a build. It consumes one exact ready
 * Preview checkpoint and delegates only to the durable promotion worker. */
export async function runByoProductionPublishWorker(input:{operationId:string;projectId:string;ownerId:string;
  previewOperationId:string;store:ByoPublishStore;isCurrent():Promise<boolean>;
  readPreview(operationId:string):Promise<ByoPublishCheckpoint|null>;
  promote(preview:ByoPublishCheckpoint):Promise<OwnedVercelPromotionReport&{promotionVersion:number}>;
}):Promise<{status:'pending'|'ready';checkpoint:ByoPublishCheckpoint}>{
  if(typeof window!=='undefined'||![input.operationId,input.projectId,input.ownerId,input.previewOperationId].every(v=>uuid.test(v))
    ||input.operationId===input.previewOperationId||!await input.isCurrent())throw new Error('BYO production publish unavailable.');
  let state=await input.store.read(input.operationId);
  if(!state||state.operationId!==input.operationId||state.projectId!==input.projectId||state.ownerId!==input.ownerId
    ||state.environment!=='production'||!Number.isSafeInteger(state.version)||state.version<1)throw new Error('BYO production publish unavailable.');
  const move=async(next:Omit<ByoPublishCheckpoint,'version'>)=>{if(!await input.isCurrent())throw new Error();
    const saved=await input.store.transition(state!,next);if(saved.version!==state!.version+1||!await input.isCurrent())throw new Error();state=saved;};
  try{
    if(state.stage==='ready')return{status:'ready',checkpoint:state};
    if(state.stage==='created'){
      const source=await input.readPreview(input.previewOperationId);if(!source||!preview(source,input)||!await input.isCurrent())throw new Error();
      await move({operationId:state.operationId,projectId:state.projectId,ownerId:state.ownerId,environment:'production',stage:'validated',
        sourceDigest:source.sourceDigest,requiredEnvironment:[...source.requiredEnvironment],headSha:source.headSha,
        attemptVersion:source.attemptVersion,deploymentId:source.deploymentId,liveUrl:null,previewOperationId:source.operationId,
        promotionVersion:null,productionAliases:[]});
    }
    if(state.stage==='validated')await move({...state,stage:'promoting'});
    if(state.stage==='promoting'){
      const source=await input.readPreview(input.previewOperationId);if(!source||!preview(source,input)
        ||source.sourceDigest!==state.sourceDigest||source.headSha!==state.headSha||source.attemptVersion!==state.attemptVersion
        ||source.deploymentId!==state.deploymentId||!await input.isCurrent())throw new Error();
      const report=await input.promote(source),aliases=[...report.aliases].sort();
      if(report.status!=='ready'||report.deploymentId!==state.deploymentId||report.sourceCommitSha!==state.headSha
        ||!Number.isSafeInteger(report.promotionVersion)||report.promotionVersion<1||!aliases.length||aliases.length>100
        ||new Set(aliases).size!==aliases.length||aliases.some(v=>!hostname.test(v))||report.liveUrl!==`https://${aliases[0]}`)throw new Error();
      await move({...state,stage:'verifying-production',promotionVersion:report.promotionVersion,
        productionAliases:aliases,liveUrl:report.liveUrl});
    }
    if(state.stage==='verifying-production'){await move({...state,stage:'ready'});return{status:'ready',checkpoint:state};}
    return{status:'pending',checkpoint:state};
  }catch{throw new Error('BYO production publish unavailable.');}
}
