import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const registryPath = path.join(root, 'src/lib/ai/free-provider-registry.ts');
const adminCatalogPath = path.join(root, 'src/components/admin/AdminFreeLLMCatalog.tsx');
const adminPanelPath = path.join(root, 'src/components/admin/AdminPanel.tsx');
const controlPath = path.join(root, 'supabase/functions/ai-admin-control/index.ts');

for (const file of [registryPath, adminCatalogPath, adminPanelPath, controlPath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing required free-LLM registry file: ${path.relative(root, file)}`);
}

const registry = fs.readFileSync(registryPath, 'utf8');
const catalogUi = fs.readFileSync(adminCatalogPath, 'utf8');
const adminPanel = fs.readFileSync(adminPanelPath, 'utf8');
const control = fs.readFileSync(controlPath, 'utf8');

const requiredProviders = ['gemini', 'groq', 'nvidia', 'openrouter', 'mistral', 'cerebras', 'cloudflare'];
for (const key of requiredProviders) {
  if (!registry.includes(`key: '${key}'`)) throw new Error(`Missing reviewed provider preset: ${key}`);
}

for (const endpoint of [
  'https://generativelanguage.googleapis.com',
  'https://api.groq.com/openai/v1',
  'https://integrate.api.nvidia.com/v1',
  'https://openrouter.ai/api/v1',
  'https://api.mistral.ai/v1',
  'https://api.cerebras.ai/v1',
  'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1',
]) if (!registry.includes(endpoint)) throw new Error(`Missing reviewed provider endpoint: ${endpoint}`);

if (/api[_-]?key\s*[:=]\s*['"][A-Za-z0-9_-]{16,}/i.test(registry)) throw new Error('Registry appears to contain a hard-coded API key');
if (!registry.includes('FREE_LLM_AUTO_FALLBACK_ORDER')) throw new Error('Reviewed fallback order missing');
if (!registry.includes("'groq',") || !registry.includes("'gemini',")) throw new Error('Fallback order is incomplete');
if (!catalogUi.includes("supabase.functions.invoke('ai-admin-control'")) throw new Error('Admin free-LLM catalog is not wired to provider control');
if (!catalogUi.includes("action: 'test'")) throw new Error('Admin free-LLM provider test action missing');
if (!catalogUi.includes("action: 'activate'")) throw new Error('Admin free-LLM provider activation action missing');
if (!adminPanel.includes('<AdminFreeLLMCatalog />')) throw new Error('Free-LLM catalog is not mounted in the AI admin view');
if (!control.includes('Provider API secret is not configured')) throw new Error('Provider secret guard missing');
if (!control.includes('Provider base URL must use HTTPS')) throw new Error('HTTPS provider URL guard missing');

console.log(`free-llm-provider-catalog smoke: OK (${requiredProviders.length} reviewed providers)`);
