import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const catalogPath = path.join(root, 'src/lib/ai/free-provider-catalog.ts');
const adminPath = path.join(root, 'src/components/admin/AdminAI.tsx');
const pickerPath = path.join(root, 'src/components/admin/FreeLLMProviderCatalog.tsx');
const mapperPath = path.join(root, 'src/lib/ai/provider-preset.ts');
const controlPath = path.join(root, 'supabase/functions/ai-admin-control/index.ts');

for (const file of [catalogPath, adminPath, pickerPath, mapperPath, controlPath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing required AI registry file: ${path.relative(root, file)}`);
}

const catalog = fs.readFileSync(catalogPath, 'utf8');
const admin = fs.readFileSync(adminPath, 'utf8');
const picker = fs.readFileSync(pickerPath, 'utf8');
const mapper = fs.readFileSync(mapperPath, 'utf8');
const control = fs.readFileSync(controlPath, 'utf8');

const requiredProviders = ['gemini', 'groq', 'nvidia_nim', 'openrouter_free', 'mistral', 'huggingface', 'cerebras', 'sambanova'];
for (const key of requiredProviders) {
  if (!catalog.includes(`key: '${key}'`)) throw new Error(`Missing curated provider preset: ${key}`);
}

const requiredEndpoints = [
  'https://generativelanguage.googleapis.com',
  'https://api.groq.com/openai/v1',
  'https://integrate.api.nvidia.com/v1',
  'https://openrouter.ai/api/v1',
  'https://api.mistral.ai/v1',
  'https://router.huggingface.co/v1',
  'https://api.cerebras.ai/v1',
  'https://api.sambanova.ai/v1',
];
for (const endpoint of requiredEndpoints) {
  if (!catalog.includes(endpoint)) throw new Error(`Missing provider endpoint: ${endpoint}`);
}

if (/api[_-]?key\s*[:=]\s*['"][A-Za-z0-9_-]{16,}/i.test(catalog)) throw new Error('Catalog appears to contain a hard-coded API key');
if (!catalog.includes("adapter: 'openai_compatible'")) throw new Error('OpenAI-compatible adapter presets missing');
if (!catalog.includes("adapter: 'gemini'")) throw new Error('Gemini adapter preset missing');
if (!picker.includes('FREE_LLM_PROVIDER_CATALOG.map')) throw new Error('Admin catalog picker is not rendering curated providers');
if (!picker.includes('onSelect(provider, model.id)')) throw new Error('Admin catalog picker cannot select a provider/model preset');
if (!mapper.includes("apiSecret: ''")) throw new Error('Preset mapper must never provide an API secret');
if (!mapper.includes('does not belong to provider')) throw new Error('Preset mapper model/provider validation missing');
if (!admin.includes("supabase.functions.invoke('ai-admin-control'")) throw new Error('Admin provider control wiring missing');
if (!control.includes('Provider API secret is not configured')) throw new Error('Provider secret guard missing');
if (!control.includes('Provider base URL must use HTTPS')) throw new Error('HTTPS provider URL guard missing');

console.log(`free-llm-provider-catalog smoke: OK (${requiredProviders.length} curated providers)`);
