import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Readable } from 'node:stream';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-custom-operation-runtime-'));
const ownerId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const releaseId = '33333333-3333-4333-8333-333333333333';
const reservationId = '123e4567-e89b-42d3-a456-426614174000';
const backend = { url: 'https://abcdefghijklmnopqrst.supabase.co', projectRef: 'abcdefghijklmnopqrst', publishableKey: 'sb_publishable_fixture' };

try {
  const outfile = join(dir, 'custom-operation-runtime.cjs');
  await build({ entryPoints: ['server/website-application-custom-operation-runtime.ts'], bundle: true, platform: 'node', format: 'cjs', outfile,
    alias: { '@': resolve('src') } });
  const { servePublishedCustomOperationRuntime } = (await import(pathToFileURL(outfile))).default;
  const policyOutfile = join(dir, 'custom-operation-policy.cjs');
  await build({ entryPoints: ['server/website-custom-execution-policy.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: policyOutfile });
  const { isWebsiteCustomExecutionEnabled } = (await import(pathToFileURL(policyOutfile))).default;
  const activeFlags = { WEBSITE_APPLICATION_RUNTIME_ENABLED: 'true', WEBSITE_CUSTOM_EXECUTION_ENABLED: 'true' };
  assert.equal(isWebsiteCustomExecutionEnabled({}), false, 'custom execution stays disabled by default');
  assert.equal(isWebsiteCustomExecutionEnabled({ ...activeFlags, VERCEL_ENV: 'preview' }), true,
    'the existing explicit flags permit controlled Preview execution');
  assert.equal(isWebsiteCustomExecutionEnabled({ ...activeFlags, VERCEL_ENV: 'production' }), false,
    'Production requires its separate final activation switch');
  assert.equal(isWebsiteCustomExecutionEnabled({ ...activeFlags, VERCEL_ENV: 'production', WEBSITE_CUSTOM_EXECUTION_PRODUCTION_ENABLED: 'false' }), false);
  assert.equal(isWebsiteCustomExecutionEnabled({ ...activeFlags, VERCEL_ENV: 'production', WEBSITE_CUSTOM_EXECUTION_PRODUCTION_ENABLED: 'true' }), true);
  const operationSource = 'return { accepted: input.value === 41, result: input.value + 1 };';
  const specification = {
    version: 1, intent: 'Exercise one isolated custom operation.',
    actors: [{ id: 'staff', name: 'Staff' }], entities: [],
    requirements: [{ id: 'req_1', origin: 'explicit', acceptanceCriteria: ['An authenticated user can run the operation.'] }],
    operations: [{ id: 'op_1', summary: 'Run the isolated operation.', actorIds: ['staff'], entityIds: [], requirementIds: ['req_1'],
      dependsOn: [], execution: 'custom', transactional: false, source: operationSource }],
    rules: [], tenancy: { mode: 'single' }, integrations: [], privacy: [], decisions: [],
  };
  const release = {
    id: releaseId, project_id: projectId, user_id: ownerId, storage_bucket: 'website-application-releases',
    storage_prefix: `${ownerId}/${projectId}/versions/${releaseId}`,
    snapshot: { application: { version: 1, tables: [], roles: [], auth: { enabled: true, signUpEnabled: false, emailVerificationRequired: true },
      pageAccess: [], requirements: { version: 1, request: 'Create a secure application.',
        items: [{ id: 'req_1', summary: 'Authenticate application users.', capability: 'auth', evidence: ['auth'] }], specification } },
      homePageId: 'home', pages: [{ id: 'home', slug: 'index' }] },
    backend,
    file_manifest: [{ name: 'index.html', pageId: 'home', contentType: 'text/html; charset=utf-8' }],
  };
  const calls = [];
  let customerAuthAllowed = false;
  const platform = {
    async rpc(name, args) {
      calls.push(['rpc', name, args]);
      if (name === 'website_application_published_release') return { data: { enabled: true, release }, error: null };
      if (name === 'team_effective_plan') return { data: 'pro', error: null };
      if (name === 'reserve_ai_tool_usage') return { data: reservationId, error: null };
      if (name === 'complete_ai_tool_usage') return { data: null, error: null };
      throw new Error(`Unexpected platform RPC: ${name}`);
    },
    from(table) {
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() {
          calls.push(['table', table]);
          return { data: table === 'tool_access_rules'
            ? { minimum_plan: 'pro', enabled: true }
            : { period: 'monthly', free_limit: 0, pro_limit: 10, business_limit: 50 }, error: null };
        },
      };
    },
  };
  const adapter = { async create(options) {
    calls.push(['sandbox-create', options]);
    return {
      async execute(source, input) { calls.push(['sandbox-execute', source]); return { accepted: input.value === 41, result: input.value + 1 }; },
      async stop() { calls.push(['sandbox-stop']); },
    };
  } };
  const origin = `https://${projectId}.apps.example.com`;
  const invoke = (body, enabled = true, extra = {}) => servePublishedCustomOperationRuntime({
    request: new Request(`${origin}/api/application-operation`, { method: 'POST',
      headers: { origin, authorization: 'Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyIn0.signature', 'content-type': 'application/json',
        ...(extra.headers ?? {}) }, body: JSON.stringify(body) }),
    ownerId, projectId, applicationOrigin: origin, platformUrl: 'https://platformabcdefghijkl.supabase.co', platform, adapter, enabled,
    fetcher: async (url, init) => {
      calls.push(['customer-auth', String(url), init.headers.authorization]);
      return customerAuthAllowed
        ? Response.json({ id: '44444444-4444-4444-8444-444444444444', is_anonymous: false })
        : Response.json({ message: 'unauthorized' }, { status: 401 });
    },
  });

  const disabled = await invoke({ releaseId, operationId: 'op_1', input: { value: 41 } }, false);
  assert.equal(disabled.status, 404);
  assert.deepEqual(calls, [], 'disabled execution makes no platform or sandbox request');

  const denied = await invoke({ releaseId, operationId: 'op_1', input: { value: 41 } });
  assert.equal(denied.status, 403);
  assert.equal(calls.some(call => call[0] === 'sandbox-create'), false, 'invalid customer auth cannot reach quota or sandbox');
  assert.equal(calls.some(call => call[1] === 'reserve_ai_tool_usage'), false, 'invalid customer auth cannot consume quota');

  customerAuthAllowed = true;
  calls.length = 0;
  const response = await invoke({ releaseId, operationId: 'op_1', input: { value: 41 } });
  assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual(await response.json(), { result: { accepted: true, result: 42 } });
  const callNames = calls.map(call => call[0] === 'rpc' ? call[1] : call[0]);
  assert.ok(callNames.indexOf('customer-auth') < callNames.indexOf('reserve_ai_tool_usage'));
  assert.ok(callNames.indexOf('reserve_ai_tool_usage') < callNames.indexOf('sandbox-create'));
  assert.ok(callNames.indexOf('sandbox-stop') < callNames.indexOf('complete_ai_tool_usage'));
  const authCall = calls.find(call => call[0] === 'customer-auth');
  assert.equal(authCall[2], 'Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyIn0.signature');
  const sandboxCall = calls.find(call => call[0] === 'sandbox-create');
  assert.deepEqual(sandboxCall[1], { runtime: 'node22', networkPolicy: 'deny-all', persistent: false,
    timeoutMs: 10_000, resources: { vcpus: 1 } });

  const apiPath = resolve('api/application-operation.js');
  const api = (await import(pathToFileURL(apiPath))).default;
  const priorRuntimeFlag = process.env.WEBSITE_APPLICATION_RUNTIME_ENABLED;
  const priorExecutionFlag = process.env.WEBSITE_CUSTOM_EXECUTION_ENABLED;
  delete process.env.WEBSITE_APPLICATION_RUNTIME_ENABLED;
  delete process.env.WEBSITE_CUSTOM_EXECUTION_ENABLED;
  const apiResponse = () => ({ headers: {}, setHeader(name, value) { this.headers[name] = value; }, end(body = '') { this.body = body; } });
  const methodResponse = apiResponse();
  await api({ method: 'GET', headers: { host: `${projectId}.apps.example.com` }, url: '/api/application-operation' }, methodResponse);
  assert.equal(methodResponse.statusCode, 405);
  const disabledApiResponse = apiResponse();
  const apiRequest = Readable.from(['{}']);
  Object.assign(apiRequest, {
    method: 'POST',
    headers: { host: `${projectId}.apps.example.com`, origin,
      authorization: 'Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyIn0.signature', 'content-type': 'application/json' },
    url: `/api/application-operation?ownerId=${ownerId}&projectId=${projectId}`,
  });
  try {
    await api(apiRequest, disabledApiResponse);
    assert.equal(disabledApiResponse.statusCode, 404, 'the platform endpoint stays disabled unless explicitly activated');
  } finally {
    if (priorRuntimeFlag === undefined) delete process.env.WEBSITE_APPLICATION_RUNTIME_ENABLED;
    else process.env.WEBSITE_APPLICATION_RUNTIME_ENABLED = priorRuntimeFlag;
    if (priorExecutionFlag === undefined) delete process.env.WEBSITE_CUSTOM_EXECUTION_ENABLED;
    else process.env.WEBSITE_CUSTOM_EXECUTION_ENABLED = priorExecutionFlag;
  }

  console.log('Published custom operation runtime composition regression passed.');
} finally {
  await rm(dir, { recursive: true, force: true });
}
