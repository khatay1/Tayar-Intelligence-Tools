import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir=await mkdtemp(join(tmpdir(),'tayar-vercel-secret-remove-'));
try{
  const outfile=join(dir,'remove.cjs');await build({entryPoints:['server/website-owned-vercel-environment.ts'],bundle:true,platform:'node',format:'cjs',outfile});
  const {removeOwnedSecretFromVercel:remove}=(await import(pathToFileURL(outfile))).default;
  const ids={handoffId:'11111111-1111-4111-8111-111111111111',projectId:'22222222-2222-4222-8222-222222222222',
    ownerId:'33333333-3333-4333-8333-333333333333',operationId:'44444444-4444-4444-8444-444444444444',
    commitId:'55555555-5555-4555-8555-555555555555'};
  const begun={alreadyRemoved:false,handoffVersion:3,accessToken:'vercel_fixture_token_123456789',userId:'user_fixture123',
    accountId:'team_fixture123',vercelProjectId:'prj_fixture123',environmentId:'env_fixture123',
    environmentKey:'STRIPE_SECRET_KEY',target:'production',gitBranch:''};
  const base={...ids,connectionVersion:7,expectedHandoffVersion:2,isCurrent:()=>true};let reads=0,deletes=0,rpc=[];
  const client={async rpc(name,args){rpc.push(name);if(name==='website_reconcile_completed_vercel_secret_removal')return{data:null,error:null};
    if(name==='website_begin_vercel_secret_removal')return{data:begun,error:null};
    if(name==='website_reconcile_vercel_secret_removal')return{data:null,error:null};
    if(name==='website_commit_vercel_secret_removal'){assert.equal(args.p_vercel_environment_id,'env_fixture123');return{data:4,error:null};}throw Error(name);}};
  const fetcher=async(url,init)=>{assert.ok(url.includes('prj_fixture123'));assert.ok(!url.includes('STRIPE_SECRET_KEY'));
    if(init.method==='DELETE'){deletes++;assert.ok(url.includes('/env/env_fixture123?teamId=team_fixture123'));return new Response('[]',{status:200});}
    reads++;return new Response(JSON.stringify({envs:reads===1?[{id:'env_fixture123',key:'STRIPE_SECRET_KEY',type:'sensitive',target:['production']}]:[]}),{status:200});};
  assert.deepEqual(await remove({...base,client,fetcher}),{handoffVersion:4,status:'removed'});assert.equal(deletes,1);assert.equal(reads,2);
  assert.deepEqual(rpc,['website_reconcile_completed_vercel_secret_removal','website_begin_vercel_secret_removal',
    'website_reconcile_vercel_secret_removal','website_commit_vercel_secret_removal']);
  let reconciles=0;
  assert.deepEqual(await remove({...base,client:{async rpc(name){if(name==='website_reconcile_completed_vercel_secret_removal')return{data:null,error:null};
    if(name==='website_begin_vercel_secret_removal')return{data:begun,error:null};
    if(name==='website_reconcile_vercel_secret_removal')return{data:++reconciles===1?null:4,error:null};
    if(name==='website_commit_vercel_secret_removal')return{data:null,error:{message:'lost'}};throw Error();}},
    fetcher:async(url,init)=>init.method==='DELETE'?Promise.reject(Error('lost')):new Response(JSON.stringify({envs:[]}),{status:200})}),
    {handoffVersion:4,status:'removed'});assert.equal(reconciles,2);
  assert.deepEqual(await remove({...base,client:{async rpc(name){assert.equal(name,'website_reconcile_completed_vercel_secret_removal');return{data:4,error:null};},},
    fetcher(){throw Error('must not call provider');}}),{handoffVersion:4,status:'removed'});
  let providerCalls=0;
  await assert.rejects(remove({...base,client,fetcher:async()=>{providerCalls++;return new Response(JSON.stringify({envs:[
    {id:'env_fixture123',key:'OTHER_KEY',type:'sensitive',target:['production']}]}),{status:200});}}),/unavailable/);
  assert.equal(providerCalls,1,'changed destination is never deleted');
  const sql=await readFile('supabase/migrations/20260930023000_website_byo_vercel_secret_removal.sql','utf8');
  assert.match(sql,/status='removing'/);assert.match(sql,/status='removed'/);assert.match(sql,/removed_at is not null/);
  assert.match(sql,/website_reconcile_completed_vercel_secret_removal/);
  assert.match(sql,/grant execute on function public[.]website_begin_vercel_secret_removal[^;]+to service_role/s);
  assert.doesNotMatch(sql,/grant execute on function public[.]website_begin_vercel_secret_removal[^;]+to authenticated/s);
  console.log('PASS Vercel secret removal: exact destination, absent-after-delete proof, lost-response reconciliation and removed receipt (mocked HTTP/RPC/static SQL)');
}finally{await rm(dir,{recursive:true,force:true});}
