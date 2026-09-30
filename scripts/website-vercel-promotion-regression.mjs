import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';import{pathToFileURL}from'node:url';import{build}from'esbuild';
const dir=await mkdtemp(join(tmpdir(),'tayar-vercel-promotion-'));
try{
  const providerOut=join(dir,'provider.cjs'),serviceOut=join(dir,'service.cjs'),workerOut=join(dir,'worker.cjs');
  await build({entryPoints:['server/website-owned-vercel-promotion.ts'],bundle:true,platform:'node',format:'cjs',outfile:providerOut});
  await build({entryPoints:['src/modules/website-builder/services/websiteVercelPromotionService.ts'],bundle:true,platform:'node',format:'cjs',outfile:serviceOut});
  await build({entryPoints:['server/website-owned-vercel-promotion-worker.ts'],bundle:true,platform:'node',format:'cjs',outfile:workerOut});
  const{readOwnedVercelProductionDomains:readDomains,promoteAndVerifyOwnedVercelDeployment:promote}=(await import(pathToFileURL(providerOut))).default;
  const{beginWebsiteVercelPromotion:begin,claimWebsiteVercelPromotion:claim,commitWebsiteVercelPromotion:commit}=(await import(pathToFileURL(serviceOut))).default;
  const{runWebsiteOwnedVercelPromotion:runWorker}=(await import(pathToFileURL(workerOut))).default;
  const accessToken='customer-vercel-token',accountId='team_customer1234',projectId='prj_booking1234',deploymentId='dpl_deployment1234';
  const sourceCommitSha='a'.repeat(40),sourceBranch='tayar/22222222-2222-4222-8222-222222222222/preview';
  const expectedAliases=['booking.example.com','booking.vercel.app'];let domainReads=0;
  const domainFetcher=async(url)=>{domainReads++;assert.match(url,/production=true&verified=true&redirects=false/);return Response.json({domains:expectedAliases.map(name=>({name,projectId,verified:true,redirect:null,gitBranch:null,customEnvironmentId:null}))});};
  assert.deepEqual(await readDomains({accessToken,accountId,projectId,productionBranch:'main',isCurrent:async()=>true,fetcher:domainFetcher}),expectedAliases);
  assert.equal(domainReads,2);
  await assert.rejects(readDomains({accessToken,accountId,projectId,productionBranch:'main',isCurrent:async()=>true,
    fetcher:async()=>Response.json({domains:expectedAliases.map(name=>({name,projectId,verified:true,redirect:null,gitBranch:null,customEnvironmentId:null})),pagination:{count:2,next:123,prev:null}})}),/unavailable/);
  let posts=0,gets=0;
  const providerFetcher=async(url,init)=>{const path=url.replace('https://api.vercel.com','');assert.equal(init.headers.Authorization,`Bearer ${accessToken}`);
    if(init.method==='POST'){posts++;assert.equal(path,`/v10/projects/${projectId}/promote/${deploymentId}?teamId=${accountId}`);return new Response(null,{status:202});}
    gets++;if(path.startsWith(`/v13/deployments/${deploymentId}`))return Response.json({id:deploymentId,projectId,ownerId:accountId,readyState:'READY',meta:{githubCommitSha:sourceCommitSha,githubCommitRef:sourceBranch}});
    if(path.startsWith(`/v2/deployments/${deploymentId}/aliases`))return Response.json({aliases:expectedAliases.map((alias,index)=>({uid:`alias_${index}`,alias,created:new Date().toISOString()}))});
    assert.match(path,new RegExp(`/v1/projects/${projectId}/promote/aliases`));return Response.json({aliases:expectedAliases.map((alias,index)=>({id:`alias_${index}`,alias,status:'SUCCESS'})),pagination:{count:2,next:null,prev:null}});};
  const report=await promote({accessToken,accountId,projectId,deploymentId,sourceCommitSha,sourceBranch,expectedAliases,issuePromotion:true,isCurrent:async()=>true,fetcher:providerFetcher});
  assert.deepEqual(report,{status:'ready',deploymentId,sourceCommitSha,aliases:expectedAliases,liveUrl:'https://booking.example.com'});assert.equal(posts,1);assert.equal(gets,6);
  await promote({accessToken,accountId,projectId,deploymentId,sourceCommitSha,sourceBranch,expectedAliases,issuePromotion:false,isCurrent:async()=>true,fetcher:providerFetcher});assert.equal(posts,1);
  let unstable=0;await assert.rejects(promote({accessToken,accountId,projectId,deploymentId,sourceCommitSha,sourceBranch,expectedAliases,issuePromotion:false,isCurrent:async()=>true,
    fetcher:async(url,init)=>{if(url.includes('/deployments/')&&!url.includes('/aliases'))return Response.json({id:deploymentId,projectId,ownerId:accountId,readyState:'READY',meta:{githubCommitSha:sourceCommitSha,githubCommitRef:sourceBranch}});
      if(url.includes('/deployments/')&&url.includes('/aliases')){unstable++;return Response.json({aliases:(unstable>1?expectedAliases.slice(1):expectedAliases).map((alias,index)=>({uid:`a${index}`,alias,created:new Date().toISOString()}))});}
      return Response.json({aliases:expectedAliases.map((alias,index)=>({id:`a${index}`,alias,status:'SUCCESS'})),pagination:{count:2,next:null,prev:null}});}}),/unavailable/);

  const ids={previewConnectionId:'11111111-1111-4111-8111-111111111111',productionConnectionId:'22222222-2222-4222-8222-222222222222',projectId:'33333333-3333-4333-8333-333333333333',ownerId:'44444444-4444-4444-8444-444444444444',operationId:'55555555-5555-4555-8555-555555555555'};
  const base={...ids,previewConnectionVersion:5,productionConnectionVersion:3,previewAttemptVersion:2,expectedPromotionVersion:0,vercelProjectId:projectId,deploymentId,sourceCommitSha,expectedAliases,isCurrent:()=>true};
  let beginArgs;assert.equal(await begin({...base,client:{async rpc(name,args){assert.equal(name,'website_begin_vercel_promotion');beginArgs=args;return{data:1,error:null};}}}),1);assert.deepEqual(beginArgs.p_expected_aliases,expectedAliases);
  assert.deepEqual(await claim({client:{async rpc(name){assert.equal(name,'website_claim_vercel_promotion');return{data:{promotionVersion:2,issuePromotion:true,accessToken,accountId,productionBranch:'main'},error:null};}},...ids,expectedPromotionVersion:1,isCurrent:()=>true}),{promotionVersion:2,issuePromotion:true,accessToken,accountId,productionBranch:'main'});
  const commitId='66666666-6666-4666-8666-666666666666';let calls=0;
  assert.deepEqual(await commit({client:{async rpc(name){calls++;if(name==='website_commit_vercel_promotion')return{data:null,error:{message:'lost'}};return{data:{promotionVersion:3,connectionVersion:4},error:null};}},productionConnectionId:ids.productionConnectionId,projectId:ids.projectId,ownerId:ids.ownerId,expectedPromotionVersion:2,operationId:ids.operationId,commitId,report,isCurrent:()=>true}),{promotionVersion:3,connectionVersion:4});assert.equal(calls,2);
  let workerPosts=0;const workerFetcher=async(url,init)=>{if(url.includes('/domains?'))return Response.json({domains:expectedAliases.map(name=>({name,projectId,verified:true,redirect:null,gitBranch:null,customEnvironmentId:null})),pagination:{count:2,next:null,prev:null}});
    if(init.method==='POST')workerPosts++;return providerFetcher(url,init);};
  const workerRpc=[];const worker=await runWorker({client:{async rpc(name){workerRpc.push(name);
    if(name==='website_vercel_promotion_for_worker')return{data:null,error:null};if(name==='website_begin_vercel_promotion')return{data:1,error:null};
    if(name==='website_claim_vercel_promotion')return{data:{promotionVersion:2,issuePromotion:true,accessToken,accountId,productionBranch:'main'},error:null};
    if(name==='website_commit_vercel_promotion')return{data:{promotionVersion:3,connectionVersion:4},error:null};throw Error(name);}},...ids,
    previewConnectionVersion:5,productionConnectionVersion:3,previewAttemptVersion:2,vercelProjectId:projectId,deploymentId,
    sourceCommitSha,sourceBranch,accessToken,accountId,productionBranch:'main',isCurrent:async()=>true,fetcher:workerFetcher});
  assert.equal(worker.status,'ready');assert.equal(worker.connectionVersion,4);assert.equal(workerPosts,1);
  assert.deepEqual(workerRpc,['website_vercel_promotion_for_worker','website_begin_vercel_promotion','website_claim_vercel_promotion','website_commit_vercel_promotion']);
  const reconcileRpc=[];const reconciled=await runWorker({client:{async rpc(name){reconcileRpc.push(name);
    if(name==='website_vercel_promotion_for_worker')return{data:{version:2,operationId:ids.operationId,status:'claimed',deploymentId,sourceCommitSha,expectedAliases},error:null};
    if(name==='website_begin_vercel_promotion')return{data:2,error:null};if(name==='website_claim_vercel_promotion')return{data:{promotionVersion:2,issuePromotion:false,accessToken,accountId,productionBranch:'main'},error:null};
    if(name==='website_commit_vercel_promotion')return{data:{promotionVersion:3,connectionVersion:4},error:null};throw Error(name);}},...ids,
    previewConnectionVersion:5,productionConnectionVersion:3,previewAttemptVersion:2,vercelProjectId:projectId,deploymentId,
    sourceCommitSha,sourceBranch,accessToken,accountId,productionBranch:'main',isCurrent:async()=>true,fetcher:workerFetcher});
  assert.equal(reconciled.status,'ready');assert.equal(workerPosts,1);assert.deepEqual(reconcileRpc,workerRpc);
  const sql=await readFile('supabase/migrations/20260930040000_website_byo_vercel_promotion.sql','utf8');
  assert.match(sql,/status text not null check \(status in \('prepared','claimed','ready'\)\)/);assert.match(sql,/if v_row[.]status='prepared'/);assert.match(sql,/v_issue:=true/);
  assert.match(sql,/a[.]target='preview' and a[.]status='ready'/);assert.match(sql,/pvc[.]account_id=rvc[.]account_id/);assert.match(sql,/pvc[.]repository_id=rvc[.]repository_id/);
  assert.match(sql,/permissions=array\['deployment:promote'/);assert.doesNotMatch(sql,/access_token\s+text/i);
  assert.match(sql,/website_vercel_promotion_for_worker/);
  console.log('PASS Vercel promotion: domain-bound scope, single claimed effect, provider reconciliation, two-read alias proof and lost SQL response recovery (mocked HTTP/RPC/static SQL)');
}finally{await rm(dir,{recursive:true,force:true});}
