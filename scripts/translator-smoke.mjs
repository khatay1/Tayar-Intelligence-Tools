import fs from 'node:fs';

const files = {
  tool: fs.readFileSync('src/modules/translator/TranslatorTool.tsx', 'utf8'),
  module: fs.readFileSync('src/modules/translator/index.ts', 'utf8'),
  i18n: fs.readFileSync('src/lib/i18n.ts', 'utf8'),
  models: fs.readFileSync('src/lib/ai/types.ts', 'utf8'),
};

const checks = [
  ['Translator source exists', files.tool.length > 0],
  ['Duplicate Hindi removed', (files.tool.match(/'Hindi'/g) || []).length === 1],
  ['Auto-detect cannot be a target option', files.tool.includes("LANGUAGES.filter(l => l !== from)") || files.tool.includes('targetOptions')],
  ['Same source and target are blocked', files.tool.includes('from !== to')],
  ['Translation input is trimmed', files.tool.includes('text.trim()')],
  ['Translation UI uses automatic text direction', (files.tool.match(/dir="auto"/g) || []).length >= 2],
  ['Arabic UI direction is supported', files.tool.includes("language === 'ar'")],
  ['Translator uses low translation temperature', files.tool.includes('temperature: 0.2')],
  ['Non-streamed response fallback exists', files.tool.includes('response.content')],
  ['Clipboard errors are handled', files.tool.includes('await navigator.clipboard.writeText') && files.tool.includes('catch')],
  ['Translator module model matches backend', files.module.includes("defaultModel: 'gemini-3.6-flash'")],
  ['OpenAI model registry no longer aliases Gemini', !files.models.includes("id: 'gemini-3.6-flash', label: 'GPT-4o Mini', provider: 'openai'")],
  ['OpenAI registry contains GPT-4o Mini', files.models.includes("id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai'")],
  ['English translator localization exists', files.i18n.includes("'translator.complete': 'Translation complete'" )],
  ['Arabic translator localization exists', files.i18n.includes("'translator.complete': 'اكتملت الترجمة'" )],
  ['Swedish translator localization exists', files.i18n.includes("'translator.complete': 'Översättningen är klar'" )],
];

let failed = 0;
for (const [name, pass] of checks) {
  if (!pass) failed += 1;
  console.log(`${pass ? '✓' : '✗'} ${name}`);
}
console.log(`Translator smoke test: ${checks.length - failed} passed, ${failed} failed`);
if (failed) process.exit(1);
