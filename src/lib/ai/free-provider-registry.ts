// Curated free-tier LLM provider presets for the Tayar admin control plane.
//
// This is intentionally a small, reviewed catalog rather than a mirror of every
// model in awesome-free-llm-apis. Provider availability and limits can change;
// admins still choose the model and supply their own API credentials. Secrets
// are never stored in this client-side registry.

export type FreeLLMProviderKey =
  | 'gemini'
  | 'groq'
  | 'nvidia'
  | 'openrouter'
  | 'mistral'
  | 'cerebras'
  | 'cloudflare';

export type FreeLLMProviderAdapter = 'gemini' | 'openai_compatible';
export type FreeTierKind = 'permanent' | 'renewable';
export type VerificationKind = 'none' | 'registration' | 'phone';

export interface FreeLLMModelPreset {
  id: string;
  label: string;
  contextWindow: number;
  note?: string;
}

export interface FreeLLMProviderPreset {
  key: FreeLLMProviderKey;
  label: string;
  adapter: FreeLLMProviderAdapter;
  baseUrl: string;
  baseUrlNeedsAccountId?: boolean;
  freeTier: FreeTierKind;
  verification: VerificationKind;
  apiKeyUrl: string;
  description: string;
  models: readonly FreeLLMModelPreset[];
}

export const FREE_LLM_CATALOG_UPDATED_AT = '2026-09-23';
export const FREE_LLM_CATALOG_SOURCE = 'https://github.com/open-free-llm-api/awesome-freellm-apis';

export const FREE_LLM_PROVIDER_PRESETS: readonly FreeLLMProviderPreset[] = [
  {
    key: 'gemini',
    label: 'Google Gemini',
    adapter: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    freeTier: 'permanent',
    verification: 'none',
    apiKeyUrl: 'https://aistudio.google.com/app/apikey',
    description: 'Tayar native Gemini adapter with the existing production fallback path.',
    models: [
      { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', contextWindow: 1_000_000 },
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', contextWindow: 1_000_000, note: '15 RPM / 1,500 RPD listed by the catalog snapshot.' },
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', contextWindow: 1_000_000, note: '15 RPM / 1,500 RPD listed by the catalog snapshot.' },
    ],
  },
  {
    key: 'groq',
    label: 'Groq',
    adapter: 'openai_compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    freeTier: 'permanent',
    verification: 'none',
    apiKeyUrl: 'https://console.groq.com/keys',
    description: 'Fast OpenAI-compatible inference with a no-card free tier.',
    models: [
      { id: 'moonshotai/kimi-k2-instruct', label: 'Moonshot Kimi K2', contextWindow: 131_000 },
      { id: 'moonshotai/kimi-k2-instruct-0905', label: 'Moonshot Kimi K2 0905', contextWindow: 131_000 },
      { id: 'groq/compound', label: 'Groq Compound', contextWindow: 131_000, note: '30 RPM / 250 RPD listed by the catalog snapshot.' },
    ],
  },
  {
    key: 'nvidia',
    label: 'NVIDIA NIM',
    adapter: 'openai_compatible',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    freeTier: 'permanent',
    verification: 'phone',
    apiKeyUrl: 'https://build.nvidia.com/settings/api-keys',
    description: 'Large free model catalog behind an OpenAI-compatible endpoint.',
    models: [
      { id: 'z-ai/glm-5.2', label: 'GLM 5.2', contextWindow: 1_000_000, note: 'Up to 40 RPM listed by the catalog snapshot.' },
      { id: 'z-ai/glm-5.1', label: 'GLM 5.1', contextWindow: 202_000 },
      { id: 'z-ai/glm-5.3', label: 'GLM 5.3', contextWindow: 1_000_000 },
    ],
  },
  {
    key: 'openrouter',
    label: 'OpenRouter',
    adapter: 'openai_compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    freeTier: 'renewable',
    verification: 'registration',
    apiKeyUrl: 'https://openrouter.ai/workspaces/default/keys',
    description: 'OpenAI-compatible router with many :free models; quotas can depend on account status.',
    models: [
      { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', label: 'Nemotron 3 Ultra (free)', contextWindow: 1_000_000 },
      { id: 'poolside/laguna-s-2.1:free', label: 'Poolside Laguna S 2.1 (free)', contextWindow: 262_000 },
      { id: 'inclusionai/ling-3.0-flash-fin:free', label: 'Ling 3.0 Flash Fin (free)', contextWindow: 262_000 },
    ],
  },
  {
    key: 'mistral',
    label: 'Mistral AI',
    adapter: 'openai_compatible',
    baseUrl: 'https://api.mistral.ai/v1',
    freeTier: 'permanent',
    verification: 'none',
    apiKeyUrl: 'https://console.mistral.ai/api-keys',
    description: 'OpenAI-compatible Mistral endpoint with free-tier models.',
    models: [
      { id: 'mistral-medium-3-5-128b', label: 'Mistral Medium 3.5 (128B)', contextWindow: 256_000 },
      { id: 'open-mistral-7b', label: 'Mistral 7B', contextWindow: 32_000 },
      { id: 'open-mixtral-8x7b', label: 'Mixtral 8x7B', contextWindow: 32_000 },
    ],
  },
  {
    key: 'cerebras',
    label: 'Cerebras',
    adapter: 'openai_compatible',
    baseUrl: 'https://api.cerebras.ai/v1',
    freeTier: 'permanent',
    verification: 'none',
    apiKeyUrl: 'https://cloud.cerebras.ai/',
    description: 'Low-latency OpenAI-compatible inference with a free tier.',
    models: [
      { id: 'zai-glm-4.7', label: 'GLM 4.7', contextWindow: 128_000, note: '10 RPM / 100 RPD / 1M TPD listed by the catalog snapshot.' },
      { id: 'llama3.1-70b', label: 'Llama 3.1 70B', contextWindow: 131_000 },
    ],
  },
  {
    key: 'cloudflare',
    label: 'Cloudflare Workers AI',
    adapter: 'openai_compatible',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1',
    baseUrlNeedsAccountId: true,
    freeTier: 'permanent',
    verification: 'none',
    apiKeyUrl: 'https://dash.cloudflare.com/profile/api-tokens',
    description: 'Workers AI via Cloudflare\'s OpenAI-compatible Chat Completions endpoint.',
    models: [
      { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'Llama 3.3 70B FP8 Fast', contextWindow: 24_000, note: 'Workers AI quotas are shared by account.' },
      { id: '@cf/mistral/mistral-7b-instruct-v0.1', label: 'Mistral 7B', contextWindow: 32_000 },
      { id: '@cf/qwen/qwen1.5-7b-chat', label: 'Qwen 1.5 7B Chat', contextWindow: 32_000 },
    ],
  },
] as const;

// Used by the backend routing work as the reviewed free-provider failover order.
// It is exported here as well so admin UI and diagnostics can display the same
// intended order without guessing from provider labels.
export const FREE_LLM_AUTO_FALLBACK_ORDER: readonly FreeLLMProviderKey[] = [
  'groq',
  'cerebras',
  'nvidia',
  'mistral',
  'openrouter',
  'cloudflare',
  'gemini',
] as const;

export function getFreeLLMProviderPreset(key: string): FreeLLMProviderPreset | undefined {
  return FREE_LLM_PROVIDER_PRESETS.find((provider) => provider.key === key);
}

export function resolveFreeLLMProviderBaseUrl(provider: FreeLLMProviderPreset, accountId = ''): string {
  if (!provider.baseUrlNeedsAccountId) return provider.baseUrl;
  const normalized = accountId.trim();
  if (!/^[a-f0-9]{32}$/i.test(normalized)) {
    throw new Error('Cloudflare Account ID must be a 32-character hexadecimal value.');
  }
  return provider.baseUrl.replace('{account_id}', normalized);
}
