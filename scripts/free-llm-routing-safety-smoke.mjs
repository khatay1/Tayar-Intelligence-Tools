import fs from 'node:fs';

const engine = fs.readFileSync('supabase/functions/ai-engine/index.ts', 'utf8');
const failover = fs.readFileSync('supabase/functions/_shared/free-provider-failover.ts', 'utf8');
const policy = fs.readFileSync('supabase/functions/_shared/free-provider-fallback.ts', 'utf8');

const engineRules = [
  ['explicit primary route', 'if (route?.primaryProviderKey)'],
  ['explicit fallback route', 'if (route?.fallbackProviderKey)'],
  ['managed default fallback', 'loadManagedDefaultProvider(admin)'],
  ['provider de-duplication', 'seenProviders.add(providerKey)'],
  ['attempt de-duplication', 'seenAttempts.add(key)'],
  ['retryable status 429', 'error.status === 429'],
  ['retryable server errors', 'error.status >= 500'],
  ['reviewed free fallback load', 'loadConfiguredFreeFailoverCandidates<RuntimeProvider>'],
  ['environment Gemini last resort', 'GEMINI_API_KEY && !seenProviders.has("gemini")'],
  ['JSON mode request', 'body.jsonMode'],
  ['JSON response parsing', 'JSON.parse(result.content)'],
];
for (const [name, marker] of engineRules) if (!engine.includes(marker)) throw new Error(`Routing safety missing: ${name}`);

const primary = engine.indexOf('if (route?.primaryProviderKey)');
const explicitFallback = engine.indexOf('if (route?.fallbackProviderKey)');
const reviewedFree = engine.indexOf('loadConfiguredFreeFailoverCandidates<RuntimeProvider>');
const environment = engine.indexOf('GEMINI_API_KEY && !seenProviders.has("gemini")');
if (!(primary >= 0 && explicitFallback > primary && reviewedFree > explicitFallback && environment > reviewedFree)) {
  throw new Error('Routing precedence changed: explicit routes must beat reviewed free failover, with environment Gemini last');
}

for (const marker of ['if (!provider) continue', 'if (!resolvedKey || excluded.has(resolvedKey)) continue', 'if (!model) continue', 'if (!canRetry(error))']) {
  if (!failover.includes(marker)) throw new Error(`Failover safety guard missing: ${marker}`);
}
if (!policy.includes('excluded.has(key)')) throw new Error('Fallback policy exclusion guard missing');

console.log(`free LLM routing safety smoke: OK (${engineRules.length} engine invariants)`);
