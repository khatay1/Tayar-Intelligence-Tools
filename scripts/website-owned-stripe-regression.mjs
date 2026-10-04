import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir=await mkdtemp(join(tmpdir(),'tayar-owned-stripe-'));
try{
  const out=join(dir,'stripe.cjs');
  await build({entryPoints:['server/website-owned-stripe.ts'],bundle:true,platform:'node',format:'cjs',outfile:out});
  const {verifyOwnedStripeAccount:verify,handoffOwnedStripeRuntime:handoff}=(await import(pathToFileURL(out))).default;
  const restricted=['rk','live','fixtureaccountkey123456789'].join('_');
  const publishable=['pk','live','fixturepublickey123456789'].join('_');
  let calls=0;
  const fetcher=async(url,init)=>{
    calls++;
    assert.equal(url,'https://api.stripe.com/v1/account');
    assert.equal(init.method,'GET');
    assert.equal(init.redirect,'error');
    assert.equal(init.cache,'no-store');
    assert.equal(init.headers.Authorization,`Bearer ${restricted}`);
    assert.equal(init.headers.Accept,'application/json');
    return new Response(JSON.stringify({id:'acct_fixture12345678',object:'account',charges_enabled:true}),{
      status:200,headers:{'content-type':'application/json'}
    });
  };
  const proof=await verify({secretKey:restricted,publishableKey:publishable,environment:'production',isCurrent:()=>true,fetcher});
  assert.deepEqual(proof,{accountId:'acct_fixture12345678',keyType:'restricted',mode:'live',chargesEnabled:true});
  assert.equal(calls,1);
  assert.ok(!JSON.stringify(proof).includes(restricted));

  let deniedCalls=0;
  await assert.rejects(verify({secretKey:['sk','test','fixturekey123456789'].join('_'),publishableKey:publishable,
    environment:'production',isCurrent:()=>true,fetcher:async()=>{deniedCalls++;throw Error();}}),/verification unavailable/);
  assert.equal(deniedCalls,0,'mode mismatch fails before Stripe');
  await assert.rejects(verify({secretKey:restricted,publishableKey:publishable,environment:'production',isCurrent:()=>true,
    fetcher:async()=>new Response(JSON.stringify({id:'acct_fixture12345678',object:'account',charges_enabled:false}),{status:200})}),/verification unavailable/);
  await assert.rejects(verify({secretKey:restricted,publishableKey:publishable,environment:'production',isCurrent:()=>true,
    fetcher:async()=>new Response(JSON.stringify({id:'bad-account',object:'account',charges_enabled:true}),{status:200})}),/verification unavailable/);
  await assert.rejects(verify({secretKey:restricted,publishableKey:publishable,environment:'production',isCurrent:()=>true,
    fetcher:async()=>new Response('Authorization: '+restricted,{status:401})}),error=>
      error.message==='Stripe account verification unavailable.'&&!error.message.includes(restricted));
  let current=true;
  await assert.rejects(verify({secretKey:restricted,publishableKey:publishable,environment:'production',
    isCurrent:()=>current,fetcher:async()=>{current=false;return new Response(JSON.stringify({id:'acct_fixture12345678',object:'account',charges_enabled:true}),{status:200});}}),
    /verification unavailable/);
  const testSecret=['sk','test','fixturekey123456789'].join('_');
  const testPublic=['pk','test','fixturepublic123456789'].join('_');
  assert.deepEqual(await verify({secretKey:testSecret,publishableKey:testPublic,environment:'preview',isCurrent:()=>true,
    fetcher:async()=>new Response(JSON.stringify({id:'acct_sandbox12345678',object:'account',charges_enabled:false}),{status:200})}),
    {accountId:'acct_sandbox12345678',keyType:'secret',mode:'test',chargesEnabled:false});
  const ids={stripeConnectionId:'11111111-1111-4111-8111-111111111111',
    vercelConnectionId:'22222222-2222-4222-8222-222222222222',handoffId:'33333333-3333-4333-8333-333333333333',
    projectId:'44444444-4444-4444-8444-444444444444',ownerId:'55555555-5555-4555-8555-555555555555',
    operationId:'66666666-6666-4666-8666-666666666666',handoffCommitId:'77777777-7777-4777-8777-777777777777',
    stripeCommitId:'88888888-8888-4888-8888-888888888888'};
  const expectedReceipt={connectionVersion:1,handoffVersion:2,accountId:'acct_fixture12345678',
    keyType:'restricted',environmentId:'env_fixture123',status:'ready'};
  let active=false,proofWrites=0,stripeCalls=0,vercelPosts=0;
  const rpcClient={async rpc(name,args){
    if(name==='website_reconcile_stripe_runtime_binding')return{data:active?{
      connectionVersion:1,handoffVersion:2,accountId:'acct_fixture12345678',keyType:'restricted',environmentId:'env_fixture123'}:null,error:null};
    if(name==='website_reconcile_completed_vercel_secret_handoff')return{data:null,error:null};
    if(name==='website_begin_vercel_secret_handoff')return{data:{handoffVersion:1,accessToken:'vercel_fixture_token_123456789',
      secretValue:restricted,userId:'user_fixture123',accountId:'team_fixture123',vercelProjectId:'prj_fixture123'},error:null};
    if(name==='website_record_stripe_secret_proof'){proofWrites++;assert.equal(args.p_handoff_version,1);
      assert.equal(args.p_account_id,'acct_fixture12345678');assert.equal(args.p_key_type,'restricted');return{data:true,error:null};}
    if(name==='website_reconcile_vercel_secret_handoff')return{data:null,error:null};
    if(name==='website_commit_vercel_secret_handoff')return{data:2,error:null};
    if(name==='website_activate_stripe_runtime'){active=true;assert.equal(args.p_expected_connection_version,0);
      assert.equal(args.p_expected_handoff_version,0);return{data:1,error:null};}
    throw Error(name);
  }};
  const marker=`Tayar handoff ${ids.operationId}`;
  const combinedFetch=async(url,init)=>{
    if(url==='https://api.stripe.com/v1/account'){stripeCalls++;assert.equal(init.headers.Authorization,`Bearer ${restricted}`);
      return new Response(JSON.stringify({id:'acct_fixture12345678',object:'account',charges_enabled:true}),{status:200});}
    if(String(url).includes('api.vercel.com')&&init.method==='POST'){vercelPosts++;const body=JSON.parse(init.body);
      assert.equal(body.key,'STRIPE_SECRET_KEY');assert.equal(body.value,restricted);assert.equal(body.type,'sensitive');return new Response('{}',{status:201});}
    if(String(url).includes('api.vercel.com')&&init.method==='GET')return new Response(JSON.stringify({envs:[{
      id:'env_fixture123',key:'STRIPE_SECRET_KEY',type:'sensitive',target:['production'],comment:marker}]}),{status:200});
    throw Error(String(url));
  };
  const runtime=await handoff({...ids,client:rpcClient,vercelConnectionVersion:7,expectedHandoffVersion:0,
    expectedStripeConnectionVersion:0,sourceConnectionId:'stripe-prod',sourceUpdatedAt:'2026-10-04T10:00:00.000Z',
    publishableKey:publishable,environment:'production',isCurrent:()=>true,fetcher:combinedFetch});
  assert.deepEqual(runtime,expectedReceipt);assert.equal(proofWrites,1);assert.equal(stripeCalls,1);assert.equal(vercelPosts,1);
  assert.ok(!JSON.stringify(runtime).includes(restricted));
  assert.deepEqual(await handoff({...ids,client:{async rpc(name){assert.equal(name,'website_reconcile_stripe_runtime_binding');
    return{data:{connectionVersion:1,handoffVersion:2,accountId:'acct_fixture12345678',keyType:'restricted',environmentId:'env_fixture123'},error:null};}},
    vercelConnectionVersion:7,expectedHandoffVersion:0,expectedStripeConnectionVersion:0,sourceConnectionId:'stripe-prod',
    sourceUpdatedAt:'2026-10-04T10:00:00.000Z',publishableKey:publishable,environment:'production',isCurrent:()=>true,
    fetcher:async()=>{throw Error('completed Stripe runtime must not touch providers');}}),expectedReceipt);
  const sql=await (await import('node:fs/promises')).readFile('supabase/migrations/20261004113000_website_byo_stripe_runtime_binding.sql','utf8');
  for(const proofText of ['website_record_stripe_secret_proof','website_activate_stripe_runtime',
    'website_reconcile_stripe_runtime_binding',"h.status='verified'","h.environment_key='STRIPE_SECRET_KEY'"])
    assert.ok(sql.includes(proofText),proofText);
  assert.ok(!/decrypted_secret|secret_value|authorization/i.test(sql),'Stripe proof migration stores metadata only');
  console.log('PASS owned Stripe verifier/runtime handoff: exact account proof, same-secret Vercel delivery, durable metadata receipt and idempotent ready recovery');
}finally{await rm(dir,{recursive:true,force:true});}
