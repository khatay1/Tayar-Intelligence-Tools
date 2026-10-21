import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createApplicationReferenceProjects } from './fixtures/application-reference-projects.mjs';

const dir = await mkdtemp(join(tmpdir(), 'tayar-production-backend-proof-'));
try {
  globalThis.__tayarProductionBackendProof = { projects: [], security: [], runtimes: [], mode: 'ready' };
  const out = join(dir, 'proof.mjs');
  await build({ entryPoints: ['server/website-owned-production-backend-verification.ts'], bundle: true,
    platform: 'node', format: 'esm', outfile: out, plugins: [{ name: 'production-backend-proof-fixtures', setup(builder) {
      builder.onResolve({ filter: /website-owned-supabase-project$/ }, () => ({ path: 'project', namespace: 'fixture' }));
      builder.onLoad({ filter: /^project$/, namespace: 'fixture' }, () => ({ contents: `
        export async function verifyOwnedSupabaseProject(value){globalThis.__tayarProductionBackendProof.projects.push(value);return globalThis.__tayarProductionBackendProof.mode!=='project-fail'&&value.organizationId!==value.platformOrganizationId}
        export function createOwnedSupabaseLiveSecurityVerifier(value){return async definition=>{globalThis.__tayarProductionBackendProof.security.push({value,definition});return globalThis.__tayarProductionBackendProof.mode!=='security-fail'&&await value.isCurrent()}}
      ` }));
      builder.onResolve({ filter: /website-owned-supabase-verifier$/ }, () => ({ path: 'verifier', namespace: 'fixture' }));
      builder.onLoad({ filter: /^verifier$/, namespace: 'fixture' }, () => ({ contents: `
        export async function verifyOwnedSupabaseApplicationRuntime(value){globalThis.__tayarProductionBackendProof.runtimes.push(value);const definition=await value.reader.readDeployedDefinition();const revision=await value.reader.readFormRequestRevision();if(JSON.stringify(definition)!==JSON.stringify(value.definition)||revision!==1||!await value.reader.verifyLiveSecurity(value.definition))throw Error('invalid runtime')}
      ` }));
    } }] });
  const { verifyWebsiteOwnedProductionBackend: verify,
    verifyWebsiteOwnedProductionStripeDelivery: verifyStripeDelivery } = await import(`${pathToFileURL(out)}?v=${Date.now()}`);
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';
  const connectionId = '33333333-3333-4333-8333-333333333333';
  const projectRef = 'abcdefghijklmnopqrst';
  const publishableKey = 'sb_publishable_customer_fixture';
  const accessToken = 'customer-access-token-fixture';
  const definition = createApplicationReferenceProjects().find(item => item.domain === 'clinic').definition;
  const backend = { url: `https://${projectRef}.supabase.co`, projectRef, publishableKey };
  const custody = { version: 3, accountId: 'user_customer', organizationId: 'org_customer',
    organizationSlug: 'customer-org', projectRef, environment: 'production',
    accessExpiresAt: '2099-01-01T00:00:00.000Z', custodyExpiresAt: '2099-01-01T00:00:00.000Z',
    grant: { accessToken, refreshToken: 'customer-refresh-token-fixture' } };
  let current = true, rpcCalls = 0;
  const client = { rpc: async (name, args) => {
    rpcCalls++; assert.equal(name, 'website_read_supabase_oauth_custody');
    assert.deepEqual(args, { p_connection_id: connectionId, p_project_id: projectId,
      p_owner_id: ownerId, p_expected_connection_version: 3 });
    return { data: structuredClone(custody), error: null };
  } };
  const providerCalls = [];
  const fetcher = async (resource, init) => {
    const url = new URL(resource); providerCalls.push({ url: url.href, init });
    assert.equal(url.origin, 'https://api.supabase.com');
    assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${accessToken}`);
    if (url.pathname.endsWith('/api-keys')) {
      assert.equal(init.method, 'GET'); assert.equal(url.search, '?reveal=true');
      return Response.json([{ type: 'publishable', api_key: publishableKey }]);
    }
    assert.equal(url.pathname, `/v1/projects/${projectRef}/database/query/read-only`);
    assert.equal(init.method, 'POST');
    const { query } = JSON.parse(init.body);
    if (query.includes('app_schema_revisions')) return Response.json([{ definition }], { status: 201 });
    assert.match(query, /app_runtime_capabilities/);
    return Response.json([{ form_request_version: 1 }], { status: 201 });
  };
  const input = { client, projectId, ownerId, connectionId, connectionVersion: 3,
    platformSupabaseOrganizationId: 'platform_supabase', definition, backend,
    isCurrent: async () => current, fetcher };

  await verify(input);
  assert.equal(rpcCalls, 1); assert.equal(providerCalls.length, 3);
  assert.equal(globalThis.__tayarProductionBackendProof.projects.length, 1);
  assert.equal(globalThis.__tayarProductionBackendProof.security.length, 1);
  assert.equal(globalThis.__tayarProductionBackendProof.runtimes.length, 1);
  const ownership = globalThis.__tayarProductionBackendProof.projects[0];
  assert.equal(ownership.projectRef, projectRef); assert.equal(ownership.organizationId, custody.organizationId);
  assert.equal(ownership.accountUserId, custody.accountId); assert.equal(ownership.platformOrganizationId, 'platform_supabase');
  assert.equal(globalThis.__tayarProductionBackendProof.runtimes[0].formsRequired, definition.tables.length > 0);

  const runtimeDigest='a'.repeat(64);
  const deliveryFetcher=async(resource,init)=>{
    const url=new URL(resource);assert.equal(url.pathname,`/v1/projects/${projectRef}/database/query/read-only`);
    assert.equal(new Headers(init.headers).get('authorization'),`Bearer ${accessToken}`);
    const{query}=JSON.parse(init.body);assert.match(query,new RegExp(`runtime_digest='${runtimeDigest}'`));
    assert.match(query,new RegExp(`project_id='${projectId}'::uuid`));assert.match(query,/livemode=true/);
    return Response.json([{event_id:'evt_customer1234',event_type:'checkout.session.completed',
      received_at:'2026-10-21T12:00:00.000Z'}],{status:201});
  };
  await verifyStripeDelivery({client,projectId,ownerId,connectionId,connectionVersion:3,expectedProjectRef:projectRef,runtimeDigest,
    isCurrent:async()=>current,fetcher:deliveryFetcher});
  await assert.rejects(verifyStripeDelivery({client,projectId,ownerId,connectionId,connectionVersion:3,expectedProjectRef:projectRef,
    runtimeDigest:'0'.repeat(64),isCurrent:async()=>true,fetcher:async()=>Response.json([],{status:201})}),
  /Customer Production Stripe delivery verification is unavailable/);

  current = false; const staleCalls = rpcCalls;
  await assert.rejects(verify(input), /Customer Production backend verification is unavailable/);
  assert.equal(rpcCalls, staleCalls);
  current = true;
  globalThis.__tayarProductionBackendProof.mode = 'project-fail';
  await assert.rejects(verify(input), /Customer Production backend verification is unavailable/);
  globalThis.__tayarProductionBackendProof.mode = 'ready';
  const wrongEnvironment = { ...input, client: { rpc: async () => ({ data: { ...custody, environment: 'preview' }, error: null }) } };
  await assert.rejects(verify(wrongEnvironment), /Customer Production backend verification is unavailable/);
  const wrongBackend = { ...input, backend: { ...backend, publishableKey: 'sb_publishable_changed_fixture' } };
  await assert.rejects(verify(wrongBackend), /Customer Production backend verification is unavailable/);
  await assert.rejects(verify({ ...input, platformSupabaseOrganizationId: custody.organizationId }),
    /Customer Production backend verification is unavailable/);
  let sanitized = '';
  try { await verify({ ...input, client: { rpc: async () => { throw Error(accessToken); } } }); }
  catch (error) { sanitized = error instanceof Error ? error.message : String(error); }
  assert.equal(sanitized, 'Customer Production backend verification is unavailable.');
  console.log('PASS Production backend proof: exact OAuth custody, customer ownership, public key, read-only definition/revision and live security are revalidated fail-closed');
} finally {
  delete globalThis.__tayarProductionBackendProof;
  await rm(dir, { recursive: true, force: true });
}
