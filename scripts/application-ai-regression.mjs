import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const temp = await mkdtemp(join(tmpdir(), 'tayar-application-ai-'));
try {
  const outfile = join(temp, 'planner.cjs');
  await build({
    entryPoints: ['src/modules/website-builder/services/websiteApplicationAIService.ts'],
    bundle: true, platform: 'node', format: 'cjs', outfile,
    alias: { '@': resolve('src') },
    plugins: [{ name: 'isolated-ai-engine', setup(bundler) {
      bundler.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({ path: 'ai-engine', namespace: 'mock' }));
      bundler.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const supabase = { functions: { invoke: async (_, request) => { globalThis.__aiBody = request.body; return globalThis.__aiResponse; } } };', loader: 'js' }));
    } }],
  });
  const { planWebsiteApplicationWithAI } = (await import(pathToFileURL(outfile))).default;
  const project = { cloudProjectId: 'app-one', pages: [{ id: 'home' }], application: undefined };
  const base = { id: 'products', key: 'products', name: 'Products', fields: [{ id: 'product-name', key: 'name', name: 'Name', type: 'text', required: true }], permissions: [{ operation: 'read', access: 'public' }] };
  globalThis.__aiResponse = { data: { json: { summary: 'Products', warnings: [], operations: [{ type: 'put_table', table: base }] } }, error: null };
  const plan = await planWebsiteApplicationWithAI(project, 'Create product data');
  assert.equal(plan.operations[0].table.key, 'products');
  assert.equal(globalThis.__aiBody.tool, 'website-builder');
  assert.equal(JSON.stringify(globalThis.__aiBody).includes('STRIPE_SECRET_KEY'), false);
  for (const operation of [
    { type: 'put_table', table: { ...base, key: 'products; drop table users' } },
    { type: 'put_table', table: { ...base, secrets: { token: 'hidden' } } },
    { type: 'remove_table', tableId: 'products' },
    { type: 'put_role', role: { id: 'admin', name: 'Admin', permissions: ['service_role'] } },
    { type: 'put_table', table: { ...base, fields: [{ ...base.fields[0], referenceTableId: 'other' }] } },
  ]) {
    globalThis.__aiResponse = { data: { json: { summary: 'unsafe', warnings: [], operations: [operation] } }, error: null };
    await assert.rejects(planWebsiteApplicationWithAI(project, 'Do something unsafe'));
  }
  globalThis.__aiResponse = { data: { content: '{not valid' }, error: null };
  await assert.rejects(planWebsiteApplicationWithAI(project, 'Invalid JSON'));
  console.log('PASS application AI uses existing engine and rejects unsafe or invalid operations before review');
} finally { await rm(temp, { recursive: true, force: true }); }
