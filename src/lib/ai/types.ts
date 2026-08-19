// AI Provider types and configuration
// Provider registry â€” to add a new provider, add its config here and implement
// the corresponding adapter in the edge function (supabase/functions/ai-engine).

export type AIProvider = 'openai' | 'gemini' | 'anthropic';

export interface AIModel {
  id: string;
  label: string;
  provider: AIProvider;
  maxTokens: number;
  contextWindow: number;
}

export interface ProviderConfig {
  provider: AIProvider;
  label: string;
  models: AIModel[];
  envKey: string;
  description: string;
}

export const AI_PROVIDERS: Record<AIProvider, ProviderConfig> = {
  openai: {
    provider: 'openai',
    label: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    description: 'GPT-4o, GPT-4o Mini, GPT-4 Turbo â€” versatile models for all tasks',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai', maxTokens: 16384, contextWindow: 128000 },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai', maxTokens: 16384, contextWindow: 128000 },
      { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', provider: 'openai', maxTokens: 4096, contextWindow: 128000 },
    ],
  },
  gemini: {
    provider: 'gemini',
    label: 'Google Gemini',
    envKey: 'GEMINI_API_KEY',
    description: 'Gemini 3.6 Flash, 1.5 Pro, 1.5 Flash â€” fast with huge context windows',
    models: [
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', provider: 'gemini', maxTokens: 8192, contextWindow: 1000000 },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', provider: 'gemini', maxTokens: 8192, contextWindow: 2000000 },
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', provider: 'gemini', maxTokens: 8192, contextWindow: 1000000 },
    ],
  },
  anthropic: {
    provider: 'anthropic',
    label: 'Anthropic Claude',
    envKey: 'ANTHROPIC_API_KEY',
    description: 'Claude Sonnet 4, 3.5 Sonnet, 3.5 Haiku â€” excellent for writing and analysis',
    models: [
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', provider: 'anthropic', maxTokens: 8192, contextWindow: 200000 },
      { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', provider: 'anthropic', maxTokens: 8192, contextWindow: 200000 },
      { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', provider: 'anthropic', maxTokens: 8192, contextWindow: 200000 },
    ],
  },
};

export const ALL_MODELS: AIModel[] = Object.values(AI_PROVIDERS).flatMap(p => p.models);

export function getModel(modelId: string): AIModel | undefined {
  return ALL_MODELS.find(m => m.id === modelId);
}

export function getProviderModels(provider: AIProvider): AIModel[] {
  return AI_PROVIDERS[provider].models;
}

export function getProviderForModel(modelId: string): AIProvider {
  const model = getModel(modelId);
  if (model) return model.provider;
  if (modelId.startsWith('gpt')) return 'openai';
  if (modelId.startsWith('gemini')) return 'gemini';
  if (modelId.startsWith('claude')) return 'anthropic';
  return 'openai';
}

// Default model per tool â€” can be overridden by admin settings or user preferences
export const DEFAULT_MODELS: Record<string, string> = {
  'cv-builder': 'gpt-4o',
  'cover-letter': 'gpt-4o',
  'ai-writer': 'gpt-4o',
  'document-ai': 'gpt-4o',
  'study-assistant': 'gpt-4o',
  'translator': 'gpt-4o-mini',
  'ai-chat': 'gpt-4o-mini',
};

export function getDefaultModel(tool: string): string {
  return DEFAULT_MODELS[tool] || 'gpt-4o-mini';
}

