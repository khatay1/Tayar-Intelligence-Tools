import { buildFreeProviderFallbackKeys } from "./free-provider-fallback.ts";

export interface FailoverCandidate<TProvider> {
  provider: TProvider;
  providerKey: string;
  model: string;
}

interface BuildFailoverOptions<TProvider> {
  excludedProviderKeys: Iterable<string>;
  loadProvider: (providerKey: string) => Promise<TProvider | null>;
  getProviderKey: (provider: TProvider) => string;
  getDefaultModel: (provider: TProvider) => string;
}

/**
 * Loads only reviewed free providers that are actually configured at runtime.
 * Missing/disabled/secret-less providers are represented by loadProvider as null
 * and are silently skipped. No credentials are accepted or stored here.
 */
export async function loadConfiguredFreeFailoverCandidates<TProvider>(
  options: BuildFailoverOptions<TProvider>,
): Promise<FailoverCandidate<TProvider>[]> {
  const candidates: FailoverCandidate<TProvider>[] = [];
  const excluded = new Set(Array.from(options.excludedProviderKeys, (key) => key.trim().toLowerCase()).filter(Boolean));
  for (const providerKey of buildFreeProviderFallbackKeys(excluded)) {
    const provider = await options.loadProvider(providerKey);
    if (!provider) continue;
    const resolvedKey = options.getProviderKey(provider).trim().toLowerCase();
    if (!resolvedKey || excluded.has(resolvedKey)) continue;
    const model = options.getDefaultModel(provider).trim();
    if (!model) continue;
    excluded.add(resolvedKey);
    candidates.push({ provider, providerKey: resolvedKey, model });
  }
  return candidates;
}

export async function runFailoverCandidates<TProvider, TResult>(
  candidates: readonly FailoverCandidate<TProvider>[],
  run: (candidate: FailoverCandidate<TProvider>) => Promise<TResult>,
  canRetry: (error: unknown) => boolean,
  onRetryableFailure?: (candidate: FailoverCandidate<TProvider>, error: unknown) => void,
): Promise<{ result: TResult | null; lastRetryableError: unknown }> {
  let lastRetryableError: unknown = null;
  for (const candidate of candidates) {
    try {
      return { result: await run(candidate), lastRetryableError };
    } catch (error) {
      if (!canRetry(error)) throw error;
      lastRetryableError = error;
      onRetryableFailure?.(candidate, error);
    }
  }
  return { result: null, lastRetryableError };
}
