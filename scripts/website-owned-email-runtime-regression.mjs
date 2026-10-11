import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir=await mkdtemp(join(tmpdir(),'tayar-email-runtime-'));
try{
 const out=join(dir,'runtime.cjs');
 await build({entryPoints:['server/website-owned-email-runtime.ts'],bundle:true,platform:'node',format:'cjs',outfile:out});
 const{inspectOwnedEmailRuntimeForPublish:inspect,verifyOwnedEmailRuntimeDestination:verify,
  handoffOwnedEmailRuntime:handoff}=(await import(pathToFileURL(out))).default;
 const ids={projectId:'11111111-1111-4111-8111-111111111111',ownerId:'22222222-2222-4222-8222-222222222222',
  vercelConnectionId:'33333333-3333-4333-8333-333333333333',handoffId:'44444444-4444-4444-8444-444444444444',
  operationId:'55555555-5555-4555-8555-555555555555',commitId:'66666666-6666-4666-8666-666666666666'};
 const sourceUpdatedAt='2026-10-09T20:00:00.000Z',environmentKey='TAYAR_RESEND_01_API_KEY';
 const state=await inspect({client:{async rpc(name,args){assert.equal(name,'website_email_runtime_state_for_worker');
  assert.equal(args.p_environment_key,environmentKey);assert.equal(args.p_source_connection_id,'mail-primary');
  return{data:{handoffId:ids.handoffId,handoffVersion:2,handoffStatus:'verified',handoffOperationId:ids.operationId,
   environmentId:'env_mail123',sourceAvailable:false,ready:true},error:null};}},...ids,vercelConnectionVersion:4,
  sourceConnectionId:'mail-primary',sourceUpdatedAt,environmentKey,environment:'preview'});
 assert.equal(state.ready,true);assert.equal(state.environmentId,'env_mail123');
 await assert.rejects(inspect({client:{async rpc(){return{data:{...state,unexpected:true},error:null};}},...ids,
  vercelConnectionVersion:4,sourceConnectionId:'mail-primary',sourceUpdatedAt,environmentKey,environment:'preview'}),
  /state unavailable/);
 let reads=0;
 await verify({accessToken:'vercel_fixture_token_123456789',userId:'user_fixture123',accountId:'team_fixture123',
  vercelProjectId:'prj_fixture123',environmentId:'env_mail123',environmentKey,projectId:ids.projectId,
  environment:'preview',handoffOperationId:ids.operationId,isCurrent:()=>true,fetcher:async(_url,init)=>{
   reads++;assert.equal(init.method,'GET');return Response.json({envs:[{id:'env_mail123',key:environmentKey,type:'sensitive',
    target:['preview'],gitBranch:`tayar/${ids.projectId}/preview`,comment:`Tayar handoff ${ids.operationId}`} ]});}});
 assert.equal(reads,1);
 await assert.rejects(verify({accessToken:'vercel_fixture_token_123456789',userId:'user_fixture123',accountId:'team_fixture123',
  vercelProjectId:'prj_fixture123',environmentId:'env_mail123',environmentKey,projectId:ids.projectId,
  environment:'preview',handoffOperationId:ids.operationId,isCurrent:()=>true,
  fetcher:async()=>Response.json({envs:[]})}),/destination unavailable/);
 const apiKey=['re','fixtureKey123456789'].join('_');let posts=0;
 const receipt=await handoff({client:{async rpc(name,args){
  if(name==='website_reconcile_completed_vercel_secret_handoff')return{data:null,error:null};
  if(name==='website_begin_vercel_secret_handoff'){assert.equal(args.p_source_field,'apiKey');return{data:{handoffVersion:1,
   accessToken:'vercel_fixture_token_123456789',secretValue:apiKey,userId:'user_fixture123',accountId:'team_fixture123',
   vercelProjectId:'prj_fixture123'},error:null};}
  if(name==='website_reconcile_vercel_secret_handoff')return{data:null,error:null};
  if(name==='website_commit_vercel_secret_handoff'){assert.equal(args.p_vercel_environment_id,'env_mail123');return{data:2,error:null};}
  throw Error(name);}},...ids,vercelConnectionVersion:4,expectedHandoffVersion:0,sourceConnectionId:'mail-primary',
  sourceUpdatedAt,environmentKey,environment:'preview',isCurrent:()=>true,fetcher:async(_url,init)=>{
   if(init.method==='POST'){posts++;const body=JSON.parse(init.body);assert.equal(body.value,apiKey);
    assert.equal(body.key,environmentKey);assert.equal(body.type,'sensitive');return new Response('{}',{status:201});}
   return Response.json({envs:[{id:'env_mail123',key:environmentKey,type:'sensitive',target:['preview'],
    gitBranch:`tayar/${ids.projectId}/preview`,comment:`Tayar handoff ${ids.operationId}`} ]});}});
 assert.deepEqual(receipt,{handoffVersion:2,environmentId:'env_mail123',status:'verified'});assert.equal(posts,1);
 assert.ok(!JSON.stringify(receipt).includes(apiKey));
 await assert.rejects(handoff({client:{async rpc(name){
  if(name==='website_reconcile_completed_vercel_secret_handoff')return{data:null,error:null};
  if(name==='website_begin_vercel_secret_handoff')return{data:{handoffVersion:1,accessToken:'vercel_fixture_token_123456789',
   secretValue:'not-a-resend-key',userId:'user_fixture123',accountId:'team_fixture123',vercelProjectId:'prj_fixture123'},error:null};
  throw Error(name);}},...ids,vercelConnectionVersion:4,expectedHandoffVersion:0,sourceConnectionId:'mail-primary',
  sourceUpdatedAt,environmentKey,environment:'preview',isCurrent:()=>true,fetcher:async()=>{throw Error('must not write');}}),
  /handoff unavailable/);
 const sql=await readFile('supabase/migrations/20261009210000_website_byo_email_publish_runtime.sql','utf8');
 for(const proof of ['website_email_runtime_state_for_worker',"h.source_field='apiKey'","h.environment_key=p_environment_key",
  'v_handoff.source_updated_at=p_source_updated_at','h.source_updated_at,1',
  "not in('runtime-supabase','runtime-cron')"])assert.ok(sql.includes(proof),proof);
 assert.ok(!/decrypted_secret|accessToken|secretValue/i.test(sql),'email state RPC exposes metadata only');
 console.log('PASS owned email runtime: exact receipt state, sensitive Resend handoff, destination proof, retry-safe source identity');
}finally{await rm(dir,{recursive:true,force:true});}
