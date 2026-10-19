import assert from 'node:assert/strict';
import {mkdtemp,rm}from 'node:fs/promises';
import {tmpdir}from 'node:os';
import {join}from 'node:path';
import {pathToFileURL}from 'node:url';
import {build}from 'esbuild';
const dir=await mkdtemp(join(tmpdir(),'tayar-social-automation-'));
try{
 await build({entryPoints:['server/social-automation-worker.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'worker.mjs')});
 const {createSocialAutomationWorker}=await import(pathToFileURL(join(dir,'worker.mjs')));
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const event={id:id(1),claimToken:id(2),scopeId:id(3),messageId:id(4),text:'opening hours',humanAssigned:false,
  rules:[{id:id(5),scopeId:id(3),enabled:true,trigger:'message.received',contains:'',action:'reply',approvedAnswerId:id(6)}],
  knowledge:[{id:id(6),scopeId:id(3),question:'opening hours',answer:'We open at 9.',language:'en',approved:true,sensitive:false}]};
 let claims=0,decisions=[],enabled=true;
 const client={async rpc(name,args){if(name==='claim_social_hub_automation'){claims++;return {data:claims===1?event:null,error:null};}
  assert.equal(name,'complete_social_hub_automation');assert.equal(args.p_event_id,event.id);assert.equal(args.p_claim_token,event.claimToken);decisions=args.p_decisions;return {data:true,error:null};}};
 const worker=createSocialAutomationWorker(client,()=>enabled);
 assert.deepEqual(await worker(),{processed:1});assert.deepEqual(decisions,[{ruleId:id(5),action:'reply'}]);
 claims=0;event.humanAssigned=true;await worker();assert.deepEqual(decisions,[]);event.humanAssigned=false;
 claims=0;event.text='refund payment';await worker();assert.deepEqual(decisions,[]);event.text='opening hours';
 claims=0;event.rules.push({...event.rules[0],id:id(7),action:'handoff',approvedAnswerId:null});await worker();assert.deepEqual(decisions,[{ruleId:id(7),action:'handoff'}]);event.rules.pop();
 claims=0;event.knowledge[0].scopeId=id(99);await assert.rejects(worker,/unavailable/);event.knowledge[0].scopeId=id(3);
 claims=0;enabled=false;assert.deepEqual(await worker(),{processed:0});assert.equal(claims,0);
 enabled=true;const always={async rpc(name){return {data:name==='claim_social_hub_automation'?event:true,error:null};}};assert.deepEqual(await createSocialAutomationWorker(always,()=>true)(),{processed:3});
 console.log('PASS local Social automation worker: approved exact answers, human priority, sensitive/cross-tenant rejection, single completion and bounded opt-in processing');
}finally{await rm(dir,{recursive:true,force:true});}
