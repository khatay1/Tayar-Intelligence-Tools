import type { FreeProviderPreset } from './free-provider-catalog';

export interface ProviderPresetFormValue {
  providerKey: string;
  label: string;
  adapter: FreeProviderPreset['adapter'];
  baseUrl: string;
  model: string;
  apiSecret: string;
  enabled: boolean;
}

/**
 * Converts a catalog choice into the existing admin provider form without ever
 * carrying credentials from the catalog. API secrets remain admin-supplied and
 * are persisted only by the existing Vault-backed ai-admin-control flow.
 */
export function providerPresetToForm(provider: FreeProviderPreset, modelId: string): ProviderPresetFormValue {
  const model = provider.models.find((candidate) => candidate.id === modelId);
  if (!model) throw new Error(`Model ${modelId} does not belong to provider ${provider.key}`);
  return {
    providerKey: provider.key,
    label: provider.label,
    adapter: provider.adapter,
    baseUrl: provider.baseUrl,
    model: model.id,
    apiSecret: '',
    enabled: true,
  };
}
