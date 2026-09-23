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

export interface FailoverLifecycle<TProvider, TResult> {
  onSuccess?: (candidate: FailoverCandidate<TProvider>, result: TResult, durationMs: number) => void;
  onRetryableFailure?: (candidate: FailoverCandidate<TProvider>, error: unknown, durationMs: number) => void;
  onTerminalFailure?: (candidate: FailoverCandidate<TProvider>, error: unknown, durationMs: number) => void;
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
  lifecycle: FailoverLifecycle<TProvider, TResult> = {},
): Promise<{ result: TResult | null; lastRetryableError: unknown }> {
  let lastRetryableError: unknown = null;
  for (const candidate of candidates) {
    const startedAt = Date.now();
    try {
      const result = await run(candidate);
      lifecycle.onSuccess?.(candidate, result, Date.now() - startedAt);
      return { result, lastRetryableError };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      if (!canRetry(error)) {
        lifecycle.onTerminalFailure?.(candidate, error, durationMs);
        throw error;
      }
      lastRetryableError = error;
      lifecycle.onRetryableFailure?.(candidate, error, durationMs);
    }
  }
  return { result: null, lastRetryableError };
}
