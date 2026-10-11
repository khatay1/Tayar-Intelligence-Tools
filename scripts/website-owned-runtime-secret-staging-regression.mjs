import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir=await mkdtemp(join(tmpdir(),'tayar-runtime-stage-'));
try{
 const out=join(dir,'stage.cjs');await build({entryPoints:['server/website-owned-runtime-secret-staging.ts'],bundle:true,
  platform:'node',format:'cjs',outfile:out});
 const{stageOwnedRuntimeSecret:stage,inspectOwnedRuntimeSecretState:inspect}=(await import(pathToFileURL(out))).default;
 const ids={stageId:'11111111-1111-4111-8111-111111111111',projectId:'22222222-2222-4222-8222-222222222222',
  ownerId:'33333333-3333-4333-8333-333333333333',vercelConnectionId:'44444444-4444-4444-8444-444444444444',
  operationId:'55555555-5555-4555-8555-555555555555'};
 const secret={sourceConnectionId:'runtime-supabase',sourceField:'apiKey',environmentKey:'SUPABASE_SECRET_KEY'};
 const value=['sb','secret','fixture12345678901234567890'].join('_'),updatedAt='2026-10-09T22:00:00.000Z';
 const receipt=await stage({client:{async rpc(name,args){assert.equal(name,'website_stage_owned_runtime_secret');
  assert.equal(args.p_value,value);assert.equal(args.p_source_connection_id,'runtime-supabase');
  return{data:{stageVersion:1,sourceUpdatedAt:updatedAt},error:null};}},...ids,expectedStageVersion:0,secret,
  environment:'preview',value});
 assert.deepEqual(receipt,{stageVersion:1,sourceUpdatedAt:updatedAt});assert.ok(!JSON.stringify(receipt).includes(value));
 const state=await inspect({client:{async rpc(name,args){assert.equal(name,'website_owned_runtime_secret_state_for_worker');
  assert.equal(args.p_environment_key,'SUPABASE_SECRET_KEY');return{data:{stageId:ids.stageId,stageVersion:1,
   stageOperationId:ids.operationId,sourceUpdatedAt:updatedAt,handoffId:'66666666-6666-4666-8666-666666666666',
   handoffVersion:2,handoffStatus:'verified',handoffOperationId:'77777777-7777-4777-8777-777777777777',
   environmentId:'env_runtime123',sourceAvailable:false,ready:true},error:null};}},...ids,
  vercelConnectionVersion:5,secret,environment:'preview'});
 assert.equal(state.ready,true);assert.equal(state.sourceAvailable,false);
 const empty=await inspect({client:{async rpc(){return{data:{stageId:null,stageVersion:0,stageOperationId:null,
  sourceUpdatedAt:null,handoffId:null,handoffVersion:0,handoffStatus:null,handoffOperationId:null,
  environmentId:null,sourceAvailable:false,ready:false},error:null};}},...ids,vercelConnectionVersion:5,
  secret:{sourceConnectionId:'runtime-cron',sourceField:'secret',environmentKey:'CRON_SECRET'},environment:'production'});
 assert.equal(empty.stageId,null);assert.equal(empty.ready,false);
 await assert.rejects(stage({client:{async rpc(){assert.fail('invalid pair must fail locally');}},...ids,expectedStageVersion:0,
  secret:{sourceConnectionId:'runtime-cron',sourceField:'apiKey',environmentKey:'CRON_SECRET'},environment:'preview',value}),
  /staging unavailable/);
 const sql=await readFile('supabase/migrations/20261009220000_website_owned_runtime_secret_staging.sql','utf8');
 for(const proof of ['website_runtime_secret_stages','website_stage_owned_runtime_secret','website_owned_runtime_secret_state_for_worker',
  "p_source_connection_id='runtime-supabase'","p_source_connection_id='runtime-cron'","h.status='verified'",
  'website_protect_owned_runtime_secret',"auth.role())<>'service_role'",'vault.create_secret','to service_role'])assert.ok(sql.includes(proof),proof);
 assert.ok(!/decrypted_secret|accessToken|secretValue/i.test(sql),'runtime stage metadata APIs never read raw values back');
 console.log('PASS generated runtime secret staging: reserved identities, idempotent metadata receipt, rotation guard and no value reads');
}finally{await rm(dir,{recursive:true,force:true});}
