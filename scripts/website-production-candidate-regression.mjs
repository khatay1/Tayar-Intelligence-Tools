import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createApplicationReferenceProjects } from './fixtures/application-reference-projects.mjs';

const dir = await mkdtemp(join(tmpdir(), 'tayar-production-candidate-'));
try {
  const out = join(dir, 'candidate.cjs');
  await build({ stdin: { contents: `export {captureWebsiteOwnedApplicationSource as capture,captureWebsiteOwnedProductionSource as prepare} from './server/website-owned-source-capture';
    export {inspectOwnedVercelProductionCandidate as inspect,promoteAndVerifyOwnedVercelDeployment as promote} from './server/website-owned-vercel-promotion';
    export {runWebsiteOwnedVercelPromotion as promoteWorker} from './server/website-owned-vercel-promotion-worker';
    export {runWebsiteOwnedByoProductionPublish as publish} from './server/website-byo-publish-adapters';
    export {readOwnedReleaseIdentity as identity} from './server/website-owned-release-identity';
    export {createSection} from './src/modules/website-builder/core/defaults';`, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, platform: 'node', format: 'cjs', outfile: out });
  const { capture, prepare, inspect, promote, promoteWorker, publish, identity, createSection } = (await import(pathToFileURL(out))).default;
  const ids = Array.from({ length: 9 }, (_, n) => `${n + 1}`.repeat(8) + '-' + `${n + 1}`.repeat(4) + '-4' + `${n + 1}`.repeat(3) + '-8' + `${n + 1}`.repeat(3) + '-' + `${n + 1}`.repeat(12));
  const [ownerId, projectId, previewGithub, productionGithub, previewSupabase, productionSupabase, previewVercel, productionVercel, operationId] = ids;
  const fixture = createApplicationReferenceProjects().find(item => item.domain === 'clinic');
  const hero = createSection('hero'); hero.buttonUrl = '#hero';
  hero.elements = hero.elements.map(element => element.type === 'button' ? { ...element, href: '#hero' } : element);
  let snapshot = { siteName: 'Reference clinic', homePageId: 'home', application: fixture.definition,
    pages: [{ id: 'home', name: 'Home', slug: 'home', sections: [hero] }] };
  const backend = environment => ({ projectRef: environment === 'preview' ? 'abcdefghijklmnopqrst' : 'zyxwvutsrqponmlkjihg',
    url: `https://${environment === 'preview' ? 'abcdefghijklmnopqrst' : 'zyxwvutsrqponmlkjihg'}.supabase.co`, publishableKey: `sb_publishable_${environment}_fixture` });
  const records = {}, bindings = {};
  for (const [environment, githubId, supabaseId, vercelId] of [['preview', previewGithub, previewSupabase, previewVercel], ['production', productionGithub, productionSupabase, productionVercel]]) {
    const common = { ownerId, projectId, environment, permissions: ['read'], status: 'connected', version: 1,
      operationId: null, verifiedAt: '2026-10-16T00:00:00Z', updatedAt: '2026-10-16T00:00:00Z' };
    records[githubId] = { ...common, id: githubId, provider: 'github', accountId: '77', targetId: '88', permissions: ['contents:write'] };
    records[supabaseId] = { ...common, id: supabaseId, provider: 'supabase', accountId: 'customer_org', targetId: backend(environment).projectRef, status: 'ready' };
    records[vercelId] = { ...common, id: vercelId, provider: 'vercel', accountId: 'team_customer1234', targetId: 'prj_customer1234' };
    bindings[environment] = { projectId, ownerId, environment, bindingVersion: 1, supabaseConnectionId: supabaseId, supabaseConnectionVersion: 1,
      vercelConnectionId: vercelId, vercelConnectionVersion: 1, applicationOrigin: 'https://customer.example', backend: backend(environment) };
  }
  let productionReads = 0, alterProductionSnapshot = false;
  const reader = {
    async readSavedProject() { return { projectId, ownerId, snapshot: structuredClone(snapshot) }; },
    async readConnection(id, project, owner) { assert.equal(project, projectId); assert.equal(owner, ownerId); return records[id] ? structuredClone(records[id]) : null; },
    async readOwnedRuntimeBinding(project, owner, environment) {
      assert.deepEqual([project, owner], [projectId, ownerId]);
      if (environment === 'production') { productionReads++; if (alterProductionSnapshot) snapshot = { ...snapshot, siteName: 'Changed concurrently' }; }
      return structuredClone(bindings[environment]);
    },
  };
  const common = { projectId, ownerId, platformOrigin: 'https://platform.example', platformUrl: 'https://pnbllxdlskljcakyaylt.supabase.co',
    reader, verifyRuntime: async () => true };
  const preview = await capture({ ...common, environment: 'preview', githubConnectionId: previewGithub });
  const options = { ...common, previewGithubConnectionId: previewGithub, productionGithubConnectionId: productionGithub, expectedPreviewSourceDigest: preview.sourceDigest };
  const candidate = await prepare(options);
  assert.equal(candidate.snapshotDigest, preview.snapshotDigest);
  assert.notEqual(candidate.sourceDigest, preview.sourceDigest);
  assert.equal(candidate.previewSourceDigest, preview.sourceDigest);
  assert.equal((await identity(candidate.files)).environment, 'production');
  const runtime = candidate.files.find(file => file.path === 'api/application.js').content;
  assert.ok(runtime.includes(backend('production').url)); assert.ok(!runtime.includes(backend('preview').url));
  assert.ok(!runtime.includes(backend('preview').publishableKey));
  assert.equal(await candidate.isCurrent(), true);
  const beforeInvalid = productionReads;
  await assert.rejects(prepare({ ...options, expectedPreviewSourceDigest: '0'.repeat(64) }), /preparation is unavailable/);
  assert.equal(productionReads, beforeInvalid, 'Old Preview evidence cannot prepare new Production source');
  await assert.rejects(prepare({ ...options, productionGithubConnectionId: previewGithub }), /preparation is unavailable/);
  records[productionGithub].environment = 'preview';
  await assert.rejects(prepare(options), /preparation is unavailable/);
  records[productionGithub].environment = 'production';
  for (const change of ['database', 'repository', 'hosting']) {
    const original = structuredClone({ records, bindings });
    if (change === 'database') { bindings.production.backend = backend('preview'); records[productionSupabase].targetId = backend('preview').projectRef; }
    if (change === 'repository') records[productionGithub].targetId = '99';
    if (change === 'hosting') records[productionVercel].accountId = 'team_foreign1234';
    await assert.rejects(prepare(options), /preparation is unavailable/);
    Object.assign(records, original.records); Object.assign(bindings, original.bindings);
  }
  records[productionSupabase].version++;
  assert.equal(await candidate.isCurrent(), false, 'Production scope changes invalidate the prepared artifact');
  records[productionSupabase].version--;
  records[previewVercel].status = 'credentials-revoked';
  assert.equal(await candidate.isCurrent(), false, 'Preview revocation invalidates its Production handoff');
  records[previewVercel].status = 'connected';
  const originalSnapshot = structuredClone(snapshot); alterProductionSnapshot = true;
  await assert.rejects(prepare(options), /preparation is unavailable/);
  snapshot = originalSnapshot; alterProductionSnapshot = false;

  const exportOut = join(dir, 'production-export.cjs');
  await build({ entryPoints: ['server/website-byo-publish-adapters.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: exportOut,
    plugins: [{ name: 'existing-export-transport', setup(builder) {
      builder.onResolve({ filter: /websiteGithubExportWorker$/ }, () => ({ path: 'export', namespace: 'fixture' }));
      builder.onLoad({ filter: /^export$/, namespace: 'fixture' }, () => ({ contents: 'export async function exportWebsiteProjectToOwnedGitHub(input){return globalThis.__productionExportTransport(input);}' }));
    } }],
  });
  const { prepareWebsiteOwnedProductionSource: exportProduction } = (await import(pathToFileURL(exportOut))).default;
  let exports = 0;
  globalThis.__productionExportTransport = async request => {
    exports++; assert.equal(request.environment, 'production'); assert.equal(request.connectionId, productionGithub);
    assert.equal(request.expectedSourceDigest, candidate.sourceDigest);
    const files = await request.compile(); assert.deepEqual(files, candidate.files);
    return { status: 'exported', headSha: 'c'.repeat(40) };
  };
  let recorded = null;
  let targetScope = { githubPreview: { connectionId: previewGithub, version: 1 }, githubProduction: { connectionId: productionGithub, version: 1 },
    vercelPreview: { connectionId: previewVercel, version: 1 }, vercelProduction: { connectionId: productionVercel, version: 1 } };
  let targetReads = 0;
  const checkpointClient = { rpc: async (name, args) => {
    if (name === 'website_byo_publish_targets') { targetReads++; return { data: structuredClone(targetScope), error: null }; }
    if (name === 'website_read_production_source_candidate') return { data: recorded, error: null };
    assert.equal(name, 'website_record_production_source_candidate');
    assert.deepEqual(args.p_snapshot, snapshot);
    recorded = { status: 'source-prepared', previewSourceDigest: args.p_preview_source_digest, operationId, projectId, ownerId, previewOperationId: previewGithub,
      githubConnectionId: productionGithub, snapshotDigest: args.p_snapshot_digest, runtimeDigest: args.p_runtime_digest,
      sourceDigest: args.p_source_digest, headSha: args.p_head_sha };
    return { data: recorded, error: null };
  } };
  const privateOptions = { ...options }; delete privateOptions.previewGithubConnectionId; delete privateOptions.productionGithubConnectionId;
  const exportOptions = { ...privateOptions, client: checkpointClient, operationId, previewOperationId: previewGithub,
    githubClientId: 'Iv1_fixture', githubClientSecret: 'fixture-not-a-real-secret' };
  const exported = await exportProduction(exportOptions);
  assert.equal(exported.candidate.status, 'source-prepared');
  assert.equal(exported.status, 'exported'); assert.equal(exported.sourceBranch, `tayar/${projectId}/production`);
  assert.equal(exported.sourceDigest, candidate.sourceDigest); assert.equal(exported.snapshotDigest, preview.snapshotDigest);
  assert.match(exported.runtimeDigest, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(exported).includes(backend('production').publishableKey));
  await assert.rejects(exportProduction({ ...exportOptions, expectedPreviewSourceDigest: '0'.repeat(64) }), /export is unavailable/);
  assert.equal(exports, 1, 'Invalid Preview evidence cannot reach the existing GitHub export worker');
  await assert.rejects(exportProduction({ ...exportOptions, productionGithubConnectionId: productionGithub }), /export is unavailable/);
  assert.equal(exports, 1, 'The high-level source API refuses caller-supplied provider IDs');
  const originalTargets = structuredClone(targetScope);
  for (const change of [{ githubProduction: null }, { vercelProduction: null }, { githubProduction: { connectionId: productionGithub, version: 2 } }]) {
    targetScope = { ...originalTargets, ...change };
    await assert.rejects(exportProduction(exportOptions), /export is unavailable/);
    assert.equal(exports, 1, 'Missing or stale private Production targets cannot reach export');
  }
  targetScope = structuredClone(originalTargets);
  const clientWithStaleTargets = { rpc: async (name, args) => {
    if (name === 'website_byo_publish_targets' && ++targetReads > 2) return { data: { ...targetScope, githubProduction: null }, error: null };
    return checkpointClient.rpc(name, args);
  } };
  targetReads = 0;
  await assert.rejects(exportProduction({ ...exportOptions, client: clientWithStaleTargets }), /export is unavailable/);
  assert.equal(exports, 1, 'Projection changes before export invalidate source preparation');

  globalThis.__productionExportTransport = async request => {
    await request.compile(); snapshot = { ...snapshot, siteName: 'Changed after export' };
    return { status: 'exported', headSha: 'd'.repeat(40) };
  };
  const uncertain = await exportProduction(exportOptions);
  assert.equal(uncertain.status, 'recovery-required'); assert.equal(uncertain.headSha, 'd'.repeat(40));
  snapshot = originalSnapshot;
  globalThis.__productionExportTransport = async request => {
    await request.compile(); targetScope = { ...targetScope, githubProduction: null };
    return { status: 'exported', headSha: 'e'.repeat(40) };
  };
  const changedTargetsAfterExport = await exportProduction(exportOptions);
  assert.equal(changedTargetsAfterExport.status, 'recovery-required'); assert.equal(changedTargetsAfterExport.headSha, 'e'.repeat(40));
  targetScope = structuredClone(originalTargets);

  const provider = { accessToken: 'customer-vercel-token', accountId: 'team_customer1234', projectId: 'prj_customer1234',
    deploymentId: 'dpl_candidate1234', sourceCommitSha: 'a'.repeat(40), sourceBranch: `tayar/${projectId}/production`, isCurrent: async () => true };
  const deployment = { id: provider.deploymentId, projectId: provider.projectId, ownerId: provider.accountId, target: 'production', readyState: 'READY',
    url: 'candidate-production.vercel.app', meta: { githubCommitSha: provider.sourceCommitSha, githubCommitRef: provider.sourceBranch } };
  let providerWrites = 0;
  const fetcher = value => async (_url, init) => { if (init.method !== 'GET') providerWrites++; return Response.json(value); };
  assert.deepEqual(await inspect({ ...provider, fetcher: fetcher(deployment) }), {
    deploymentId: provider.deploymentId, sourceCommitSha: provider.sourceCommitSha, liveUrl: `https://${deployment.url}`,
  });
  for (const change of [{ target: null }, { target: 'preview' }, { target: undefined }, { readyState: 'BUILDING' },
    { ownerId: 'team_foreign1234' }, { projectId: 'prj_foreign1234' }, { url: '127.0.0.1' },
    { url: 'candidate-production.vercel.app/escape' }, { meta: { ...deployment.meta, githubCommitSha: 'b'.repeat(40) } }]) {
    await assert.rejects(inspect({ ...provider, fetcher: fetcher({ ...deployment, ...change }) }), /Production publishing requires/);
  }
  await assert.rejects(inspect({ ...provider, sourceBranch: `tayar/${projectId}/preview`, fetcher: async () => { throw Error('must not fetch Preview source'); } }), /Production publishing requires/);
  let reads = 0;
  await assert.rejects(inspect({ ...provider, fetcher: async () => Response.json({ ...deployment, url: ++reads === 1 ? deployment.url : 'changed.vercel.app' }) }), /Production publishing requires/);
  await assert.rejects(inspect({ ...provider, isCurrent: async () => false, fetcher: async () => { throw Error('must not fetch'); } }), /Production publishing requires/);
  await assert.rejects(promote({ ...provider, expectedAliases: ['customer.example'], issuePromotion: true, fetcher: fetcher({ ...deployment, target: null }) }), /unavailable/);
  let rpcs = 0;
  await assert.rejects(promoteWorker({ ...provider, projectId, vercelProjectId: provider.projectId, ownerId, operationId,
    previewConnectionId: previewVercel, productionConnectionId: productionVercel, previewConnectionVersion: 1, productionConnectionVersion: 1,
    previewAttemptVersion: 2, productionBranch: 'main', runtimeEnvironmentReceiptVersion: 2, runtimeEnvironmentIds: {},
    client: { rpc: async () => { rpcs++; throw Error('unexpected write'); } }, fetcher: fetcher({ ...deployment, target: null }) }), /unavailable/);
  assert.equal(rpcs, 0); assert.equal(providerWrites, 0, 'Preview refusal happens before a promotion claim or provider write');
  const rpcNames = [];
  const checkpoint = { operationId: ids[2], projectId, ownerId, environment: 'preview', stage: 'ready', version: 2,
    sourceDigest: preview.sourceDigest, requiredEnvironment: [], headSha: provider.sourceCommitSha, attemptVersion: 2,
    deploymentId: provider.deploymentId, liveUrl: 'https://preview.vercel.app', previewOperationId: null, promotionVersion: null, productionAliases: [] };
  const client = { rpc: async (name) => {
    rpcNames.push(name);
    if (name === 'website_read_vercel_integration_custody') return { data: { ...provider, environment: 'production', userId: 'user_customer1234',
      vercelProjectId: provider.projectId, repositoryId: '88', repositoryOwner: 'customer', repositoryName: 'app', productionBranch: 'main' }, error: null };
    if (name === 'website_read_byo_publish_operation') return { data: checkpoint, error: null };
    throw Error('No operation initialization, environment preparation or promotion is authorized by Preview');
  } };
  await assert.rejects(publish({ client, reader, projectId, ownerId, operationId, previewOperationId: checkpoint.operationId,
    previewVercelConnectionId: previewVercel, productionVercelConnectionId: productionVercel,
    previewConnectionVersion: 1, productionConnectionVersion: 1, ownerCurrent: async () => true,
    fetcher: fetcher({ ...deployment, target: null }) }), /Production publishing requires/);
  assert.deepEqual(rpcNames, ['website_read_vercel_integration_custody', 'website_read_byo_publish_operation']);
  assert.equal(providerWrites, 0);
  console.log('PASS Production candidate: existing clinic source, same immutable specification, isolated database/configuration, stale/environment/repository refusal and Preview denial before SQL/provider writes (provider/registry transport mocked)');
} finally { delete globalThis.__productionExportTransport; await rm(dir, { recursive: true, force: true }); }
