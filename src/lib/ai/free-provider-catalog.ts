export type FreeProviderAdapter = 'gemini' | 'openai_compatible' | 'anthropic';

export interface FreeProviderModelPreset {
  id: string;
  label: string;
  context?: string;
  rateLimit?: string;
  tags: Array<'general' | 'reasoning' | 'code' | 'vision' | 'fast'>;
}

export interface FreeProviderPreset {
  key: string;
  label: string;
  adapter: FreeProviderAdapter;
  baseUrl: string;
  secretLabel: string;
  freeTierNote: string;
  models: FreeProviderModelPreset[];
}

// Curated, conservative presets for Tayar. This is intentionally not a dump of
// every model in the upstream directory: free tiers and model availability can
// change. Admins still test credentials before activation, and nothing here
// contains an API secret.
export const FREE_LLM_PROVIDER_CATALOG: FreeProviderPreset[] = [
  {
    key: 'gemini',
    label: 'Google Gemini',
    adapter: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    secretLabel: 'Gemini API key',
    freeTierNote: 'Google offers free-tier access for eligible Gemini models; limits vary by model/account.',
    models: [
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', context: '1M', rateLimit: 'Free-tier limits vary', tags: ['general', 'fast', 'code', 'vision'] },
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', context: '1M', rateLimit: 'Free-tier limits vary', tags: ['general', 'fast', 'code', 'vision'] },
    ],
  },
  {
    key: 'groq',
    label: 'Groq',
    adapter: 'openai_compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    secretLabel: 'Groq API key',
    freeTierNote: 'Free developer access is rate-limited; exact limits depend on the selected model.',
    models: [
      { id: 'moonshotai/kimi-k2-instruct', label: 'Moonshot Kimi K2', context: '131K', rateLimit: 'See provider', tags: ['general', 'code'] },
      { id: 'groq/compound', label: 'Groq Compound', context: '131K', rateLimit: '30 RPM / 250 RPD listed by source catalog', tags: ['general', 'reasoning', 'fast'] },
    ],
  },
  {
    key: 'nvidia_nim',
    label: 'NVIDIA NIM',
    adapter: 'openai_compatible',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    secretLabel: 'NVIDIA API key',
    freeTierNote: 'Developer catalog access and rate limits vary by model.',
    models: [
      { id: 'z-ai/glm-5.2', label: 'GLM 5.2', context: '1M', rateLimit: 'Up to 40 RPM listed by source catalog', tags: ['general', 'reasoning', 'code'] },
      { id: 'z-ai/glm-5.3', label: 'GLM 5.3', context: '1M', rateLimit: 'Up to 40 RPM listed by source catalog', tags: ['general', 'reasoning', 'code'] },
    ],
  },
  {
    key: 'openrouter_free',
    label: 'OpenRouter Free',
    adapter: 'openai_compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    secretLabel: 'OpenRouter API key',
    freeTierNote: 'Only models explicitly marked :free should be selected for this preset.',
    models: [
      { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', label: 'NVIDIA Nemotron 3 Ultra (Free)', context: '1M', rateLimit: 'See provider', tags: ['general', 'reasoning', 'code'] },
      { id: 'poolside/laguna-s-2.1:free', label: 'Poolside Laguna S 2.1 (Free)', context: '262K', rateLimit: 'See provider', tags: ['code', 'general'] },
    ],
  },
  {
    key: 'mistral',
    label: 'Mistral AI',
    adapter: 'openai_compatible',
    baseUrl: 'https://api.mistral.ai/v1',
    secretLabel: 'Mistral API key',
    freeTierNote: 'Free/developer availability is provider-controlled and should be verified before activation.',
    models: [
      { id: 'open-mistral-7b', label: 'Mistral 7B', context: '32K', rateLimit: 'See provider', tags: ['general', 'fast'] },
      { id: 'open-mixtral-8x7b', label: 'Mixtral 8x7B', context: '32K', rateLimit: 'See provider', tags: ['general', 'code'] },
    ],
  },
  {
    key: 'huggingface',
    label: 'Hugging Face',
    adapter: 'openai_compatible',
    baseUrl: 'https://router.huggingface.co/v1',
    secretLabel: 'Hugging Face token',
    freeTierNote: 'Inference is credit-metered; free allowance and model routing can change.',
    models: [
      { id: 'google/gemma-3-4b-it', label: 'Gemma 3 4B IT', context: '131K', rateLimit: 'Credit-metered', tags: ['general', 'fast'] },
      { id: 'meta-llama-3-1-8b-instruct', label: 'Llama 3.1 8B Instruct', context: '128K', rateLimit: 'Credit-metered', tags: ['general'] },
    ],
  },
  {
    key: 'cerebras',
    label: 'Cerebras',
    adapter: 'openai_compatible',
    baseUrl: 'https://api.cerebras.ai/v1',
    secretLabel: 'Cerebras API key',
    freeTierNote: 'Developer/free limits are model-specific and can change.',
    models: [
      { id: 'llama3.1-70b', label: 'Llama 3.1 70B', context: '131K', rateLimit: 'See provider', tags: ['general', 'reasoning', 'code'] },
      { id: 'zai-glm-4-7', label: 'GLM 4.7', context: '128K', rateLimit: '10 RPM / 100 RPD listed by source catalog', tags: ['general', 'reasoning', 'code'] },
    ],
  },
  {
    key: 'sambanova',
    label: 'SambaNova',
    adapter: 'openai_compatible',
    baseUrl: 'https://api.sambanova.ai/v1',
    secretLabel: 'SambaNova API key',
    freeTierNote: 'Free developer limits are model-specific.',
    models: [
      { id: 'deepseek-v3-1', label: 'DeepSeek V3.1', context: '128K', rateLimit: '20 RPM / 20 RPD listed by source catalog', tags: ['general', 'code', 'reasoning'] },
      { id: 'minimax-m2-7', label: 'MiniMax M2.7', context: '128K', rateLimit: '20 RPM / 20 RPD listed by source catalog', tags: ['general', 'code'] },
    ],
  },
];

export function getFreeProviderPreset(key: string): FreeProviderPreset | undefined {
  return FREE_LLM_PROVIDER_CATALOG.find((provider) => provider.key === key);
}

export function getFreeProviderModel(providerKey: string, modelId: string): FreeProviderModelPreset | undefined {
  return getFreeProviderPreset(providerKey)?.models.find((model) => model.id === modelId);
}
