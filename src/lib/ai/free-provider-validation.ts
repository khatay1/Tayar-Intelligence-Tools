import type { FreeLLMLanguage } from './free-provider-copy';
import type { FreeLLMProviderPreset } from './free-provider-registry';

const ACCOUNT_ID_ERROR: Record<FreeLLMLanguage, string> = {
  en: 'Cloudflare Account ID must be a 32-character hexadecimal value.',
  ar: 'يجب أن يكون معرّف حساب Cloudflare قيمة سداسية عشرية مكوّنة من 32 خانة.',
  sv: 'Cloudflare Account ID måste vara ett hexadecimalt värde med 32 tecken.',
};

export function resolveLocalizedFreeLLMProviderBaseUrl(
  provider: FreeLLMProviderPreset,
  accountId: string,
  language: FreeLLMLanguage,
): string {
  if (!provider.baseUrlNeedsAccountId) return provider.baseUrl;
  const normalized = accountId.trim();
  if (!/^[a-f0-9]{32}$/i.test(normalized)) throw new Error(ACCOUNT_ID_ERROR[language]);
  return provider.baseUrl.replace('{account_id}', normalized);
}
