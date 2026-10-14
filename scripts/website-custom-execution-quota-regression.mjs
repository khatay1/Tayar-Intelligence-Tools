import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-custom-execution-quota-'));
try {
  const outfile = join(dir, 'custom-quota.cjs');
  await build({ entryPoints: ['server/website-application-custom-operation-quota.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { reserveWebsiteCustomExecutionUsage, completeWebsiteCustomExecutionUsage } = (await import(pathToFileURL(outfile))).default;
  const requests = [];
  const tableRows = {
    tool_access_rules: { minimum_plan: 'pro', enabled: true },
    tool_plan_limits: { period: 'monthly', free_limit: 0, pro_limit: 10, business_limit: 50 },
  };
  const admin = {
    from(table) { return { select() { return { eq(_key, value) { requests.push(['table', table, value]); return { async maybeSingle() { return { data: tableRows[table], error: null }; } }; } }; } }; },
    async rpc(name, args) { requests.push(['rpc', name, args]); return { data: name === 'team_effective_plan' ? 'pro' : '123e4567-e89b-42d3-a456-426614174000', error: null }; },
  };
  const scope = { projectId: 'p1', releaseId: 'r1', operationId: 'op1' };
  assert.equal(await reserveWebsiteCustomExecutionUsage(admin, 'user1', scope), '123e4567-e89b-42d3-a456-426614174000');
  assert.equal(requests.find(item => item[0] === 'rpc' && item[1] === 'reserve_ai_tool_usage')[2].p_limit, 10);
  assert.equal(requests.find(item => item[0] === 'rpc' && item[1] === 'reserve_ai_tool_usage')[2].p_tool, 'website-custom-execution');

  tableRows.tool_access_rules.enabled = false;
  requests.length = 0;
  assert.equal(await reserveWebsiteCustomExecutionUsage(admin, 'user1', scope), null);
  assert.equal(requests.some(item => item[0] === 'rpc' && item[1] === 'reserve_ai_tool_usage'), false,
    'disabled custom execution cannot reserve usage');

  let completion;
  const completeAdmin = { async rpc(name, args) { completion = [name, args]; return { error: null }; } };
  assert.equal(await completeWebsiteCustomExecutionUsage(completeAdmin, 'user1', '123e4567-e89b-42d3-a456-426614174000', 12_000, 'success'), true);
  assert.equal(completion[1].p_status, 'success');
  assert.equal(completion[1].p_duration_ms, 10_000);
  assert.equal(await completeWebsiteCustomExecutionUsage(completeAdmin, 'user1', '123e4567-e89b-42d3-a456-426614174000', 17, 'error'), true);
  assert.equal(completion[1].p_status, 'error', 'failed sandbox attempts consume quota but are recorded as errors');
  assert.equal(await completeWebsiteCustomExecutionUsage(completeAdmin, 'user1', 'invalid', 3, 'success'), false);
  assert.equal(await completeWebsiteCustomExecutionUsage(completeAdmin, 'user1', '123e4567-e89b-42d3-a456-426614174000', 3, 'pending'), false);

  const migration = await fs.readFile(new URL('../supabase/migrations/20261013233709_website_custom_execution_quota.sql', import.meta.url), 'utf8');
  assert.match(migration, /website-custom-execution', 'pro', false/);
  assert.match(migration, /website-custom-execution', 0, 10, 50, 'monthly'/);
  assert.match(migration, /on conflict \(tool_id\) do nothing/);
  console.log('Website custom execution quota regression passed.');
} finally {
  await rm(dir, { recursive: true, force: true });
}
