import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { createHmac, webcrypto } from 'node:crypto';
import { build } from 'esbuild';
globalThis.crypto ??= webcrypto;
const directory = await mkdtemp(join(tmpdir(), 'tayar-social-channel-'));
try {
  await build({entryPoints:[resolve('server/social-channels.ts')],bundle:true,platform:'node',format:'cjs',outfile:join(directory,'channels.cjs')});
  const {verifyAndNormalizeSocialWebhook:parse,verifySocialWebhookChallenge:challenge,sendSocialMessage:send,SOCIAL_CHANNELS} = createRequire(import.meta.url)(join(directory,'channels.cjs'));
  const secret='fixture_webhook_secret_32chars', credential='123456:fixture_token_abcdefghijklmnop';
  const binding={tenantId:'tenant-a',connectionId:'connection-a',channel:'telegram',accountId:'123456',ownership:'customer',status:'connected',permissionsVerified:true,webhookVerified:true,expiresAt:null};
  const event={update_id:7,message:{message_id:9,from:{id:42},chat:{id:42,type:'private'},text:'مرحبا',date:1_791_892_800}};
  const request=(body,channel='telegram',signatureSecret=secret)=>{
    const raw=typeof body==='string'?body:JSON.stringify(body);
    return new Request('https://tayar.example/webhook',{method:'POST',headers:{'content-type':'application/json',...(channel==='telegram'?{'x-telegram-bot-api-secret-token':signatureSecret}:{'x-hub-signature-256':`sha256=${createHmac('sha256',signatureSecret).update(raw).digest('hex')}`})},body:raw});
  };
  const parseInput=(body=event,overrides={})=>({enabled:true,request:request(body),binding,secret,...overrides});
  const normalized=await parse(parseInput());
  assert.equal(normalized[0].externalMessageId,'7:9'); assert.equal(normalized[0].tenantId,'tenant-a'); assert.equal(normalized[0].text,'مرحبا');
  for(const [field,type] of [['document','document'],['audio','audio'],['voice','audio'],['video','video'],['video_note','video'],['animation','video'],['sticker','sticker']]){
    const media={...event,message:{...event.message,text:undefined,[field]:{file_id:`opaque_${field}`}}};
    assert.deepEqual((await parse(parseInput(media)))[0].attachmentRefs,[{type,providerId:`opaque_${field}`}]);
  }
  const photo={...event,message:{...event.message,text:undefined,caption:'photo caption',photo:[{file_id:'small'},{file_id:'largest'}]}};
  assert.deepEqual((await parse(parseInput(photo)))[0].attachmentRefs,[{type:'image',providerId:'largest'}]);
  await assert.rejects(()=>parse(parseInput({...event,message:{...event.message,text:undefined,document:{file_id:'https://attacker.example/file'}}})));
  await assert.rejects(()=>parse(parseInput({...event,message:{...event.message,text:undefined,document:{file_id:'doc'},audio:{file_id:'audio'}}})));
  await assert.rejects(()=>parse(parseInput(event,{enabled:undefined})));
  await assert.rejects(()=>parse(parseInput(event,{request:request(event,'telegram','wrong_secret_1234567')})));
  await assert.rejects(()=>parse(parseInput('{broken')));
  await assert.rejects(()=>parse(parseInput(' '.repeat(262145))));
  await assert.rejects(()=>parse(parseInput({...event,message:{...event.message,from:{id:999}}})));
  assert.deepEqual(await parse(parseInput({...event,message:{...event.message,chat:{id:-42,type:'group'}}})),[]);
  const waBinding={...binding,channel:'whatsapp',accountId:'555'};
  const wa={object:'whatsapp_business_account',entry:[{id:'waba-id',changes:[{field:'messages',value:{metadata:{phone_number_id:'555'},messages:[{id:'wamid.ABC',from:'42',type:'text',text:{body:'hello'},timestamp:'1791892800'}]}}]}]};
  const waInput=(body=wa)=>({enabled:true,request:request(body,'whatsapp'),binding:waBinding,secret});
  assert.equal((await parse(waInput()))[0].externalMessageId,'wamid.ABC');
  for(const type of ['image','document','audio','video','sticker']){
    const media=structuredClone(wa),message=media.entry[0].changes[0].value.messages[0];
    message.type=type;delete message.text;message[type]={id:`media_${type}`,...(['image','document','video'].includes(type)?{caption:`${type} caption`}:{})};
    const result=(await parse(waInput(media)))[0];
    assert.ok(result,`missing WhatsApp ${type} event`);
    assert.deepEqual(result.attachmentRefs,[{type,providerId:`media_${type}`}]);
    assert.equal(result.text,['image','document','video'].includes(type)?`${type} caption`:'' );
  }
  const badMedia=structuredClone(wa),badMessage=badMedia.entry[0].changes[0].value.messages[0];
  badMessage.type='image';delete badMessage.text;badMessage.image={id:'https://attacker.example/file'};await assert.rejects(()=>parse(waInput(badMedia)));
  const tampered=waInput(); tampered.request=request(JSON.stringify(wa)+' ','whatsapp','different_secret_12345'); await assert.rejects(()=>parse(tampered));
  const missingId=structuredClone(wa); delete missingId.entry[0].changes[0].value.messages[0].id; await assert.rejects(()=>parse(waInput(missingId)));
  const wrongDestination=structuredClone(wa); wrongDestination.entry[0].changes[0].value.metadata.phone_number_id='777'; await assert.rejects(()=>parse(waInput(wrongDestination)));
  for(const channel of ['facebook','instagram']){
    const meta={object:channel==='facebook'?'page':'instagram',entry:[{id:'555',messaging:[{sender:{id:'42'},recipient:{id:'555'},timestamp:1791892800000,message:{mid:'mid.abc',text:'hello'}}]}]};
    assert.equal((await parse({enabled:true,request:request(meta,channel),binding:{...waBinding,channel},secret}))[0].senderId,'42');
    const media=structuredClone(meta),message=media.entry[0].messaging[0].message;delete message.text;
    message.attachments=[{type:'image',payload:{url:'https://provider.example/private'}},{type:'file',payload:{url:'http://127.0.0.1/private'}},{type:'unknown',payload:{url:'https://attacker.example'}}];
    const normalizedMedia=(await parse({enabled:true,request:request(media,channel),binding:{...waBinding,channel},secret}))[0];
    assert.deepEqual(normalizedMedia.attachmentRefs,[{type:'image'},{type:'document'}]);
    assert.ok(!JSON.stringify(normalizedMedia).includes('provider.example'));assert.ok(!JSON.stringify(normalizedMedia).includes('127.0.0.1'));
    meta.entry[0].messaging[0].message.is_echo=true; assert.deepEqual(await parse({enabled:true,request:request(meta,channel),binding:{...waBinding,channel},secret}),[]);
  }
  assert.equal(await challenge({enabled:true,mode:'subscribe',token:secret,expectedToken:secret,challenge:'123'}),'123');
  await assert.rejects(()=>challenge({enabled:true,mode:'subscribe',token:'wrong',expectedToken:secret,challenge:'123'}));
  const now=()=>new Date('2026-10-18T10:00:00Z');
  const calls=[];
  const input={enabled:true,binding,scope:{tenantId:'tenant-a',connectionId:'connection-a'},credential,now,policy:{consentVerified:true,recipientInitiated:true,lastInboundAt:'2026-10-18T09:00:00Z'},message:{recipientId:'42',text:'hello'},fetcher:async(url,options)=>{calls.push({url,options});return Response.json({ok:true,result:{message_id:10}})}};
  assert.deepEqual(await send(input),{status:'accepted',providerMessageId:'10'}); assert.equal(calls[0].options.redirect,'error');
  assert.equal(calls[0].url,`https://api.telegram.org/bot${credential}/sendMessage`); assert.equal(calls[0].options.signal.aborted,false);
  let blockedCalls=0;
  const blocked={...input,fetcher:async()=>{blockedCalls++;throw Error('must not send')}};
  for(const override of [{enabled:undefined},{scope:{tenantId:'tenant-b',connectionId:'connection-a'}},{binding:{...binding,status:'disconnected'}},{binding:{...binding,expiresAt:'2026-10-18T09:59:59Z'}},{binding:{...binding,expiresAt:undefined}},{policy:{consentVerified:false,recipientInitiated:true}},{message:{recipientId:'https://127.0.0.1',text:'hello'}},{credential:'123456:invalid/../../private'}]) assert.equal((await send({...blocked,...override})).status,'blocked');
  assert.equal(blockedCalls,0);
  let uncertainCalls=0;
  const uncertain=await send({...input,fetcher:async()=>{uncertainCalls++;throw Error(credential)}});
  assert.equal(uncertain.status,'review'); assert.equal(uncertainCalls,1); assert.ok(!JSON.stringify(uncertain).includes(credential));
  assert.equal((await send({...input,fetcher:async()=>new Response('bad',{status:503})})).status,'review');
  assert.equal((await send({...input,fetcher:async()=>new Response('bad',{status:429})})).status,'rejected');
  assert.equal((await send({...input,fetcher:async()=>new Response('bad',{status:302,headers:{location:'http://127.0.0.1'}})})).status,'review');
  assert.equal((await send({...input,fetcher:async()=>Response.json({ok:false,description:credential})})).status,'review');
  assert.equal((await send({...input,fetcher:async()=>Response.json({ok:true,result:{message_id:10,padding:'x'.repeat(70000)}})})).status,'review');
  for(const channel of ['whatsapp','facebook','instagram']){
    const metaInput={...input,binding:{...waBinding,channel},credential:'meta_fixture_access_token',graphVersion:'v23.0',fetcher:async(url,options)=>{calls.push({url,options});return Response.json(channel==='whatsapp'?{messages:[{id:'wamid.sent'}]}:{message_id:'mid.sent'})}};
    assert.equal((await send(metaInput)).status,'accepted'); assert.equal(new URL(calls.at(-1).url).hostname,'graph.facebook.com');
    assert.equal((await send({...metaInput,graphVersion:'v23.0/../../private'})).status,'blocked');
    assert.equal((await send({...metaInput,policy:{...input.policy,lastInboundAt:'2026-10-17T10:00:00Z'}})).status,'blocked');
    assert.equal((await send({...metaInput,policy:{...input.policy,lastInboundAt:'2026-10-19T10:00:00Z'}})).status,'blocked');
    if(channel==='whatsapp'){
      const template={name:'appointment_reminder',language:'en_US'};
      const outOfWindow={...metaInput,message:{recipientId:'42',template},policy:{consentVerified:true,recipientInitiated:false,approvedTemplate:{...template,approvalVerified:true}}};
      assert.equal((await send(outOfWindow)).status,'accepted');
      assert.equal((await send({...outOfWindow,policy:{...outOfWindow.policy,approvedTemplate:{...template,approvalVerified:false}}})).status,'blocked');
    }
  }
  assert.deepEqual(Object.keys(SOCIAL_CHANNELS).sort(),['facebook','instagram','telegram','whatsapp']);
  console.log('Social channel regression passed: four official mocked adapters, bounded attachment metadata, signatures, destination isolation, policy, fixed endpoints, secret-safe ambiguous delivery.');
} finally { await rm(directory,{recursive:true,force:true}); }
