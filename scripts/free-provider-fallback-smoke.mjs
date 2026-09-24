import fs from 'node:fs';

const client = fs.readFileSync('src/lib/ai/free-provider-registry.ts', 'utf8');
const server = fs.readFileSync('supabase/functions/_shared/free-provider-fallback.ts', 'utf8');
const engine = fs.readFileSync('supabase/functions/ai-engine/index.ts', 'utf8');

const expected = ['groq', 'cerebras', 'nvidia', 'mistral', 'openrouter', 'cloudflare', 'gemini'];
for (const key of expected) {
  if (!client.includes(`'${key}'`)) throw new Error(`Client free provider missing: ${key}`);
  if (!server.includes(`"${key}"`)) throw new Error(`Server fallback provider missing: ${key}`);
}

const clientOrder = client.match(/FREE_LLM_AUTO_FALLBACK_ORDER[^=]*=\s*\[([\s\S]*?)\]/)?.[1]
  ?.match(/'([^']+)'/g)?.map((value) => value.slice(1, -1));
const serverOrder = server.match(/FREE_PROVIDER_FALLBACK_ORDER\s*=\s*\[([\s\S]*?)\]/)?.[1]
  ?.match(/"([^"]+)"/g)?.map((value) => value.slice(1, -1));
if (JSON.stringify(clientOrder) !== JSON.stringify(expected)) throw new Error(`Unexpected client fallback order: ${clientOrder}`);
if (JSON.stringify(serverOrder) !== JSON.stringify(expected)) throw new Error(`Unexpected server fallback order: ${serverOrder}`);

if (!engine.includes('canFailOver')) throw new Error('AI engine retryability guard missing');
if (!engine.includes('ai_provider_runtime')) throw new Error('AI engine managed provider runtime missing');
if (!server.includes('excluded.has(key)')) throw new Error('Fallback duplicate/exclusion guard missing');

console.log(`free-provider-fallback smoke: OK (${expected.length} reviewed providers)`);
