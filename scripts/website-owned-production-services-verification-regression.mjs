import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir=await mkdtemp(join(tmpdir(),'tayar-production-services-proof-'));
try{
  globalThis.__tayarServiceProof={calls:[],ready:true};
  const out=join(dir,'proof.mjs');
  await build({entryPoints:['server/website-owned-production-services-verification.ts'],bundle:true,platform:'node',format:'esm',outfile:out,
    plugins:[{name:'service-proof-fixtures',setup(builder){
      builder.onResolve({filter:/website-owned-stripe$/},()=>({path:'stripe',namespace:'fixture'}));
      builder.onLoad({filter:/^stripe$/,namespace:'fixture'},()=>({contents:`
        export async function inspectOwnedStripeRuntimeForPublish(value){globalThis.__tayarServiceProof.calls.push(['stripe-state',value]);return{ready:globalThis.__tayarServiceProof.ready,environmentId:'env_stripe123',handoffOperationId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}}
        export async function verifyOwnedStripeRuntimeDestination(value){globalThis.__tayarServiceProof.calls.push(['stripe-destination',value])}
      `}));
      builder.onResolve({filter:/website-owned-email-runtime$/},()=>({path:'email',namespace:'fixture'}));
      builder.onLoad({filter:/^email$/,namespace:'fixture'},()=>({contents:`
        export async function inspectOwnedEmailRuntimeForPublish(value){globalThis.__tayarServiceProof.calls.push(['email-state',value]);return{ready:globalThis.__tayarServiceProof.ready,environmentId:'env_resend123',handoffOperationId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}}
        export async function verifyOwnedEmailRuntimeDestination(value){globalThis.__tayarServiceProof.calls.push(['email-destination',value])}
      `}));
      builder.onResolve({filter:/website-owned-runtime-secret-staging$/},()=>({path:'generated',namespace:'fixture'}));
      builder.onLoad({filter:/^generated$/,namespace:'fixture'},()=>({contents:`
        export async function inspectOwnedRuntimeSecretState(value){globalThis.__tayarServiceProof.calls.push(['generated-state',value]);return{ready:globalThis.__tayarServiceProof.ready,environmentId:globalThis.__tayarServiceProof.generatedEnvironmentId??'env_'+value.secret.environmentKey.toLowerCase(),handoffOperationId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}}
      `}));
      builder.onResolve({filter:/website-owned-vercel-environment$/},()=>({path:'vercel',namespace:'fixture'}));
      builder.onLoad({filter:/^vercel$/,namespace:'fixture'},()=>({contents:`
        export async function verifyOwnedSecretInVercel(value){globalThis.__tayarServiceProof.calls.push(['generated-destination',value])}
      `}));
    }}]});
  const{verifyWebsiteOwnedProductionServices:verify}=await import(`${pathToFileURL(out)}?v=${Date.now()}`);
  const projectId='11111111-1111-4111-8111-111111111111',ownerId='22222222-2222-4222-8222-222222222222';
  const vercelConnectionId='33333333-3333-4333-8333-333333333333';
  const definition={version:1,tables:[],roles:[],auth:{enabled:true,signUpEnabled:true,emailVerificationRequired:true},pageAccess:[]};
  const capabilities={definition,pageIds:['home'],needs:{auth:true,database:true,privatePages:false,forms:false,integrations:false,cms:false},integrationProviders:[],stripeCheckouts:[],blockers:[]};
  let current=true;
  const input={client:{rpc:async()=>({data:null,error:null})},projectId,ownerId,vercelConnectionId,vercelConnectionVersion:4,
    capabilities,stripeRuntime:null,emailRuntime:null,vercel:{accessToken:'customer-vercel-access-token',userId:'user_customer',
      accountId:'team_customer',vercelProjectId:'prj_customer1234'},isCurrent:async()=>current,fetcher:async()=>Response.json({})};
  assert.deepEqual(await verify(input),{environmentIds:{}});assert.deepEqual(globalThis.__tayarServiceProof.calls,[]);

  const stripeCapabilities={...capabilities,needs:{...capabilities.needs,integrations:true},integrationProviders:['stripe'],
    stripeCheckouts:[{id:'buy',previewPriceId:'price_test_fixture',productionPriceId:'price_live_fixture'}]};
  const stripeRuntime={sourceConnectionId:'stripe-main',sourceUpdatedAt:'2026-10-18T00:00:00.000Z',publishableKey:'pk_live_fixture'};
  const stripe=await verify({...input,capabilities:stripeCapabilities,stripeRuntime});
  assert.deepEqual(stripe,{environmentIds:{STRIPE_SECRET_KEY:'env_stripe123'}});
  assert.deepEqual(globalThis.__tayarServiceProof.calls.slice(-2).map(call=>call[0]),['stripe-state','stripe-destination']);

  const notification={id:'notify',event:'created',connectionId:'mail-main',template:{subject:'Created',body:'Ready'}};
  const emailCapabilities={...capabilities,needs:{...capabilities.needs,integrations:true},integrationProviders:['resend'],
    definition:{...definition,tables:[{id:'records',key:'records',name:'Records',fields:[],permissions:[],notifications:[notification]}]}};
  const emailRuntime={connections:[{sourceConnectionId:'mail-main',sourceUpdatedAt:'2026-10-18T00:00:00.000Z',
    connectionUpdatedAt:'2026-10-18T00:00:00.000Z',from:'Tayar <noreply@example.com>',environmentKey:'TAYAR_RESEND_01_API_KEY'}]};
  const email=await verify({...input,capabilities:emailCapabilities,emailRuntime});
  assert.deepEqual(email,{environmentIds:{CRON_SECRET:'env_cron_secret',SUPABASE_SECRET_KEY:'env_supabase_secret_key',
    TAYAR_RESEND_01_API_KEY:'env_resend123'}});
  assert.deepEqual(globalThis.__tayarServiceProof.calls.slice(-6).map(call=>call[0]),['email-state','email-destination',
    'generated-state','generated-destination','generated-state','generated-destination']);
  assert.ok(globalThis.__tayarServiceProof.calls.slice(-6).every(call=>call[1].environment==='production'||call[1].target==='production'));

  for (const id of ['env_duplicate123', 'invalid destination id']) {
    globalThis.__tayarServiceProof.generatedEnvironmentId=id;
    await assert.rejects(verify({...input,capabilities:emailCapabilities,emailRuntime}),
      /Customer Production service verification is unavailable/);
  }
  delete globalThis.__tayarServiceProof.generatedEnvironmentId;
  globalThis.__tayarServiceProof.ready=false;
  await assert.rejects(verify({...input,capabilities:stripeCapabilities,stripeRuntime}),/Customer Production service verification is unavailable/);
  globalThis.__tayarServiceProof.ready=true;
  const paid={...stripeCapabilities,definition:{...definition,tables:[{id:'orders',key:'orders',name:'Orders',fields:[],permissions:[],payment:{}}]}};
  await assert.rejects(verify({...input,capabilities:paid,stripeRuntime}),/Customer Production service verification is unavailable/);
  await assert.rejects(verify({...input,capabilities:{...capabilities,needs:{...capabilities.needs,cms:true}}}),
    /Customer Production service verification is unavailable/);
  await assert.rejects(verify({...input,capabilities:{...capabilities,integrationProviders:['webhook']}}),
    /Customer Production service verification is unavailable/);
  current=false;await assert.rejects(verify(input),/Customer Production service verification is unavailable/);
  console.log('PASS Production service proof: baseline, Stripe and email receipts are revalidated read-only; webhook, CMS, missing and stale services fail closed');
}finally{delete globalThis.__tayarServiceProof;await rm(dir,{recursive:true,force:true});}
