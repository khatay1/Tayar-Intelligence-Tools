import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir=await mkdtemp(join(tmpdir(),'tayar-vercel-secret-'));
try{
  const outfile=join(dir,'handoff.cjs');
  await build({entryPoints:['server/website-owned-vercel-environment.ts'],bundle:true,platform:'node',format:'cjs',outfile});
  const {handoffOwnedSecretToVercel:handoff}=(await import(pathToFileURL(outfile))).default;
  const ids={handoffId:'11111111-1111-4111-8111-111111111111',connectionId:'22222222-2222-4222-8222-222222222222',
    projectId:'33333333-3333-4333-8333-333333333333',ownerId:'44444444-4444-4444-8444-444444444444',
    operationId:'55555555-5555-4555-8555-555555555555',commitId:'66666666-6666-4666-8666-666666666666'};
  const secret='stripe_private_fixture_value_123456';
  const begun={handoffVersion:1,accessToken:'vercel_fixture_token_123456789',secretValue:secret,
    userId:'user_fixture123',accountId:'team_fixture123',vercelProjectId:'prj_fixture123'};
  const base={...ids,connectionVersion:7,expectedHandoffVersion:0,sourceConnectionId:'stripe',sourceField:'secretKey',
    sourceEnvironment:'production',sourceUpdatedAt:'2026-09-29T22:00:00.000Z',environmentKey:'STRIPE_SECRET_KEY',
    target:'production',gitBranch:'',isCurrent:()=>true};
  const marker=`Tayar handoff ${ids.operationId}`;let posted;let rpcNames=[];
  const client={async rpc(name,args){rpcNames.push(name);
    if(name==='website_begin_vercel_secret_handoff'){assert.equal(args.p_environment_key,'STRIPE_SECRET_KEY');return{data:begun,error:null};}
    if(name==='website_reconcile_vercel_secret_handoff')return{data:null,error:null};
    if(name==='website_commit_vercel_secret_handoff'){assert.equal(args.p_vercel_environment_id,'env_fixture123');return{data:2,error:null};}
    throw Error(name);}};
  const fetcher=async(url,init)=>{assert.ok(!url.includes(secret));
    if(init.method==='POST'){posted=JSON.parse(init.body);return new Response('{}',{status:201});}
    return new Response(JSON.stringify({envs:[{id:'env_fixture123',key:'STRIPE_SECRET_KEY',type:'sensitive',
      target:['production'],comment:marker}]}),{status:200,headers:{'content-type':'application/json'}});};
  const result=await handoff({...base,client,fetcher});
  assert.deepEqual(result,{handoffVersion:2,environmentId:'env_fixture123',status:'verified'});
  assert.equal(posted.value,secret);assert.equal(posted.type,'sensitive');assert.deepEqual(posted.target,['production']);
  assert.equal(posted.comment,marker);assert.ok(!JSON.stringify(result).includes(secret));
  assert.deepEqual(rpcNames,['website_begin_vercel_secret_handoff','website_reconcile_vercel_secret_handoff','website_commit_vercel_secret_handoff']);
  let uncertainChecks=0;
  assert.deepEqual(await handoff({...base,client:{async rpc(name){
    if(name==='website_begin_vercel_secret_handoff')return{data:begun,error:null};
    if(name==='website_reconcile_vercel_secret_handoff')return{data:++uncertainChecks===1?null:2,error:null};
    if(name==='website_commit_vercel_secret_handoff')return{data:null,error:{message:'response lost'}};throw Error();}},fetcher}),result);
  assert.equal(uncertainChecks,2,'lost commit response requires an exact second reconciliation');
  let calls=0;
  assert.deepEqual(await handoff({...base,client:{async rpc(name){if(name==='website_begin_vercel_secret_handoff')return{data:begun,error:null};
    if(name==='website_reconcile_vercel_secret_handoff'){calls++;return{data:2,error:null};}throw Error();}},
    fetcher:async(url,init)=>{if(init.method==='POST')throw Error('response lost');return fetcher(url,init);}}),result);
  assert.equal(calls,1,'already committed handoff reconciles without replaying the SQL commit');
  await assert.rejects(handoff({...base,client,fetcher:async(url,init)=>init.method==='POST'?new Response('{}',{status:201}):
    new Response(JSON.stringify({envs:[{id:'env_fixture123',key:'STRIPE_SECRET_KEY',type:'plain',target:['production'],comment:marker}]}),{status:200})}),/unavailable/);
  const sql=await readFile('supabase/migrations/20260930020000_website_byo_vercel_secret_handoff.sql','utf8');
  assert.match(sql,/delete from private[.]website_project_secrets/);assert.match(sql,/join vault[.]decrypted_secrets s_secret/);
  assert.match(sql,/status='verified'/);assert.match(sql,/website_project_secret_refs_impl/);
  assert.match(sql,/grant execute on function public[.]website_begin_vercel_secret_handoff[^;]+to service_role/s);
  assert.doesNotMatch(sql,/grant execute on function public[.]website_begin_vercel_secret_handoff[^;]+to authenticated/s);
  console.log('PASS Vercel secret handoff: sensitive upsert, exact metadata proof, lost-response recovery and Vault cleanup receipt (mocked HTTP/RPC/static SQL)');
}finally{await rm(dir,{recursive:true,force:true});}
