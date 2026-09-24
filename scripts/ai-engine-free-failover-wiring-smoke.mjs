import fs from 'node:fs';

const engine = fs.readFileSync('supabase/functions/ai-engine/index.ts', 'utf8');

const invariants = [
  ['shared failover import', 'loadConfiguredFreeFailoverCandidates, runFailoverCandidates'],
  ['provider-level exclusion', 'const seenProviders = new Set<string>()'],
  ['configured free candidates', 'loadConfiguredFreeFailoverCandidates<RuntimeProvider>'],
  ['runtime provider loader', 'loadProvider: (providerKey) => loadManagedProvider(admin, providerKey)'],
  ['free failover runner', 'runFailoverCandidates<RuntimeProvider, TextResult>'],
  ['retryability reuse', 'canFailOver,'],
  ['successful free failover return', 'if (freeFailover.result) return freeFailover.result'],
  ['last retryable propagation', 'lastRetryableError = freeFailover.lastRetryableError'],
  ['environment Gemini duplicate guard', 'GEMINI_API_KEY && !seenProviders.has("gemini")'],
];

for (const [name, marker] of invariants) {
  if (!engine.includes(marker)) throw new Error(`AI engine free failover wiring missing: ${name}`);
}

const configuredIndex = engine.indexOf('if (route?.fallbackProviderKey)');
const freeIndex = engine.indexOf('loadConfiguredFreeFailoverCandidates<RuntimeProvider>');
const envGeminiIndex = engine.indexOf('GEMINI_API_KEY && !seenProviders.has("gemini")');
if (!(configuredIndex >= 0 && freeIndex > configuredIndex && envGeminiIndex > freeIndex)) {
  throw new Error('Failover precedence must remain configured route -> reviewed free providers -> environment Gemini');
}

console.log(`ai-engine free failover wiring smoke: OK (${invariants.length} invariants)`);
