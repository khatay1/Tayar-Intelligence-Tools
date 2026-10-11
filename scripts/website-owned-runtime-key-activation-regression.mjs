import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir=await mkdtemp(join(tmpdir(),'tayar-key-activation-'));
try{
 const out=join(dir,'activation.cjs');await build({entryPoints:['server/website-owned-runtime-key-activation.ts'],bundle:true,
  platform:'node',format:'cjs',outfile:out});
 const{activateOwnedRuntimeKeys:activate}=(await import(pathToFileURL(out))).default;
 const ids={activationId:'11111111-1111-4111-8111-111111111111',projectId:'22222222-2222-4222-8222-222222222222',
  ownerId:'33333333-3333-4333-8333-333333333333',vercelConnectionId:'44444444-4444-4444-8444-444444444444'};
 const supabaseValue=['sb','secret','fixture12345678901234567890'].join('_');
 const custody={version:3,accountId:'customer-user',organizationId:'org-customer',organizationSlug:'org-customer',
  projectRef:'abcdefghijklmnopqrst',environment:'preview',accessToken:'supabase_oauth_fixture_1234567890'};
 const vercel={accessToken:'vercel_oauth_fixture_1234567890',userId:'user_fixture123',accountId:'team_fixture123',
  vercelProjectId:'prj_fixture123'};
 const staged=new Map(),envs=[];let commits=0,supabaseReads=0;
 const client={async rpc(name,args){
  if(name==='website_owned_runtime_secret_state_for_worker'){
   const item=staged.get(args.p_environment_key);return{data:item?{stageId:item.stageId,stageVersion:1,
    stageOperationId:item.operationId,sourceUpdatedAt:item.updatedAt,handoffId:null,handoffVersion:0,handoffStatus:null,
    handoffOperationId:null,environmentId:null,sourceAvailable:true,ready:false}:{stageId:null,stageVersion:0,
    stageOperationId:null,sourceUpdatedAt:null,handoffId:null,handoffVersion:0,handoffStatus:null,
    handoffOperationId:null,environmentId:null,sourceAvailable:false,ready:false},error:null};
  }
  if(name==='website_stage_owned_runtime_secret'){
   const updatedAt=`2026-10-09T23:00:0${staged.size}.000Z`;staged.set(args.p_environment_key,{stageId:args.p_id,
    operationId:args.p_operation_id,updatedAt,value:args.p_value});return{data:{stageVersion:1,sourceUpdatedAt:updatedAt},error:null};
  }
  if(name==='website_reconcile_completed_vercel_secret_handoff')return{data:null,error:null};
  if(name==='website_begin_vercel_secret_handoff'){
   const item=staged.get(args.p_environment_key);assert.equal(args.p_source_updated_at,item.updatedAt);
   return{data:{handoffVersion:1,accessToken:vercel.accessToken,secretValue:item.value,userId:vercel.userId,
    accountId:vercel.accountId,vercelProjectId:vercel.vercelProjectId},error:null};
  }
  if(name==='website_reconcile_vercel_secret_handoff')return{data:null,error:null};
  if(name==='website_commit_vercel_secret_handoff'){commits++;return{data:2,error:null};}
  throw Error(name);
 }};
 const fetcher=async(url,init)=>{
  if(String(url).startsWith('https://api.supabase.com/')){supabaseReads++;assert.equal(init.method,'GET');
   return Response.json([{id:'key_runtime_preview',name:'tayar-runtime-preview',type:'secret',api_key:supabaseValue}]);}
  if(String(url).startsWith('https://api.vercel.com/')&&init.method==='POST'){
   const body=JSON.parse(init.body);assert.equal(body.type,'sensitive');assert.ok(!envs.some(item=>item.key===body.key));
   envs.push({id:`env_${body.key.toLowerCase()}`,key:body.key,type:body.type,target:body.target,
    gitBranch:body.gitBranch,comment:body.comment});return new Response('{}',{status:201});
  }
  if(String(url).startsWith('https://api.vercel.com/')&&init.method==='GET')return Response.json({envs});
  throw Error(String(url));
 };
 const receipts=await activate({...ids,client,environment:'preview',vercelConnectionVersion:7,supabaseCustody:custody,
  vercel,isCurrent:()=>true,fetcher});
 assert.deepEqual(receipts.map(item=>item.environmentKey),['SUPABASE_SECRET_KEY','CRON_SECRET']);
 assert.equal(commits,2);assert.equal(supabaseReads,1);assert.equal(envs.length,2);
 assert.ok(envs.every(item=>item.type==='sensitive'&&item.target[0]==='preview'
  &&item.gitBranch===`tayar/${ids.projectId}/preview`));
 assert.ok(!JSON.stringify(receipts).includes(supabaseValue));
 assert.match(staged.get('CRON_SECRET').value,/^[A-Za-z0-9_-]{43}$/);
 console.log('PASS final runtime key activation: Supabase reuse, one-time cron entropy, Vault handoff, exact Vercel receipts and value-free result');
}finally{await rm(dir,{recursive:true,force:true});}
