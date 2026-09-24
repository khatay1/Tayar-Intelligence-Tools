import fs from 'node:fs';

const runner = fs.readFileSync('supabase/functions/_shared/observable-free-provider-failover.ts', 'utf8');
const failover = fs.readFileSync('supabase/functions/_shared/free-provider-failover.ts', 'utf8');
const observability = fs.readFileSync('supabase/functions/_shared/ai-provider-observability.ts', 'utf8');

for (const marker of ['onSuccess', 'onRetryableFailure', 'onTerminalFailure']) {
  if (!failover.includes(marker)) throw new Error(`Failover lifecycle hook missing: ${marker}`);
  if (!runner.includes(marker)) throw new Error(`Observable runner hook missing: ${marker}`);
}
for (const outcome of ['success', 'retryable-failure', 'terminal-failure']) {
  if (!runner.includes(`outcome: "${outcome}"`)) throw new Error(`Observable outcome missing: ${outcome}`);
}
if (!runner.includes('stage: "free-failover"')) throw new Error('Free failover stage marker missing');
if (!runner.includes('providerErrorStatus(error)')) throw new Error('Provider error status capture missing');
if (!observability.includes('Never include prompts, messages, responses')) throw new Error('Privacy contract missing');

console.log('observable free-provider failover smoke: OK');
