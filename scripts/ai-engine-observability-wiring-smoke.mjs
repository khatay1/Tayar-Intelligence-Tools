import fs from 'node:fs';

const engine = fs.readFileSync('supabase/functions/ai-engine/index.ts', 'utf8');
const required = [
  'runObservableFreeProviderFailover',
  'logProviderAttempt',
  'providerErrorStatus',
  'stage: "configured"',
  'stage: "environment"',
  'outcome: "success"',
  'outcome: "retryable-failure"',
  'outcome: "terminal-failure"',
];
for (const marker of required) {
  if (!engine.includes(marker)) throw new Error(`AI engine observability wiring missing: ${marker}`);
}
if (engine.includes('runFailoverCandidates<RuntimeProvider, TextResult>')) {
  throw new Error('AI engine bypasses observable free-provider runner');
}
console.log(`ai-engine observability wiring smoke: OK (${required.length} invariants)`);
