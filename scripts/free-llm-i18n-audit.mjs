import fs from 'node:fs';

const ui = fs.readFileSync('src/components/admin/AdminFreeLLMCatalog.tsx', 'utf8');
const registry = fs.readFileSync('src/lib/ai/free-provider-registry.ts', 'utf8');

for (const lang of ['en:', 'ar:', 'sv:']) {
  if (!ui.includes(lang)) throw new Error(`Free LLM UI language block missing: ${lang}`);
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

if (!registry.includes("throw new Error('Cloudflare Account ID must be a 32-character hexadecimal value.')")) {
  throw new Error('Expected Cloudflare validation source changed; review localized error mapping.');
}

console.log('free LLM i18n audit: OK (AR/SV/EN, no known visible English fallbacks)');
