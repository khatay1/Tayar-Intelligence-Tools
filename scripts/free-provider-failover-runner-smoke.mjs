import fs from 'node:fs';

const runner = fs.readFileSync('supabase/functions/_shared/free-provider-failover.ts', 'utf8');
const policy = fs.readFileSync('supabase/functions/_shared/free-provider-fallback.ts', 'utf8');

const invariants = [
  ['reviewed order only', 'buildFreeProviderFallbackKeys(excluded)'],
  ['skip unconfigured providers', 'if (!provider) continue'],
  ['dedupe provider keys', 'excluded.has(resolvedKey)'],
  ['require a model', 'if (!model) continue'],
  ['stop on success', 'return { result: await run(candidate), lastRetryableError }'],
  ['stop on non-retryable errors', 'if (!canRetry(error)) throw error'],
  ['remember retryable failure', 'lastRetryableError = error'],
];
for (const [name, marker] of invariants) {
  if (!runner.includes(marker)) throw new Error(`Failover invariant missing: ${name}`);
}
if (!policy.includes('FREE_PROVIDER_FALLBACK_ORDER')) throw new Error('Reviewed fallback policy missing');
if (/api[_-]?key\s*[:=]\s*["'][A-Za-z0-9_-]{16,}/i.test(runner + policy)) throw new Error('Failover code must not contain API credentials');

console.log(`free-provider-failover runner smoke: OK (${invariants.length} invariants)`);
