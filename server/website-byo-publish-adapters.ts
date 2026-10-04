import type { SupabaseClient } from '@supabase/supabase-js';
import { captureWebsiteOwnedApplicationSource, type OwnedSourceReader } from './website-owned-source-capture';
import { discoverOwnedVercelDeployment, inspectOwnedVercelDeployment,
  type OwnedVercelDeploymentReport } from './website-owned-vercel-deployment';
import { createWebsiteByoPublishStore, initializeWebsiteByoPublishOperation } from './website-byo-publish-store';
import { runByoPublishWorker } from './website-byo-publish-worker';
import { runByoProductionPublishWorker } from './website-byo-production-publish-worker';
import { runWebsiteOwnedVercelPromotion } from './website-owned-vercel-promotion-worker';
import { prepareOwnedVercelProductionRuntimeEnvironment,
  prepareOwnedVercelRuntimeEnvironment } from './website-owned-vercel-runtime-environment';
import { handoffOwnedStripeRuntime,inspectOwnedStripeRuntimeForPublish,
  verifyOwnedStripeRuntimeDestination } from './website-owned-stripe';
import { exportWebsiteProjectToOwnedGitHub } from '../src/modules/website-builder/services/websiteGithubExportWorker';
import { beginWebsiteVercelDeploymentAttempt,
  commitWebsiteVercelDeploymentObservation } from '../src/modules/website-builder/services/websiteVercelDeploymentAttemptService';
import type { ByoSourceCapabilities } from '../src/modules/website-builder/core/application-byo-source-capabilities';

type Client=Pick<SupabaseClient,'rpc'>;type Environment='preview'|'production';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const provider=/^[A-Za-z0-9_-]{3,128}$/;const gitName=/^[A-Za-z0-9_.-]{1,100}$/;const project=/^prj_[A-Za-z0-9]{8,128}$/;const numeric=/^\d+$/;
const branch=/^[A-Za-z0-9_./-]{1,200}$/;const env=/^[A-Z][A-Z0-9_]{1,99}$/;
interface Custody{accessToken:string;userId:string;accountId:string;vercelProjectId:string;repositoryId:string;
  repositoryOwner:string;repositoryName:string;productionBranch:string;environment:Environment;}

async function deterministicUuid(value:unknown){
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))));
  bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
  const hex=[...bytes.slice(0,16)].map(v=>v.toString(16).padStart(2,'0')).join('');
  return`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
async function deterministicCommitId(operationId:string,attemptVersion:number,report:OwnedVercelDeploymentReport){
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({operationId,attemptVersion,report}))));
  bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const hex=[...bytes.slice(0,16)].map(v=>v.toString(16).padStart(2,'0')).join('');
  return`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
function parseCustody(value:unknown,environment:Environment):Custody{
  if(!value||typeof value!=='object')throw new Error();const v=value as Record<string,unknown>;
  if(typeof v.accessToken!=='string'||!v.accessToken||v.accessToken.length>4096||/[\r\n]/.test(v.accessToken)
    ||typeof v.userId!=='string'||!provider.test(v.userId)||typeof v.accountId!=='string'||!provider.test(v.accountId)
    ||typeof v.vercelProjectId!=='string'||!project.test(v.vercelProjectId)||typeof v.repositoryId!=='string'||!numeric.test(v.repositoryId)
    ||typeof v.repositoryOwner!=='string'||!gitName.test(v.repositoryOwner)||typeof v.repositoryName!=='string'||!gitName.test(v.repositoryName)
    ||typeof v.productionBranch!=='string'||!branch.test(v.productionBranch)||v.productionBranch.includes('..')||v.environment!==environment)throw new Error();
  return v as unknown as Custody;
}

/** Source-only composition root. Each adapter reuses the existing verified
 * worker boundary; HTTP/UI mounting remains deliberately absent. */
export async function runWebsiteOwnedByoPublish(input:{
  client:Client;operationId:string;projectId:string;ownerId:string;environment:'preview';
  githubConnectionId:string;vercelConnectionId:string;reader:OwnedSourceReader;
  platformOrigin:string;platformUrl:string;platformVercelAccountId:string;
  githubClientId:string;githubClientSecret:string;
  ownerCurrent():Promise<boolean>;
  verifyRuntime:Parameters<typeof captureWebsiteOwnedApplicationSource>[0]['verifyRuntime'];
  requiredEnvironment(capabilities:ByoSourceCapabilities):Promise<string[]>;
  fetcher?:typeof fetch;
}){
  if(typeof window!=='undefined'||![input.operationId,input.projectId,input.ownerId,input.githubConnectionId,input.vercelConnectionId].every(v=>uuid.test(v))
    ||input.environment!=='preview'||!provider.test(input.platformVercelAccountId)||!await input.ownerCurrent())throw new Error('BYO publish adapters unavailable.');
  const scope={client:input.client,operationId:input.operationId,projectId:input.projectId,ownerId:input.ownerId,
    environment:input.environment,isCurrent:()=>current};let current=true;
  const store=createWebsiteByoPublishStore(scope);if(!await store.read(input.operationId))await initializeWebsiteByoPublishOperation(scope);
  let captured:Awaited<ReturnType<typeof captureWebsiteOwnedApplicationSource>>|undefined,custody:Custody|undefined,required:string[]|undefined,
    runtimeReceipt:Awaited<ReturnType<typeof prepareOwnedVercelRuntimeEnvironment>>|undefined;
  const owner=async()=>{if(!current)return false;current=await input.ownerCurrent();return current;};
  const source=async()=>{
    if(!captured)captured=await captureWebsiteOwnedApplicationSource({projectId:input.projectId,ownerId:input.ownerId,
      githubConnectionId:input.githubConnectionId,environment:input.environment,platformOrigin:input.platformOrigin,
      platformUrl:input.platformUrl,reader:input.reader,verifyRuntime:input.verifyRuntime});
    const saved=await store.read(input.operationId);if(saved?.sourceDigest&&saved.sourceDigest!==captured.sourceDigest)throw new Error();
    if(!await captured.isCurrent()||!await owner())throw new Error();return captured;
  };
  const grant=async()=>{const capturedSource=await source();if(custody)return custody;
    const result=await input.client.rpc('website_read_vercel_integration_custody',{p_connection_id:input.vercelConnectionId,
      p_project_id:input.projectId,p_owner_id:input.ownerId,p_expected_connection_version:capturedSource.vercel.version});
    if(result.error||!await owner())throw new Error();custody=parseCustody(result.data,input.environment);
    if(custody.vercelProjectId!==capturedSource.vercel.targetId||custody.repositoryId!==capturedSource.connection.targetId)throw new Error();return custody;};
  const requirements=async()=>{if(required)return required;const capturedSource=await source();
    required=[...await input.requiredEnvironment(capturedSource.capabilities)].sort();
    if(required.length>64||required.some(v=>!env.test(v))||new Set(required).size!==required.length)throw new Error();
    return required;};
  const environment=async()=>{const names=await requirements();if(runtimeReceipt)return names;
    const capturedSource=await source(),vercel=await grant(),sourceBranch=`tayar/${input.projectId}/preview`;
    runtimeReceipt=await prepareOwnedVercelRuntimeEnvironment({client:input.client,projectId:input.projectId,ownerId:input.ownerId,
      operationId:input.operationId,binding:capturedSource.binding,supabase:capturedSource.supabase,vercel:capturedSource.vercel,
      accessToken:vercel.accessToken,userId:vercel.userId,accountId:vercel.accountId,vercelProjectId:vercel.vercelProjectId,
      isCurrent:async()=>await capturedSource.isCurrent()&&await owner(),fetcher:input.fetcher});
    const proof=await input.client.rpc('website_verify_vercel_runtime_environment',{p_project_id:input.projectId,
      p_owner_id:input.ownerId,p_binding_version:capturedSource.binding.bindingVersion,
      p_supabase_connection_id:capturedSource.supabase.id,p_supabase_connection_version:capturedSource.supabase.version,
      p_vercel_connection_id:capturedSource.vercel.id,p_vercel_connection_version:capturedSource.vercel.version,
      p_vercel_project_id:vercel.vercelProjectId,p_git_branch:sourceBranch,p_required_environment:names});
    if(proof.error||proof.data!==true||!await owner())throw new Error();return names;};
  const stripeRuntime=async()=>{const capturedSource=await source(),stripe=capturedSource.stripeRuntime;
    if(!stripe)return;const vercel=await grant();
    const state=await inspectOwnedStripeRuntimeForPublish({client:input.client,projectId:input.projectId,ownerId:input.ownerId,
      vercelConnectionId:input.vercelConnectionId,vercelConnectionVersion:capturedSource.vercel.version,
      sourceConnectionId:stripe.sourceConnectionId,sourceUpdatedAt:stripe.sourceUpdatedAt,environment:'preview'});
    const exactCurrent=async()=>await capturedSource.isCurrent()&&await owner();
    if(state.ready){if(!state.environmentId||!state.handoffOperationId)throw new Error();
      await verifyOwnedStripeRuntimeDestination({accessToken:vercel.accessToken,userId:vercel.userId,accountId:vercel.accountId,
        vercelProjectId:vercel.vercelProjectId,environmentId:state.environmentId,projectId:input.projectId,
        environment:'preview',handoffOperationId:state.handoffOperationId,isCurrent:exactCurrent,fetcher:input.fetcher});return;}
    const sameOperation=state.handoffOperationId===input.operationId;
    if(state.handoffStatus==='removed'||state.handoffStatus==='preparing'&&!sameOperation
      ||(!state.sourceAvailable&&!(state.handoffStatus==='verified'&&sameOperation)))throw new Error();
    const stripeConnectionId=state.stripeConnectionId??await deterministicUuid({kind:'stripe-runtime-connection',
      projectId:input.projectId,environment:'preview'});
    const handoffId=state.handoffId??await deterministicUuid({kind:'stripe-secret-handoff',projectId:input.projectId,
      environment:'preview',vercelConnectionId:input.vercelConnectionId,sourceConnectionId:stripe.sourceConnectionId});
    let expectedHandoffVersion=state.handoffVersion;
    if(sameOperation&&state.handoffStatus==='preparing')expectedHandoffVersion=state.handoffVersion-1;
    if(sameOperation&&state.handoffStatus==='verified')expectedHandoffVersion=state.handoffVersion-2;
    if(expectedHandoffVersion<0||!await exactCurrent())throw new Error();
    const receipt=await handoffOwnedStripeRuntime({client:input.client,stripeConnectionId,
      vercelConnectionId:input.vercelConnectionId,handoffId,projectId:input.projectId,ownerId:input.ownerId,
      vercelConnectionVersion:capturedSource.vercel.version,expectedHandoffVersion,
      expectedStripeConnectionVersion:state.stripeConnectionVersion,sourceConnectionId:stripe.sourceConnectionId,
      sourceUpdatedAt:stripe.sourceUpdatedAt,publishableKey:stripe.publishableKey,environment:'preview',
      operationId:input.operationId,handoffCommitId:await deterministicUuid({kind:'stripe-handoff-commit',
        operationId:input.operationId,handoffId,sourceUpdatedAt:stripe.sourceUpdatedAt}),
      stripeCommitId:await deterministicUuid({kind:'stripe-runtime-commit',operationId:input.operationId,
        stripeConnectionId,handoffId}),isCurrent:()=>current,fetcher:input.fetcher});
    if(receipt.status!=='ready'||!await exactCurrent())throw new Error();
    await verifyOwnedStripeRuntimeDestination({accessToken:vercel.accessToken,userId:vercel.userId,accountId:vercel.accountId,
      vercelProjectId:vercel.vercelProjectId,environmentId:receipt.environmentId,projectId:input.projectId,
      environment:'preview',handoffOperationId:input.operationId,isCurrent:exactCurrent,fetcher:input.fetcher});};
  const runtime=async()=>{await environment();await stripeRuntime();};
  try{return await runByoPublishWorker({operationId:input.operationId,projectId:input.projectId,ownerId:input.ownerId,
    environment:input.environment,store,isCurrent:owner,
    validate:async()=>{const capturedSource=await source();return{sourceDigest:capturedSource.sourceDigest,requiredEnvironment:await requirements()};},
    prepareRuntime:runtime,
    exportGitHub:async()=>{const capturedSource=await source();return exportWebsiteProjectToOwnedGitHub({projectId:input.projectId,
      ownerId:input.ownerId,connectionId:input.githubConnectionId,environment:input.environment,operationId:input.operationId,
      reader:input.reader,compile:async()=>{if(!await capturedSource.isCurrent())throw new Error();return capturedSource.files;},
      expectedSourceDigest:capturedSource.sourceDigest,client:input.client,githubClientId:input.githubClientId,
      githubClientSecret:input.githubClientSecret,fetcher:input.fetcher});},
    beginDeployment:async(headSha,names)=>{const capturedSource=await source(),vercel=await grant();
      await runtime();if(!runtimeReceipt)throw new Error();
      const prior=await input.client.rpc('website_vercel_deployment_attempt_for_worker',{p_connection_id:input.vercelConnectionId,
        p_project_id:input.projectId,p_owner_id:input.ownerId});if(prior.error)throw new Error();
      const value=prior.data as Record<string,unknown>|null,version=value===null?0:value.version;
      if(!Number.isSafeInteger(version)||(version as number)<0)throw new Error();
      return beginWebsiteVercelDeploymentAttempt({client:input.client,connectionId:input.vercelConnectionId,projectId:input.projectId,
        ownerId:input.ownerId,connectionVersion:capturedSource.vercel.version,expectedAttemptVersion:version as number,
        vercelProjectId:vercel.vercelProjectId,repositoryId:vercel.repositoryId,sourceCommitSha:headSha,target:input.environment,
        requiredEnvironment:names,runtimeEnvironmentReceiptVersion:runtimeReceipt.receiptVersion,
        runtimeEnvironmentIds:runtimeReceipt.environmentIds,operationId:input.operationId,isCurrent:()=>current});},
    discoverDeployment:async headSha=>{const vercel=await grant();return discoverOwnedVercelDeployment({accessToken:vercel.accessToken,
      accountId:vercel.accountId,projectId:vercel.vercelProjectId,sourceCommitSha:headSha,sourceBranch:`tayar/${input.projectId}/${input.environment}`,
      target:input.environment,isCurrent:owner,fetcher:input.fetcher});},
    inspectDeployment:async(deploymentId,headSha,names)=>{const vercel=await grant();await runtime();if(!runtimeReceipt)throw new Error();
      return inspectOwnedVercelDeployment({
      accessToken:vercel.accessToken,userId:vercel.userId,accountId:vercel.accountId,platformAccountId:input.platformVercelAccountId,
      projectId:vercel.vercelProjectId,deploymentId,repositoryId:vercel.repositoryId,repositoryOwner:vercel.repositoryOwner,
      repositoryName:vercel.repositoryName,productionBranch:vercel.productionBranch,sourceBranch:`tayar/${input.projectId}/${input.environment}`,
      sourceCommitSha:headSha,target:input.environment,
      requiredEnvironment:names,requiredEnvironmentIds:runtimeReceipt.environmentIds,isCurrent:owner,fetcher:input.fetcher});},
    commitObservation:async(attemptVersion,report)=>{if(!await owner())throw new Error();const committed=await commitWebsiteVercelDeploymentObservation({
      client:input.client,connectionId:input.vercelConnectionId,projectId:input.projectId,ownerId:input.ownerId,
      expectedAttemptVersion:attemptVersion,operationId:input.operationId,commitId:await deterministicCommitId(input.operationId,attemptVersion,report),
      report,isCurrent:()=>current});return committed.attemptVersion;},
  });}catch{throw new Error('BYO publish adapters unavailable.');}
}

/** Production consumes an already verified Preview checkpoint. It has no
 * GitHub export or deployment-trigger callback and can only promote that SHA. */
export async function runWebsiteOwnedByoProductionPublish(input:{
  client:Client;operationId:string;previewOperationId:string;projectId:string;ownerId:string;
  previewVercelConnectionId:string;productionVercelConnectionId:string;
  previewConnectionVersion:number;productionConnectionVersion:number;
  reader:OwnedSourceReader;ownerCurrent():Promise<boolean>;fetcher?:typeof fetch;
}){
  if(typeof window!=='undefined'||![input.operationId,input.previewOperationId,input.projectId,input.ownerId,
    input.previewVercelConnectionId,input.productionVercelConnectionId].every(v=>uuid.test(v))
    ||input.operationId===input.previewOperationId||input.previewVercelConnectionId===input.productionVercelConnectionId
    ||![input.previewConnectionVersion,input.productionConnectionVersion].every(v=>Number.isSafeInteger(v)&&v>0)
    ||!await input.ownerCurrent())throw new Error('BYO production publish adapters unavailable.');
  let current=true;const owner=async()=>{if(!current)return false;current=await input.ownerCurrent();return current;};
  const previewScope={client:input.client,operationId:input.previewOperationId,projectId:input.projectId,ownerId:input.ownerId,
    environment:'preview' as const,isCurrent:()=>current};
  const productionScope={client:input.client,operationId:input.operationId,projectId:input.projectId,ownerId:input.ownerId,
    environment:'production' as const,isCurrent:()=>current};
  try{
    const previewStore=createWebsiteByoPublishStore(previewScope),store=createWebsiteByoPublishStore(productionScope);
    if(!await store.read(input.operationId))await initializeWebsiteByoPublishOperation(productionScope);
    const custodyResult=await input.client.rpc('website_read_vercel_integration_custody',{p_connection_id:input.productionVercelConnectionId,
      p_project_id:input.projectId,p_owner_id:input.ownerId,p_expected_connection_version:input.productionConnectionVersion});
    if(custodyResult.error||!await owner())throw new Error();const custody=parseCustody(custodyResult.data,'production');
    return await runByoProductionPublishWorker({operationId:input.operationId,previewOperationId:input.previewOperationId,
      projectId:input.projectId,ownerId:input.ownerId,store,isCurrent:owner,readPreview:op=>previewStore.read(op),
      promote:async preview=>{
        if(!preview.attemptVersion||!preview.deploymentId||!preview.headSha||!await owner())throw new Error();
        const binding=await input.reader.readOwnedRuntimeBinding(input.projectId,input.ownerId,'preview');
        if(!binding)throw new Error();
        const[supabase,previewVercel,productionVercel]=await Promise.all([
          input.reader.readConnection(binding.supabaseConnectionId,input.projectId,input.ownerId),
          input.reader.readConnection(input.previewVercelConnectionId,input.projectId,input.ownerId),
          input.reader.readConnection(input.productionVercelConnectionId,input.projectId,input.ownerId),
        ]);if(!supabase||!previewVercel||!productionVercel)throw new Error();
        const runtimeReceipt=await prepareOwnedVercelProductionRuntimeEnvironment({client:input.client,projectId:input.projectId,
          ownerId:input.ownerId,operationId:input.operationId,binding,supabase,previewVercel,productionVercel,
          accessToken:custody.accessToken,userId:custody.userId,accountId:custody.accountId,
          vercelProjectId:custody.vercelProjectId,isCurrent:owner,fetcher:input.fetcher});
        return runWebsiteOwnedVercelPromotion({client:input.client,operationId:input.operationId,projectId:input.projectId,
          ownerId:input.ownerId,previewConnectionId:input.previewVercelConnectionId,
          productionConnectionId:input.productionVercelConnectionId,previewConnectionVersion:input.previewConnectionVersion,
          productionConnectionVersion:input.productionConnectionVersion,previewAttemptVersion:preview.attemptVersion,
          runtimeEnvironmentReceiptVersion:runtimeReceipt.receiptVersion,runtimeEnvironmentIds:runtimeReceipt.environmentIds,
          vercelProjectId:custody.vercelProjectId,deploymentId:preview.deploymentId,sourceCommitSha:preview.headSha,
          sourceBranch:`tayar/${input.projectId}/preview`,accessToken:custody.accessToken,accountId:custody.accountId,
          productionBranch:custody.productionBranch,isCurrent:owner,fetcher:input.fetcher});},
    });
  }catch{throw new Error('BYO production publish adapters unavailable.');}
}
