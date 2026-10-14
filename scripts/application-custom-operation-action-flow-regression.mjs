import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-custom-operation-action-flow-'));
const ownerId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const releaseId = '33333333-3333-4333-8333-333333333333';
const userId = '44444444-4444-4444-8444-444444444444';
const reservationId = '55555555-5555-4555-8555-555555555555';
const origin = 'https://app.example.test';
const token = 'header.payload.signature';

try {
  const buildModule = async (name, entryPoint, alias) => {
    const outfile = join(dir, `${name}.cjs`);
    await build({ entryPoints: [entryPoint], bundle: true, platform: 'node', format: 'cjs', outfile, ...(alias ? { alias } : {}) });
    return createRequire(import.meta.url)(outfile);
  };
  const actions = await buildModule('actions', 'src/modules/website-builder/core/application-custom-operation-actions.ts');
  const clientModule = await buildModule('client', 'src/modules/website-builder/core/application-custom-operation-client.ts');
  const routeModule = await buildModule('route', 'server/website-application-custom-operation-route.ts', { '@': resolve('src') });
  const { parseApplicationCustomOperationAction } = actions;
  const { createPublishedCustomOperationClient } = clientModule;
  const { servePublishedCustomOperationRequest } = routeModule;

  const action = parseApplicationCustomOperationAction('approve_case', '{"caseId":"c-17","decision":"approved"}', new Set(['approve_case']));
  assert.deepEqual(action, { operationId: 'approve_case', input: { caseId: 'c-17', decision: 'approved' } });

  const events = [];
  let authorized = false;
  const dependencies = {
    enabled: true,
    async authorize(request, accessToken) {
      events.push(['authorize', request.operationId]);
      return authorized && request.ownerId === ownerId && request.projectId === projectId && accessToken === token;
    },
    async loadOperation(request) {
      events.push(['load', request.releaseId, request.operationId]);
      return { releaseId, operationId: 'approve_case', source: 'deterministic sandbox fixture' };
    },
    async reserveUsage(request) { events.push(['reserve', request.operationId]); return reservationId; },
    async completeUsage(id, request, durationMs, status) {
      events.push(['complete', id, request.operationId, status]);
      assert.ok(Number.isFinite(durationMs) && durationMs >= 0);
      return id === reservationId;
    },
    adapter: {
      async create(options) {
        events.push(['sandbox-create', options]);
        return {
          async execute(source, input) {
            events.push(['sandbox-execute', source]);
            assert.equal(source, 'deterministic sandbox fixture');
            return { approved: input.decision === 'approved', caseId: input.caseId };
          },
          async stop() { events.push(['sandbox-stop']); },
        };
      },
    },
  };

  const auth = {
    async getSession() { return { data: { session: { access_token: token } }, error: null }; },
    async getUser(value) { return { data: { user: value === token ? { id: userId, is_anonymous: false } : null }, error: null }; },
  };
  let submittedBody;
  const operationClient = createPublishedCustomOperationClient({ auth }, {
    ownerId, projectId, releaseId, applicationOrigin: origin, operationIds: ['approve_case'],
  }, async (url, init) => {
    submittedBody = JSON.parse(init.body);
    return servePublishedCustomOperationRequest({
      request: new Request(new URL('/api/application-operation', origin), { method: init.method, headers: {
        ...init.headers, origin, 'sec-fetch-site': 'same-origin',
      }, body: init.body }),
      ownerId, projectId, applicationOrigin: origin, dependencies,
    });
  });

  await assert.rejects(operationClient.execute(action.operationId, action.input, userId), error => error.code === 'not-authorized');
  assert.deepEqual(events.map(([name]) => name), ['authorize'], 'authorization denial stops before release loading, quota and sandbox');
  events.length = 0;
  authorized = true;
  assert.deepEqual(await operationClient.execute(action.operationId, action.input, userId), { approved: true, caseId: 'c-17' });
  assert.deepEqual(submittedBody, { releaseId, operationId: 'approve_case', input: action.input }, 'browser request carries only immutable release, allowlisted operation and JSON input');
  assert.deepEqual(events.map(([name]) => name), ['authorize', 'load', 'reserve', 'sandbox-create', 'sandbox-execute', 'sandbox-stop', 'complete']);
  assert.deepEqual(events.find(([name]) => name === 'sandbox-create')[1], {
    runtime: 'node22', networkPolicy: 'deny-all', persistent: false, timeoutMs: 10_000, resources: { vcpus: 1 },
  });
  assert.equal(events.find(([name]) => name === 'complete')[3], 'success');
  console.log('Custom operation action flow regression passed: action input → authenticated client → protected route → quota → isolated execution.');
} finally {
  await rm(dir, { recursive: true, force: true });
}
