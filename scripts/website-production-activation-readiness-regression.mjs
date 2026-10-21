import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';

const dir=await mkdtemp(join(tmpdir(),'tayar-activation-readiness-'));
try{
  const out=join(dir,'readiness.cjs');
  await build({stdin:{contents:`export * from './server/website-production-activation-readiness';`,resolveDir:process.cwd(),loader:'ts'},
    outfile:out,bundle:true,platform:'node',format:'cjs'});
  const {inspectWebsiteProductionActivationReadiness:inspect}=createRequire(import.meta.url)(out);
  const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const [operationId,projectId,ownerId,previewOperationId,githubConnectionId,vercelConnectionId]=Array.from({length:6},(_,i)=>uid(i+1));
  const candidate={status:'source-prepared',operationId,projectId,ownerId,previewOperationId,githubConnectionId,
    previewSourceDigest:'a'.repeat(64),snapshotDigest:'b'.repeat(64),runtimeDigest:'c'.repeat(64),sourceDigest:'d'.repeat(64),headSha:'e'.repeat(40)};
  const scope={candidate,accountId:'team_customer1234',projectId:'prj_customer1234',repositoryId:'12345678',
    runtimeEnvironmentIds:{SUPABASE_URL:'env_url1234',SUPABASE_ANON_KEY:'env_key1234'},runtimeEnvironmentReceiptVersion:2,
    sourceBranch:`tayar/${projectId}/production`};
  const target={scope,vercelConnectionId,vercelConnectionVersion:3};
  const proof={status:'runtime-verified',operationId,deploymentId:'dpl_customer1234',liveUrl:'https://customer-staged.vercel.app',
    sourceDigest:candidate.sourceDigest,runtimeDigest:candidate.runtimeDigest};
  const custody={accessToken:'private-customer-token',environment:'production',accountId:scope.accountId,
    vercelProjectId:scope.projectId,productionBranch:'main'};
  const deployed={id:proof.deploymentId,projectId:scope.projectId,ownerId:scope.accountId,target:'production',readyState:'READY',
    url:'customer-staged.vercel.app',meta:{githubCommitSha:candidate.headSha,githubCommitRef:scope.sourceBranch}};
  const domain={name:'customer.example',projectId:scope.projectId,verified:true,redirect:null,gitBranch:'main',customEnvironmentId:null};
  function fixture(options={}){
    let targetReads=0,current=true;const requests=[];
    const client={rpc:async(name,args)=>{
      assert.equal(args.p_project_id,projectId);assert.equal(args.p_owner_id,ownerId);
      if(name==='website_production_staging_target'){
        targetReads++;if(options.changeTargetAfter&&targetReads>=options.changeTargetAfter)
          return{data:{...target,vercelConnectionVersion:4},error:null};
        return{data:structuredClone(options.target??target),error:null};
      }
      if(name==='website_read_production_runtime_attestation')return{data:structuredClone(options.proof??proof),error:null};
      if(name==='website_read_vercel_integration_custody'){
        assert.equal(args.p_connection_id,vercelConnectionId);assert.equal(args.p_expected_connection_version,3);
        return{data:{...custody,...options.custody},error:null};
      }
      throw Error(`Unexpected RPC ${name}`);
    }};
    const fetcher=async(resource,init)=>{const url=new URL(resource);requests.push({url:String(url),method:init.method});
      assert.equal(url.origin,'https://api.vercel.com');assert.equal(init.method,'GET');
      assert.equal(init.headers.Authorization,`Bearer ${custody.accessToken}`);
      if(url.pathname===`/v13/deployments/${proof.deploymentId}`){if(options.staleAfterDeployment)current=false;
        return Response.json(options.deployed??deployed);}
      assert.equal(url.pathname,`/v9/projects/${scope.projectId}/domains`);
      return Response.json({domains:options.domains??[domain],pagination:{next:null}});
    };
    return{input:{client,operationId,projectId,ownerId,isCurrent:async()=>current,fetcher},requests};
  }
  const good=fixture();
  assert.deepEqual(await inspect(good.input),{status:'activation-ready',operationId,projectId,deploymentId:proof.deploymentId,
    sourceDigest:proof.sourceDigest,runtimeDigest:proof.runtimeDigest,stagingUrl:proof.liveUrl,productionAliases:['customer.example']});
  assert.equal(good.requests.length,4,'Deployment and domains are each read twice');
  assert.ok(good.requests.every(request=>request.method==='GET'),'Readiness must never mutate provider state');
  assert.doesNotMatch(JSON.stringify(await inspect(fixture().input)),/accessToken|private-customer-token|vercelConnection|environmentIds/);
  const failures=[
    {proof:{...proof,runtimeDigest:'0'.repeat(64)}},
    {deployed:{...deployed,url:'other-staged.vercel.app'}},
    {changeTargetAfter:2},
    {domains:[{...domain,verified:false}]},
    {domains:[{...domain,redirect:'www.customer.example'}]},
    {custody:{environment:'preview'}},
    {custody:{accountId:'team_foreign1234'}},
    {staleAfterDeployment:true},
    {target:{...target,scope:{...scope,runtimeEnvironmentIds:{SUPABASE_URL:'bad'}}}},
  ];
  for(const options of failures){const bad=fixture(options);await assert.rejects(inspect(bad.input),/activation readiness unavailable/);
    assert.ok(bad.requests.every(request=>request.method==='GET'));}
  console.log('PASS Production activation readiness: exact current source/attestation/deployment/domain binding, stable read-only provider proof and sanitized failures (RPC/provider mocked; no activation)');
}finally{await rm(dir,{recursive:true,force:true});}
