// Reviewed free-provider failover policy for server-side AI routing.
// Keep this independent from the client registry so Edge Functions do not import
// browser code. Provider credentials remain resolved through ai_provider_runtime.

export const FREE_PROVIDER_FALLBACK_ORDER = [
  "groq",
  "cerebras",
  "nvidia",
  "mistral",
  "openrouter",
  "cloudflare",
  "gemini",
] as const;

const FREE_PROVIDER_KEYS = new Set<string>(FREE_PROVIDER_FALLBACK_ORDER);

export function isReviewedFreeProvider(providerKey: string): boolean {
  return FREE_PROVIDER_KEYS.has(providerKey.trim().toLowerCase());
}

export function buildFreeProviderFallbackKeys(excludedKeys: Iterable<string>): string[] {
  const excluded = new Set(Array.from(excludedKeys, (key) => key.trim().toLowerCase()).filter(Boolean));
  return FREE_PROVIDER_FALLBACK_ORDER.filter((key) => !excluded.has(key));
}
