import fs from 'node:fs';

const source = fs.readFileSync('supabase/functions/_shared/ai-provider-observability.ts', 'utf8');
const required = [
  'ProviderAttemptStage',
  'ProviderAttemptOutcome',
  'durationMs',
  'providerErrorStatus',
  'logProviderAttempt',
  'stage=${event.stage}',
  'provider=${provider}',
  'model=${model}',
  'outcome=${event.outcome}',
  'status=${status}',
  'duration_ms=${durationMs}',
];
for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Observability marker missing: ${marker}`);
}

const forbiddenLogFields = ['prompt=${', 'messages=${', 'api_secret=${', 'authorization=${', 'response=${', 'content=${'];
for (const marker of forbiddenLogFields) {
  if (source.toLowerCase().includes(marker)) throw new Error(`Sensitive observability field detected: ${marker}`);
}

console.log(`ai-provider observability smoke: OK (${required.length} metadata invariants)`);
