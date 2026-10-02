import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir=await mkdtemp(join(tmpdir(),'tayar-vercel-attempt-'));
try {
  const outfile=join(dir,'attempt.cjs');
  await build({entryPoints:['src/modules/website-builder/services/websiteVercelDeploymentAttemptService.ts'],
    bundle:true,platform:'node',format:'cjs',outfile});
  const {beginWebsiteVercelDeploymentAttempt:begin,commitWebsiteVercelDeploymentObservation:commit}=
    (await import(pathToFileURL(outfile))).default;
  const base={connectionId:'11111111-1111-4111-8111-111111111111',projectId:'22222222-2222-4222-8222-222222222222',
    ownerId:'33333333-3333-4333-8333-333333333333',connectionVersion:4,expectedAttemptVersion:0,
    vercelProjectId:'prj_booking1234',repositoryId:'12345678',sourceCommitSha:'a'.repeat(40),target:'preview',
    requiredEnvironment:['SUPABASE_URL','SUPABASE_ANON_KEY'],operationId:'44444444-4444-4444-8444-444444444444',
    runtimeEnvironmentReceiptVersion:6,runtimeEnvironmentIds:{SUPABASE_URL:'env_url123',SUPABASE_ANON_KEY:'env_anon123'},
    isCurrent:()=>true};
  let beginArgs;
  assert.equal(await begin({...base,client:{async rpc(name,args){assert.equal(name,'website_begin_vercel_deployment_attempt');
    beginArgs=args;return{data:1,error:null};}}}),1);
  assert.deepEqual(beginArgs.p_required_environment,['SUPABASE_ANON_KEY','SUPABASE_URL']);
  assert.equal(beginArgs.p_runtime_environment_receipt_version,6);
  assert.deepEqual(beginArgs.p_runtime_environment_ids,{SUPABASE_ANON_KEY:'env_anon123',SUPABASE_URL:'env_url123'});
  assert.equal(beginArgs.p_source_commit_sha,base.sourceCommitSha);
  const report={status:'ready',deploymentId:'dpl_deployment1234',missingEnvironment:[],
    liveUrl:'https://booking-abc.vercel.app',observedState:'READY'};
  const commitId='55555555-5555-4555-8555-555555555555';let calls=0;
  assert.deepEqual(await commit({client:{async rpc(name,args){calls++;
    assert.equal(name,'website_commit_vercel_deployment_observation');assert.equal(args.p_live_url,report.liveUrl);
    return{data:{attemptVersion:2,connectionVersion:5},error:null};}},connectionId:base.connectionId,
    projectId:base.projectId,ownerId:base.ownerId,expectedAttemptVersion:1,operationId:base.operationId,
    commitId,report,isCurrent:()=>true}),{attemptVersion:2,connectionVersion:5});assert.equal(calls,1);
  let lost=0;let reconcileArgs;
  assert.deepEqual(await commit({client:{async rpc(name,args){lost++;
    if(name==='website_commit_vercel_deployment_observation')return{data:null,error:{message:'lost'}};
    reconcileArgs=args;
    return{data:{attemptVersion:2,connectionVersion:5},error:null};}},connectionId:base.connectionId,
    projectId:base.projectId,ownerId:base.ownerId,expectedAttemptVersion:1,operationId:base.operationId,
    commitId,report,isCurrent:()=>true}),{attemptVersion:2,connectionVersion:5});assert.equal(lost,2);
  assert.equal(reconcileArgs.p_observed_state,'READY');assert.deepEqual(reconcileArgs.p_missing_environment,[]);
  assert.equal(reconcileArgs.p_live_url,report.liveUrl);
  await assert.rejects(begin({...base,requiredEnvironment:['SUPABASE_URL','SUPABASE_URL'],client:{rpc(){throw Error();}}}),/unavailable/);
  await assert.rejects(begin({...base,runtimeEnvironmentReceiptVersion:0,client:{rpc(){throw Error();}}}),/unavailable/);
  await assert.rejects(begin({...base,runtimeEnvironmentIds:{SUPABASE_URL:'env_url123'},client:{rpc(){throw Error();}}}),/unavailable/);
  await assert.rejects(begin({...base,runtimeEnvironmentIds:{SUPABASE_URL:'env_same123',SUPABASE_ANON_KEY:'env_same123'},client:{rpc(){throw Error();}}}),/unavailable/);
  await assert.rejects(commit({client:{rpc(){throw Error();}},connectionId:base.connectionId,
    projectId:base.projectId,ownerId:base.ownerId,expectedAttemptVersion:1,operationId:base.operationId,
    commitId,report:{...report,status:'setup-incomplete',liveUrl:null},isCurrent:()=>true}),/unavailable/);
  const originalSql=await readFile('supabase/migrations/20260930013000_website_byo_vercel_deployment_attempt.sql','utf8');
  const receiptSql=await readFile('supabase/migrations/20261002090825_website_byo_deployment_runtime_receipt.sql','utf8');
  const sql=originalSql+receiptSql;
  assert.match(sql,/source_commit_sha text not null/);assert.match(sql,/status='connecting'/);
  assert.match(sql,/website_vercel_integration_custody set connection_version=v_connection_version/);
  assert.match(sql,/last_commit_id=p_commit_id/);assert.doesNotMatch(sql,/access_token|decrypted_secret/i);
  assert.match(sql,/a[.]missing_environment=p_missing_environment/);
  assert.match(receiptSql,/runtime_environment_receipt_version bigint/);
  assert.match(receiptSql,/runtime_environment_ids jsonb/);
  assert.match(receiptSql,/e[.]version=d[.]runtime_environment_receipt_version/);
  assert.match(receiptSql,/e[.]vercel_environment_ids=d[.]runtime_environment_ids/);
  assert.match(receiptSql,/e[.]superseded_environment_ids is null/);
  console.log('PASS Vercel deployment attempt: exact runtime receipt, commit-bound begin, atomic readiness and lost-response recovery (mocked RPC/static SQL)');
} finally {await rm(dir,{recursive:true,force:true});}
