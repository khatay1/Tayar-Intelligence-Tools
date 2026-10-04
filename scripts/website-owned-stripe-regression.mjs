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
  const {verifyOwnedStripeAccount:verify}=(await import(pathToFileURL(out))).default;
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
  console.log('PASS owned Stripe verifier: exact mode, account proof, production charge readiness, bounded fail-closed request and no key leakage');
}finally{await rm(dir,{recursive:true,force:true});}
