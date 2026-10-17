import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { createApplicationReferenceProjects } from './fixtures/application-reference-projects.mjs';

const dir = await mkdtemp(join(tmpdir(), 'tayar-staging-worker-'));
try {
  const out = join(dir, 'worker.cjs');
  await build({ stdin: { contents: `export * from './server/website-production-staging-worker';
    export {captureWebsiteOwnedApplicationSource,captureWebsiteOwnedProductionSource} from './server/website-owned-source-capture';
    export {createWebsiteOwnedSourceReader} from './server/website-owned-source-reader';
    export {readOwnedReleaseIdentity} from './server/website-owned-release-identity';
    export {createSection} from './src/modules/website-builder/core/defaults';`, resolveDir: process.cwd(), loader: 'ts' },
    outfile: out, bundle: true, platform: 'node', format: 'cjs' });
  const { stageWebsiteProductionCandidate: stage, captureWebsiteOwnedApplicationSource: capture,
    captureWebsiteOwnedProductionSource: prepare, createWebsiteOwnedSourceReader: readerFor,
    readOwnedReleaseIdentity: identity, createSection } = createRequire(import.meta.url)(out);
  const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const [ownerId, projectId, pg, g, ps, s, pv, v, operationId, previewOperationId] = Array.from({ length: 10 }, (_, n) => uid(n + 1));
  const hero = createSection('hero'); hero.buttonUrl = '#hero';
  hero.elements = hero.elements.map(element => element.type === 'button' ? { ...element, href: '#hero' } : element);
  const initialSnapshot = { siteName: 'Reference clinic', homePageId: 'home',
    application: createApplicationReferenceProjects().find(item => item.domain === 'clinic').definition,
    pages: [{ id: 'home', name: 'Home', slug: 'home', sections: [hero] }] };
  const records = {}, bindings = {};
  for (const [environment, github, supabase, vercel, ref] of [
    ['preview', pg, ps, pv, 'abcdefghijklmnopqrst'], ['production', g, s, v, 'zyxwvutsrqponmlkjihg'],
  ]) {
    const common = { ownerId, projectId, environment, permissions: ['read'], status: 'connected', version: 1,
      operationId: null, verifiedAt: '2026-10-16T00:00:00Z', updatedAt: '2026-10-16T00:00:00Z' };
    records[github] = { ...common, id: github, provider: 'github', accountId: '77', targetId: '88', permissions: ['contents:write'] };
    records[supabase] = { ...common, id: supabase, provider: 'supabase', accountId: 'customer_org', targetId: ref, status: 'ready' };
    records[vercel] = { ...common, id: vercel, provider: 'vercel', accountId: 'team_customer1234', targetId: 'prj_customer1234' };
    bindings[environment] = { projectId, ownerId, environment, bindingVersion: 1, supabaseConnectionId: supabase,
      supabaseConnectionVersion: 1, vercelConnectionId: vercel, vercelConnectionVersion: 1, applicationOrigin: 'https://customer.example',
      backend: { projectRef: ref, url: `https://${ref}.supabase.co`, publishableKey: `sb_publishable_${environment}_fixture` } };
  }
  const targets = { githubPreview: { connectionId: pg, version: 1 }, githubProduction: { connectionId: g, version: 1 },
    vercelPreview: { connectionId: pv, version: 1 }, vercelProduction: { connectionId: v, version: 1 } };
  const custody = { accessToken: 'customer-vercel-token', userId: 'user_customer1234', accountId: 'team_customer1234',
    vercelProjectId: 'prj_customer1234', repositoryId: '88', repositoryOwner: 'customer', repositoryName: 'clinic',
    productionBranch: 'main', environment: 'production' };
  let snapshot = structuredClone(initialSnapshot), target;
  const rpcSource = async (name, args) => {
    assert.equal(args.p_project_id, projectId); assert.equal(args.p_owner_id, ownerId);
    if (name === 'website_byo_saved_project') return { data: { projectId, ownerId, snapshot: structuredClone(snapshot) }, error: null };
    if (name === 'website_byo_connection_for_worker') return { data: structuredClone(records[args.p_connection_id] ?? null), error: null };
    if (name === 'website_byo_runtime_binding_for_worker') return { data: structuredClone(bindings[args.p_environment]), error: null };
    throw Error(`Unexpected source RPC ${name}`);
  };
  const common = { projectId, ownerId, platformOrigin: 'https://platform.example',
    platformUrl: 'https://pnbllxdlskljcakyaylt.supabase.co', reader: readerFor({ rpc: rpcSource }), verifyRuntime: async () => true };
  const preview = await capture({ ...common, environment: 'preview', githubConnectionId: pg });
  const source = await prepare({ ...common, previewGithubConnectionId: pg, productionGithubConnectionId: g, expectedPreviewSourceDigest: preview.sourceDigest });
  const runtime = await identity(source.files);
  const candidate = { status: 'source-prepared', operationId, projectId, ownerId, previewOperationId, githubConnectionId: g,
    previewSourceDigest: preview.sourceDigest, snapshotDigest: source.snapshotDigest, runtimeDigest: runtime.runtimeDigest,
    sourceDigest: source.sourceDigest, headSha: 'c'.repeat(40) };
  const scope = { candidate, accountId: custody.accountId, projectId: custody.vercelProjectId, repositoryId: custody.repositoryId,
    sourceBranch: `tayar/${projectId}/production`, runtimeEnvironmentReceiptVersion: 2,
    runtimeEnvironmentIds: { SUPABASE_ANON_KEY: 'env_key1234', SUPABASE_URL: 'env_url1234' } };
  target = { scope, vercelConnectionId: v, vercelConnectionVersion: 1 };
  const project = { id: scope.projectId, name: 'customer-clinic', accountId: custody.accountId,
    link: { type: 'github', repoId: '88', org: 'customer', repo: 'clinic', productionBranch: 'main' } };
  const deployment = { id: 'dpl_clinic1234', projectId: scope.projectId, ownerId: custody.accountId, target: 'production',
    readyState: 'READY', url: 'clinic-staged.vercel.app', alias: [], aliasAssigned: false,
    meta: { githubCommitSha: candidate.headSha, githubCommitRef: scope.sourceBranch,
      tayarProductionOperationId: operationId, tayarSourceDigest: candidate.sourceDigest } };
  function fixture(options = {}) {
    let claimed = false, recordedId = null, attestation = null, posts = 0, identityProofs = 0, behaviorProofs = 0, claims = 0, attestations = 0;
    const client = { rpc: async (name, args) => {
      assert.equal(args.p_project_id, projectId); assert.equal(args.p_owner_id, ownerId);
      if (name === 'website_production_staging_target') return { data: structuredClone(options.target ?? target), error: null };
      if (name === 'website_byo_publish_targets') return { data: structuredClone(options.targets ?? targets), error: null };
      if (name === 'website_read_vercel_integration_custody') {
        assert.equal(args.p_connection_id, v); assert.equal(args.p_expected_connection_version, 1);
        return { data: { ...custody, ...options.custody }, error: null };
      }
      if (name === 'website_claim_production_staging') {
        claims++; assert.deepEqual(args.p_scope, scope); const issueCreate = !claimed; claimed = true;
        return { data: { issueCreate, deploymentId: recordedId }, error: null };
      }
      if (name === 'website_record_production_staging') {
        assert.deepEqual(args.p_scope, scope); recordedId = args.p_deployment_id;
        if (options.loseRecord) throw Error('private database response loss');
        return { data: recordedId, error: null };
      }
      if (name === 'website_record_production_runtime_attestation') {
        attestations++; assert.deepEqual(args.p_scope, scope); assert.equal(args.p_deployment_id, deployment.id);
        assert.equal(args.p_live_url, `https://${deployment.url}`); assert.equal(args.p_source_digest, candidate.sourceDigest);
        assert.equal(args.p_runtime_digest, candidate.runtimeDigest);
        attestation = { status: 'runtime-verified', operationId, deploymentId: deployment.id,
          liveUrl: `https://${deployment.url}`, sourceDigest: candidate.sourceDigest, runtimeDigest: candidate.runtimeDigest };
        if (options.loseAttestationRecord) throw Error('private attestation response loss');
        return { data: structuredClone(attestation), error: null };
      }
      if (name === 'website_read_production_runtime_attestation') return { data: structuredClone(attestation), error: null };
      return rpcSource(name, args);
    } };
    const fetcher = async (resource, init) => {
      const url = new URL(resource);
      if (url.origin === 'https://clinic-staged.vercel.app') {
        assert.equal(init.method, 'GET'); assert.equal(init.credentials, 'omit');
        assert.equal(new Headers(init.headers).has('authorization'), false);
        if (url.searchParams.get('tayarRoute') === 'release-behavior-proof') {
          behaviorProofs++;
          return Response.json({ ...runtime, behaviorVersion: 1, challenge: url.searchParams.get('challenge'),
            checks: ['auth-shell', 'anonymous-session-denial', 'unknown-route-denial'] },
          { headers: { 'cache-control': 'private, no-store' } });
        }
        identityProofs++;
        return Response.json({ ...runtime, runtimeDigest: options.wrongRuntime ? '0'.repeat(64) : runtime.runtimeDigest,
          challenge: url.searchParams.get('challenge') }, { headers: { 'cache-control': 'private, no-store' } });
      }
      assert.equal(url.origin, 'https://api.vercel.com');
      if (init.method === 'POST') {
        assert.equal(claimed, true); posts++; const body = JSON.parse(init.body);
        assert.equal(body.autoAssignCustomDomains, false); assert.equal(body.target, 'production');
        assert.equal(body.gitSource.sha, candidate.headSha); assert.equal(body.gitSource.ref, scope.sourceBranch);
        if (options.changeAfterPost) target = { ...target, vercelConnectionVersion: 2 };
        if (options.loseCreate) throw Error('private provider response loss');
        return Response.json(deployment, { status: 201 });
      }
      assert.equal(init.method, 'GET');
      if (url.pathname === '/v2/user') return Response.json({ user: { id: custody.userId } });
      if (url.pathname === `/v2/teams/${custody.accountId}`) return Response.json({ id: custody.accountId,
        membership: { uid: custody.userId, role: 'OWNER', confirmed: true } });
      if (url.pathname === `/v9/projects/${scope.projectId}`) return Response.json(project);
      if (url.pathname === `/v10/projects/${scope.projectId}/env`) return Response.json({ envs:
        Object.entries(scope.runtimeEnvironmentIds).map(([key, id]) => ({ key, id, target: ['production'] })) });
      if (url.pathname === '/v6/deployments') return Response.json({ deployments: [deployment] });
      assert.equal(url.pathname, `/v13/deployments/${deployment.id}`);
      return Response.json(options.building ? { ...deployment, readyState: 'BUILDING', url: undefined } : deployment);
    };
    return { input: { client, operationId, projectId, ownerId, platformOrigin: common.platformOrigin, platformUrl: common.platformUrl,
      platformVercelAccountId: 'team_platform1234', verifyRuntime: common.verifyRuntime, isCurrent: async () => true, fetcher },
      stats: () => ({ posts, identityProofs, behaviorProofs, claims, attestations }) };
  }
  for (const options of [{}, { loseCreate: true }, { loseRecord: true }, { loseAttestationRecord: true }]) {
    const good = fixture(options), result = await stage(good.input);
    assert.equal(result.status, 'runtime-verified'); assert.equal(result.sourceDigest, candidate.sourceDigest);
    assert.equal(result.runtimeDigest, candidate.runtimeDigest); assert.equal((await stage(good.input)).status, 'runtime-verified');
    assert.equal(good.stats().posts, 1); assert.equal(good.stats().identityProofs, 2); assert.equal(good.stats().behaviorProofs, 2);
    assert.equal(good.stats().attestations, 2);
    assert.doesNotMatch(JSON.stringify(result), /accessToken|publishable|environmentIds|custody/);
  }
  const building = fixture({ building: true }); assert.equal((await stage(building.input)).status, 'observing'); assert.equal(building.stats().identityProofs, 0);
  const wrongRuntime = fixture({ wrongRuntime: true }); await assert.rejects(stage(wrongRuntime.input), /staging unavailable/);
  assert.equal(wrongRuntime.stats().posts, 1); assert.equal(wrongRuntime.stats().identityProofs, 1); assert.equal(wrongRuntime.stats().behaviorProofs, 0);
  for (const changes of [
    { target: { ...target, scope: { ...scope, candidate: { ...candidate, ownerId: uid(99) } } } },
    { target: { ...target, scope: { ...scope, candidate: { ...candidate, runtimeDigest: '0'.repeat(64) } } } },
    { target: { ...target, scope: { ...scope, candidate: { ...candidate, sourceDigest: '0'.repeat(64) } } } },
    { target: { ...target, scope: { ...scope, candidate: { ...candidate, snapshotDigest: '0'.repeat(64) } } } },
    { target: { ...target, scope: { ...scope, runtimeEnvironmentIds: { SUPABASE_URL: 'env_url1234', PREVIEW_KEY: 'env_key1234' } } } },
    { targets: { ...targets, githubProduction: targets.githubPreview } },
    { custody: { environment: 'preview' } }, { custody: { accountId: 'team_foreign1234' } },
  ]) {
    const bad = fixture(changes); await assert.rejects(stage(bad.input), /staging unavailable/); assert.equal(bad.stats().posts, 0);
  }
  snapshot = { ...snapshot, siteName: 'Changed after source preparation' };
  const changedSnapshot = fixture(); await assert.rejects(stage(changedSnapshot.input), /staging unavailable/); assert.equal(changedSnapshot.stats().posts, 0);
  snapshot = structuredClone(initialSnapshot);
  const changed = fixture({ changeAfterPost: true }); await assert.rejects(stage(changed.input), /staging unavailable/);
  assert.equal(changed.stats().posts, 1); assert.equal(changed.stats().identityProofs, 0); assert.equal(changed.stats().behaviorProofs, 0);
  console.log('PASS staged Production coordinator: actual source compiler/reader/store/transport/runtime handshake, private target selection, exact source scope, response-loss retry and stale identity refusal (RPC/provider mocked)');
} finally { await rm(dir, { recursive: true, force: true }); }
