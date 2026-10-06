import assert from 'node:assert/strict';
import { hookHarness } from './test-support/hook-harness.mjs';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const projectId = n => `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`;
const projects = Array.from({ length: 1001 }, (_, n) => ({ id: projectId(n), user_id: owner, type: 'website-builder', deleted_at: n === 1000 ? '2026-10-01' : null }));
projects.push({ id: projectId(1002), user_id: other, type: 'website-builder' });
const uploads = [0, 1000, 1002].map(n => `${projectId(n)}/lead/file.pdf`);
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

async function run({ failProjects = false, failStorage = false, failRemoval = false, forbidden = false } = {}) {
  let handler;
  const events = [], inspected = [], removed = [], ranges = [];
  const admin = {
    from(table) {
      const filters = [];
      let start = 0, end = Infinity;
      const q = {
        select() { return q; }, eq(k, v) { filters.push([k, v]); return q; }, order() { return q; },
        range(a, b) { start = a; end = b; ranges.push([a, b]); return q; }, maybeSingle() { return q; }, delete() { return q; },
        then(resolve, reject) { return Promise.resolve().then(() => {
          if (table === 'projects') {
            assert.ok(filters.some(([k, v]) => k === 'user_id' && v === owner));
            assert.ok(filters.some(([k, v]) => k === 'type' && v === 'website-builder'));
            assert.ok(!filters.some(([k]) => k === 'deleted_at'), 'Deleted projects must also be cleaned');
            return failProjects ? { error: Error('offline') } : { data: projects.filter(p => filters.every(([k, v]) => p[k] === v)).slice(start, end + 1), error: null };
          }
          if (table === 'profiles') return { data: { role: 'user', suspended: false }, error: null };
          return { data: null, error: null };
        }).then(resolve, reject); },
      }; return q;
    },
    storage: { from(bucket) { return {
      async list(prefix) {
        inspected.push([bucket, prefix]);
        if (bucket !== 'website-form-uploads') return { data: [], error: null };
        if (failStorage) return { data: null, error: Error('storage unavailable') };
        const relevant = uploads.filter(path => path.startsWith(prefix + '/'));
        const entries = new Map();
        for (const path of relevant) { const suffix = path.slice(prefix.length + 1); const [name, rest] = suffix.split('/'); entries.set(name, { name, id: rest ? null : path }); }
        return { data: [...entries.values()], error: null };
      },
      async remove(paths) { events.push('remove'); removed.push(...paths); return { error: failRemoval ? Error('removal failed') : null }; },
    }; } },
    auth: { admin: {
      async getUserById() { return { data: { user: { email: '' } }, error: null }; },
      async deleteUser(id) { assert.equal(id, owner); events.push('delete-user'); return { error: null }; },
    } },
  };
  hookHarness('supabase/functions/delete-account/index.ts', {
    'jsr:@supabase/functions-js/edge-runtime.d.ts': {},
    '../_shared/billing.ts': {
      corsHeaders: {}, HttpError, createAdminClient: () => admin,
      requireAuthenticatedUser: async () => ({ id: forbidden ? other : owner }),
      jsonResponse: (value, status = 200) => ({ value, status }),
      handleError: error => ({ status: error.status ?? 500 }),
      stripeRequest: async () => { events.push('stripe'); throw Error('Unexpected billing call'); },
    },
  }, { Deno: { serve: fn => { handler = fn; } } });
  const response = await handler({ method: 'POST', json: async () => ({ targetUserId: owner, confirmation: forbidden ? 'DELETE_USER' : 'DELETE' }) });
  return { response, events, inspected, removed, ranges };
}

const success = await run();
assert.equal(success.response.status, 200);
assert.deepEqual(success.removed.sort(), uploads.slice(0, 2).sort(), 'Only owned attachments, including trashed projects, are removed');
assert.ok(success.ranges.some(([start]) => start === 1000), 'Project lookup must paginate');
assert.ok(!success.inspected.some(([, prefix]) => prefix.startsWith(projectId(1002))), 'Another account is never inspected');
assert.equal(success.events.at(-1), 'delete-user', 'Auth deletion follows storage cleanup');
for (const options of [{ failProjects: true }, { failStorage: true }, { forbidden: true }]) {
  const result = await run(options);
  assert.ok(result.response.status >= 400);
  assert.deepEqual(result.events, [], 'Preflight/authorization failure must leave billing, storage and account untouched');
}
const failed = await run({ failRemoval: true });
assert.equal(failed.response.status, 503);
assert.ok(!failed.events.includes('delete-user'), 'Failed storage removal must preserve the account for retry');
console.log('PASS account deletion: owned/trashed form attachments, project pagination, foreign-account isolation, preflight and removal failures');
