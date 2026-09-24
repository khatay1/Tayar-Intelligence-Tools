import fs from 'node:fs';

const ui = fs.readFileSync('src/components/admin/AdminFreeLLMCatalog.tsx', 'utf8');
const copy = fs.readFileSync('src/lib/ai/free-provider-copy.ts', 'utf8');
const validation = fs.readFileSync('src/lib/ai/free-provider-validation.ts', 'utf8');

for (const lang of ['en:', 'ar:', 'sv:']) {
  if (!ui.includes(lang)) throw new Error(`Free LLM UI language block missing: ${lang}`);
  if (!copy.includes(lang)) throw new Error(`Free LLM provider copy language block missing: ${lang}`);
  if (!validation.includes(lang)) throw new Error(`Free LLM validation language block missing: ${lang}`);
}

const hardcodedVisible = [
  '>source <',
  '/>Refresh</button>',
  '>Base URL</div>',
  "test.ok ? 'OK' : 'Failed'",
  '{provider.description}',
  '?.note}</p>',
];
const found = hardcodedVisible.filter((marker) => ui.includes(marker));
if (found.length) throw new Error(`Unlocalized Free LLM UI text remains: ${found.join(', ')}`);

const localizedWiring = [
  'freeLLMProviderDescription(language, provider.key)',
  'freeLLMModelNote(language, provider.key, selectedModel)',
  'resolveLocalizedFreeLLMProviderBaseUrl(provider, accountIds[provider.key] || \'\', language)',
  '{c.sourceLink}',
  '{c.refresh}',
  '{c.baseUrl}',
  'test.ok ? c.testOk : c.testFailed',
];
for (const marker of localizedWiring) {
  if (!ui.includes(marker)) throw new Error(`Localized Free LLM wiring missing: ${marker}`);
}

if (!validation.includes('ACCOUNT_ID_ERROR')) throw new Error('Localized Cloudflare Account ID validation mapping missing');
if (validation.includes("throw new Error('Cloudflare Account ID must be a 32-character hexadecimal value.')")) {
  throw new Error('Hardcoded English Cloudflare validation returned');
}

console.log('free LLM i18n audit: OK (AR/SV/EN, localized dynamic copy and validation)');
