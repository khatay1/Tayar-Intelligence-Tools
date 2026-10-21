import assert from'node:assert/strict';
import{mkdtemp,readFile,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';
import{pathToFileURL}from'node:url';import{build}from'esbuild';

const dir=await mkdtemp(join(tmpdir(),'tayar-stripe-webhook-runtime-'));
try{
 const out=join(dir,'runtime.cjs');await build({entryPoints:['server/website-owned-stripe-webhook-runtime.ts'],
  bundle:true,platform:'node',format:'cjs',outfile:out});
 const{inspectOwnedStripeWebhookRuntimeForPublish:inspect,verifyOwnedStripeWebhookRuntimeDestination:verify,
  handoffOwnedStripeWebhookRuntime:handoff}=(await import(pathToFileURL(out))).default;
 const ids={projectId:'11111111-1111-4111-8111-111111111111',ownerId:'22222222-2222-4222-8222-222222222222',
  vercelConnectionId:'33333333-3333-4333-8333-333333333333',handoffId:'44444444-4444-4444-8444-444444444444',
  operationId:'55555555-5555-4555-8555-555555555555',commitId:'66666666-6666-4666-8666-666666666666'};
 const common={...ids,vercelConnectionVersion:4,sourceConnectionId:'stripe-primary',
  stripeSourceUpdatedAt:'2026-10-20T00:00:00.000Z',webhookSourceUpdatedAt:'2026-10-20T00:01:00.000Z',
  endpointId:'we_fixture12345678',applicationOrigin:'https://customer.example',environment:'preview'};
 const state=await inspect({...common,client:{async rpc(name,args){
  assert.equal(name,'website_stripe_webhook_runtime_state_for_worker');
  assert.equal(args.p_endpoint_id,common.endpointId);assert.equal(args.p_stripe_source_updated_at,common.stripeSourceUpdatedAt);
  return{data:{handoffId:ids.handoffId,handoffVersion:2,handoffStatus:'verified',handoffOperationId:ids.operationId,
   environmentId:'env_webhook123',sourceAvailable:false,endpointProofVerified:true,ready:true},error:null};}}});
 assert.equal(state.ready,true);assert.equal(state.endpointProofVerified,true);
 await assert.rejects(inspect({...common,client:{async rpc(){return{data:{...state,endpointProofVerified:false},error:null};}}}),
  /state unavailable/,'missing endpoint proof blocks signing-secret custody');
 let reads=0;await verify({accessToken:'vercel_fixture_token_123456789',userId:'user_fixture123',accountId:'team_fixture123',
  vercelProjectId:'prj_fixture123',environmentId:'env_webhook123',projectId:ids.projectId,environment:'preview',
  handoffOperationId:ids.operationId,isCurrent:()=>true,fetcher:async(_url,init)=>{reads++;assert.equal(init.method,'GET');
   return Response.json({envs:[{id:'env_webhook123',key:'STRIPE_WEBHOOK_SECRET',type:'sensitive',target:['preview'],
    gitBranch:`tayar/${ids.projectId}/preview`,comment:`Tayar handoff ${ids.operationId}`} ]});}});
 assert.equal(reads,1);
 const signingSecret=['whsec','fixtureSigningSecret123456789'].join('_');let posts=0;
 const receipt=await handoff({...ids,client:{async rpc(name,args){
  if(name==='website_reconcile_completed_vercel_secret_handoff')return{data:null,error:null};
  if(name==='website_begin_vercel_secret_handoff'){assert.equal(args.p_source_field,'webhookSigningSecret');
   assert.equal(args.p_environment_key,'STRIPE_WEBHOOK_SECRET');return{data:{handoffVersion:1,
    accessToken:'vercel_fixture_token_123456789',secretValue:signingSecret,userId:'user_fixture123',
    accountId:'team_fixture123',vercelProjectId:'prj_fixture123'},error:null};}
  if(name==='website_reconcile_vercel_secret_handoff')return{data:null,error:null};
  if(name==='website_commit_vercel_secret_handoff')return{data:2,error:null};throw Error(name);}},
  vercelConnectionVersion:4,expectedHandoffVersion:0,sourceConnectionId:'stripe-primary',
  sourceUpdatedAt:common.webhookSourceUpdatedAt,environment:'preview',isCurrent:()=>true,fetcher:async(_url,init)=>{
   if(init.method==='POST'){posts++;const body=JSON.parse(init.body);assert.equal(body.value,signingSecret);
    assert.equal(body.key,'STRIPE_WEBHOOK_SECRET');assert.equal(body.type,'sensitive');return new Response('{}',{status:201});}
   return Response.json({envs:[{id:'env_webhook123',key:'STRIPE_WEBHOOK_SECRET',type:'sensitive',target:['preview'],
    gitBranch:`tayar/${ids.projectId}/preview`,comment:`Tayar handoff ${ids.operationId}`} ]});}});
 assert.deepEqual(receipt,{handoffVersion:2,environmentId:'env_webhook123',status:'verified'});assert.equal(posts,1);
 assert.ok(!JSON.stringify(receipt).includes(signingSecret));
 await assert.rejects(handoff({...ids,client:{async rpc(name){
  if(name==='website_reconcile_completed_vercel_secret_handoff')return{data:null,error:null};
  if(name==='website_begin_vercel_secret_handoff')return{data:{handoffVersion:1,
   accessToken:'vercel_fixture_token_123456789',secretValue:'invalid',userId:'user_fixture123',
   accountId:'team_fixture123',vercelProjectId:'prj_fixture123'},error:null};throw Error(name);}},
  vercelConnectionVersion:4,expectedHandoffVersion:0,sourceConnectionId:'stripe-primary',
  sourceUpdatedAt:common.webhookSourceUpdatedAt,environment:'preview',isCurrent:()=>true,
  fetcher:async()=>{throw Error('invalid secret must not reach Vercel');}}),/handoff unavailable/);
 const sql=await readFile('supabase/migrations/20261020133000_website_stripe_webhook_secret_handoff.sql','utf8');
 for(const proof of['website_stripe_webhook_endpoint_proofs','website_record_stripe_webhook_endpoint_proof',
  'website_stripe_webhook_runtime_state_for_worker',"h.source_field='webhookSigningSecret'",
  "h.environment_key='STRIPE_WEBHOOK_SECRET'",'v_endpoint_proof_verified'])assert.ok(sql.includes(proof),proof);
 assert.ok(!/decrypted_secret|secret_value|accessToken|authorization/i.test(sql),'webhook proof/state SQL is metadata only');
 console.log('PASS Stripe webhook runtime: durable endpoint proof gate, exact signing-secret handoff, destination proof and fail-closed invalid secret');
}finally{await rm(dir,{recursive:true,force:true});}
