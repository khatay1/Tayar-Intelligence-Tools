import fs from 'node:fs';

const ui = fs.readFileSync('src/components/admin/AdminFreeLLMCatalog.tsx', 'utf8');
const health = fs.readFileSync('src/lib/ai/provider-health.ts', 'utf8');
const required = [
  'deriveProviderHealth',
  'healthLabel(health.state, c)',
  'health.canTest',
  'health.canActivate',
  'ProviderTestState',
  'latencyMs',
  'testedAt',
  'setTests',
  'Last test',
  'آخر اختبار',
  'Senaste test',
];
for (const marker of required) if (!ui.includes(marker)) throw new Error(`Admin free LLM health UI missing: ${marker}`);
for (const state of ["'not-configured'", "'disabled'", "'ready'", "'default'"]) if (!health.includes(state)) throw new Error(`Provider health state missing: ${state}`);
if (!ui.includes("delete next[provider.key]")) throw new Error('Provider test state must be invalidated after provider configuration changes');
console.log(`admin free LLM health smoke: OK (${required.length} UI invariants)`);
