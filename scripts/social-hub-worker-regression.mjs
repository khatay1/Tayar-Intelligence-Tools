import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';
globalThis.crypto ??= webcrypto;
const directory=await mkdtemp(join(tmpdir(),'tayar-social-worker-'));
try{
 await build({entryPoints:[resolve('server/social-hub-worker.ts')],bundle:true,platform:'node',format:'cjs',outfile:join(directory,'worker.cjs')});
 const {createSocialHubWebhookHandler:handler,dispatchSocialHubOutgoing:dispatch}=createRequire(import.meta.url)(join(directory,'worker.cjs'));
 const secret='fixture_webhook_secret_32chars',credential='123456:fixture_token_abcdefghijklmnop',opaque='a'.repeat(32),now=()=>new Date('2026-10-18T10:00:00Z');
 const binding={tenantId:'tenant-a',connectionId:'connection-a',channel:'telegram',accountId:'123456',ownership:'customer',status:'connected',permissionsVerified:true,webhookVerified:true,expiresAt:null};
 const event={update_id:1,message:{message_id:2,from:{id:42},chat:{id:42,type:'private'},text:'Where is my order?',date:1792314000}};
 let enabled=true,stored=[],failIngest=false,status='pending',reserved=false,finished=[],providerCalls=0,blockedReservation=false;
 const vault={async resolve(input){assert.equal(input.tenantId,'tenant-a');assert.equal(input.connectionId,'connection-a');assert.equal(input.secretRef,input.purpose==='webhook'?'webhook-ref':'send-ref');return input.purpose==='webhook'?secret:credential}};
 const policy={consentVerified:true,recipientInitiated:true,lastInboundAt:'2026-10-18T09:00:00Z'};
 const lease={jobId:'job-a',leaseId:'lease-a',leaseExpiresAt:'2026-10-18T10:01:00Z',tenantId:'tenant-a',connectionId:'connection-a',accountId:'123456',recipientId:'42',text:'Your order is being prepared.'};
 const store={
  async resolveWebhook(id){assert.equal(id,opaque);return {binding,secretRef:'webhook-ref'}},
  async ingest(message){if(failIngest)throw Error(secret);assert.equal(message.tenantId,'tenant-a');const duplicate=stored.some(row=>row.externalMessageId===message.externalMessageId);if(!duplicate)stored.push(structuredClone(message));return duplicate?'duplicate':'applied'},
  async claim(scope,jobId){if(scope.tenantId!==lease.tenantId||scope.connectionId!==lease.connectionId||jobId!==lease.jobId||status!=='pending')return null;status='sending';return {...lease}},
  async resolveOutgoing(){return {binding,secretRef:'send-ref',policy}},
  async reserveDispatch(){if(blockedReservation||reserved||!enabled)return false;reserved=true;return true},
  async finish(claim,outcome){assert.equal(claim.leaseId,'lease-a');finished.push(outcome);status=outcome.status;return true}
 };
 const request=(overrides={})=>new Request('https://tayar.example/webhook?tenantId=tenant-b',{method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':secret,...overrides},body:JSON.stringify({...event,tenantId:'tenant-b'})});
 const receive=handler({enabled:()=>enabled,store,vault});
 assert.equal((await receive(request(),opaque)).status,200);assert.equal(stored.length,1);assert.equal(stored[0].tenantId,'tenant-a');
 assert.equal((await receive(request(),opaque)).status,200);assert.equal(stored.length,1);
 assert.equal((await receive(request({'x-telegram-bot-api-secret-token':'wrong_secret_abcdefghijkl'}),opaque)).status,401);assert.equal(stored.length,1);
 failIngest=true;assert.equal((await receive(request(),opaque)).status,503);failIngest=false;
 enabled=false;assert.equal((await receive(request(),opaque)).status,404);enabled=true;
 assert.equal((await receive(request(),'tenant-a')).status,400);
 const base={enabled:()=>enabled,scope:{tenantId:'tenant-a',connectionId:'connection-a'},jobId:'job-a',store,vault,now,fetcher:async(url,options)=>{providerCalls++;assert.equal(new URL(url).hostname,'api.telegram.org');assert.equal(options.redirect,'error');return Response.json({ok:true,result:{message_id:7}})}};
 assert.equal((await dispatch({...base,scope:{tenantId:'tenant-b',connectionId:'connection-a'}})).status,'idle');assert.equal(providerCalls,0);
 assert.deepEqual(await dispatch(base),{status:'accepted',providerMessageId:'7'});assert.equal(providerCalls,1);assert.equal(status,'accepted');
 assert.equal((await dispatch(base)).status,'idle');assert.equal(providerCalls,1);
 const reset=()=>{status='pending';reserved=false;finished=[]};
 reset();blockedReservation=true;assert.equal((await dispatch(base)).status,'blocked');assert.equal(providerCalls,1);blockedReservation=false;
 reset();const uncertain=await dispatch({...base,fetcher:async()=>{providerCalls++;throw Error(credential)}});assert.equal(uncertain.status,'review');assert.equal(status,'review');
 assert.equal((await dispatch(base)).status,'idle');assert.ok(!JSON.stringify(uncertain).includes(credential));
 reset();lease.leaseExpiresAt='not-a-date';assert.equal((await dispatch(base)).status,'blocked');lease.leaseExpiresAt='2026-10-18T10:01:00Z';
 reset();binding.expiresAt='2026-10-18T09:59:59Z';assert.equal((await dispatch(base)).status,'blocked');binding.expiresAt=null;
 reset();policy.consentVerified=false;assert.equal((await dispatch(base)).status,'blocked');policy.consentVerified=true;
 reset();const badStore={...store,async claim(){return {...lease,tenantId:'tenant-b'}},async finish(){assert.fail('Cross-tenant lease must not be mutated')}};assert.equal((await dispatch({...base,store:badStore})).reason,'lease-scope-mismatch');
 reset();const settleLost={...store,async finish(){throw Error(secret)}};assert.equal((await dispatch({...base,store:settleLost})).reason,'settlement-unconfirmed');
 assert.equal(reserved,true);assert.equal((await dispatch(base)).status,'idle');
 console.log('Social Hub worker regression passed: signed inbound through dedup store and leased outbound through official mocked transport, tenant isolation, policy, disabled flag, rate reservation, uncertain delivery and failed settlement.');
}finally{await rm(directory,{recursive:true,force:true})}
