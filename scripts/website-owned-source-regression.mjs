import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-owned-source-'));
const oldFetch = globalThis.fetch, oldVercelEnv=process.env.VERCEL_ENV, oldStripeKey=process.env.STRIPE_SECRET_KEY;
try {
  const outfile = join(dir, 'compiler.cjs');
  const compilerBuild = await build({ entryPoints: ['server/website-owned-source-compiler.ts'], bundle: true,
    metafile: true, platform: 'node', format: 'cjs', outfile });
  assert(!Object.keys(compilerBuild.metafile.inputs).some(path => /node_modules\/esbuild|website-owned-source-compiler\.ts.*esbuild/.test(path)),
    'Owned source compilation must not require esbuild at request time');
  const { compileWebsiteOwnedApplicationSource: compile } = (await import(pathToFileURL(outfile))).default;
  const defaultsFile = join(dir, 'defaults.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/defaults.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile: defaultsFile });
  const { createSection } = (await import(pathToFileURL(defaultsFile))).default;
  const section = createSection('hero'); section.title = 'Owner App';
  const id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan',
    publishableKey: 'sb_publishable_customer_fixture' };
  const config = { projectId: id, applicationOrigin: 'https://customer-app.example', expectedProjectRef: backend.projectRef,
    backend, environment: 'production', platformOrigin: 'https://tayar.example',
    platformUrl: 'https://pnbllxdlskljcakyaylt.supabase.co' };
  const snapshot = { homePageId: 'home', siteName: 'Owner App', application: { version: 1, tables: [], roles: [],
    auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true },
    pageAccess: [{ pageId: 'dashboard', access: 'authenticated' }] },
    pages: [{ id: 'home', name: 'Home', slug: 'home', language: 'en', sections: [section] },
      { id: 'dashboard', name: 'Dashboard', slug: 'dashboard', language: 'en', sections: [section] }],
    supabaseUrl: config.platformUrl, supabaseAnonKey: 'PLATFORM_KEY_NEVER_EXPORT' };
  const before = JSON.stringify(snapshot);
  const files = await compile(snapshot, config);
  assert.equal(JSON.stringify(snapshot), before);
  assert.deepEqual(files.map(file => file.path), ['package.json', 'vercel.json', 'api/application.js']);
  assert.deepEqual(await compile(snapshot, config), files);
  assert(files.every(file => !file.path.startsWith('public/')));
  assert(files.every(file => !file.content.includes(config.platformUrl) && !file.content.includes(config.platformOrigin)
    && !file.content.includes('PLATFORM_KEY_NEVER_EXPORT')));
  const vercel = JSON.parse(files[1].content);
  assert.deepEqual(vercel.rewrites.map(item => item.source),
    ['/api/application-session', '/index.html', '/dashboard.html', '/']);
  const runtimeFile = join(dir, 'runtime.cjs');
  await writeFile(runtimeFile, files[2].content);
  const handler = (await import(pathToFileURL(runtimeFile))).default;
  const origin = config.applicationOrigin;
  const request = (route, headers = {}) => new Request(`${origin}/api/application?tayarRoute=${route}`, { headers });
  let verified = 0;
  globalThis.fetch = async resource => {
    assert.equal(String(resource), `${backend.url}/auth/v1/user`);
    verified++;
    return Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', is_anonymous: false,
      email_confirmed_at: '2026-09-29T00:00:00Z' });
  };
  assert.equal((await handler(request('dashboard'))).status, 401);
  assert.equal((await handler(request('dashboard', { accept: 'text/html' }))).status, 401);
  const shell = await handler(request('dashboard', { accept: 'text/html' }));
  assert((await shell.text()).includes('application-auth-config'));
  const token = 'header.payload.signature';
  const privatePage = await handler(request('dashboard', { authorization: `Bearer ${token}`, accept: 'text/html' }));
  assert.equal(privatePage.status, 200);
  assert((await privatePage.text()).includes('data-tayar-application-runtime'));
  assert.equal(verified, 1);
  assert.equal((await handler(request('unknown'))).status, 404);
  assert.equal((await handler(new Request('https://wrong.example/api/application?tayarRoute=dashboard'))).status, 403);
  assert.equal(verified, 1, 'Denied requests cannot call upstream Auth without credentials');

  const stripeSnapshot=structuredClone(snapshot);
  const checkout=stripeSnapshot.pages[0].sections[0].elements.find(element=>element.type==='button');
  assert.ok(checkout);checkout.action='stripe-checkout';checkout.stripePreviewPriceId='price_preview12345678';
  checkout.stripeProductionPriceId='price_production12345678';
  stripeSnapshot.integrationsMax={version:1,connections:[{id:'stripe-prod',providerId:'stripe',name:'Stripe',enabled:true,
    status:'configured',environments:['production'],config:{publishableKey:'pk_live_fixture123456789'},
    secrets:{secretKey:{ref:`secret://website/${id}/stripe-prod/secretKey/production`,updatedAt:'2026-10-04T10:00:00.000Z'}},
    events:[],createdAt:'2026-10-04T10:00:00.000Z',updatedAt:'2026-10-04T10:00:00.000Z'}]};
  const stripeFiles=await compile(stripeSnapshot,config);
  const stripeVercel=JSON.parse(stripeFiles[1].content);
  assert.deepEqual(stripeVercel.rewrites.map(item=>item.source),
    ['/api/application-session','/api/stripe-checkout','/index.html','/dashboard.html','/']);
  assert.ok(stripeFiles[2].content.includes('price_preview12345678')&&stripeFiles[2].content.includes('price_production12345678'));
  assert.ok(!stripeFiles[2].content.includes('secret://website/'),'Secret references must not enter customer source');
  const stripeRuntimeFile=join(dir,'stripe-runtime.cjs');await writeFile(stripeRuntimeFile,stripeFiles[2].content);
  const stripeHandler=(await import(pathToFileURL(stripeRuntimeFile))).default;
  const checkoutRequest=()=>new Request(`${origin}/api/application?tayarRoute=stripe-checkout`,{method:'POST',
    headers:{origin,referer:`${origin}/`,'sec-fetch-site':'same-origin','content-type':'application/json'},
    body:JSON.stringify({checkoutId:checkout.id})});
  const liveSecret=['sk','live','fixturecheckout123456789'].join('_');
  const testSecret=['sk','test','fixturecheckout123456789'].join('_');
  process.env.VERCEL_ENV='production';process.env.STRIPE_SECRET_KEY=liveSecret;
  globalThis.fetch=async(resource,init)=>{
    assert.equal(String(resource),'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(init.headers.Authorization,`Bearer ${liveSecret}`);
    const body=new URLSearchParams(init.body);assert.equal(body.get('line_items[0][price]'),'price_production12345678');
    assert.equal(body.get('success_url'),`${origin}/?checkout=success`);assert.equal(body.get('cancel_url'),`${origin}/?checkout=cancel`);
    return Response.json({id:'cs_live_fixturecheckout123456',object:'checkout.session',livemode:true,
      url:'https://checkout.stripe.com/c/pay/fixture-live'});
  };
  let checkoutResponse=await stripeHandler(checkoutRequest());assert.equal(checkoutResponse.status,200);
  assert.deepEqual(await checkoutResponse.json(),{url:'https://checkout.stripe.com/c/pay/fixture-live'});
  process.env.VERCEL_ENV='preview';process.env.STRIPE_SECRET_KEY=testSecret;
  globalThis.fetch=async(_resource,init)=>{
    const body=new URLSearchParams(init.body);assert.equal(body.get('line_items[0][price]'),'price_preview12345678');
    return Response.json({id:'cs_test_fixturecheckout123456',object:'checkout.session',livemode:false,
      url:'https://checkout.stripe.com/c/pay/fixture-test'});
  };
  checkoutResponse=await stripeHandler(checkoutRequest());assert.equal(checkoutResponse.status,200);
  assert.equal((await checkoutResponse.json()).url,'https://checkout.stripe.com/c/pay/fixture-test');
  assert.equal((await stripeHandler(new Request(`${origin}/api/application?tayarRoute=stripe-checkout`,{method:'POST',
    headers:{origin:'https://evil.example',referer:`${origin}/`,'content-type':'application/json'},body:JSON.stringify({checkoutId:checkout.id})}))).status,403);

  const badPrice=structuredClone(stripeSnapshot);badPrice.pages[0].sections[0].elements.find(element=>element.id===checkout.id).stripeProductionPriceId='amount-from-browser';
  await assert.rejects(compile(badPrice,config),/unhandled capabilities/);
  const stripeEvents=structuredClone(stripeSnapshot);stripeEvents.integrationsMax.connections[0].events=['commerce.checkout'];
  await assert.rejects(compile(stripeEvents,config),/unhandled capabilities/);
  const unsupported=structuredClone(snapshot);unsupported.integrationsMax={version:1,connections:[{id:'hook',providerId:'webhook',
    name:'Hook',enabled:true,status:'configured',environments:['production'],config:{url:'https://example.com/hook'},
    secrets:{signingSecret:{ref:`secret://website/${id}/hook/signingSecret/production`}},events:[],
    createdAt:'2026-10-04T10:00:00.000Z',updatedAt:'2026-10-04T10:00:00.000Z'}]};
  await assert.rejects(compile(unsupported,config),/unhandled capabilities/);

  for (const mutation of [
    { ...snapshot, cms: { collections: [{ id: 'news' }] } },
    { ...snapshot, pages: [{ ...snapshot.pages[0], sections: [{ ...section, type: 'contact' }] }] },
  ]) await assert.rejects(compile(mutation, config));
  const restrictedLeak = structuredClone(snapshot);
  restrictedLeak.pages[0].sections[0].title = ['rk','live','restrictedcustomerkey123456'].join('_');
  await assert.rejects(compile(restrictedLeak, config), /unsupported source/);
  await assert.rejects(compile(snapshot, { ...config, expectedProjectRef: 'aaaaaaaaaaaaaaaaaaaa' }));
  console.log('PASS owned source: deterministic private runtime, exact Auth routes, server-only Stripe checkout price allowlist and no platform/secret material');
} finally {
  globalThis.fetch = oldFetch;
  if(oldVercelEnv===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=oldVercelEnv;
  if(oldStripeKey===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=oldStripeKey;
  await rm(dir, { recursive: true, force: true });
}
