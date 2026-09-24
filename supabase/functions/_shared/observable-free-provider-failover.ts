import { logProviderAttempt, providerErrorStatus } from "./ai-provider-observability.ts";
import { runFailoverCandidates, type FailoverCandidate } from "./free-provider-failover.ts";

export async function runObservableFreeProviderFailover<TProvider, TResult>(
  candidates: readonly FailoverCandidate<TProvider>[],
  run: (candidate: FailoverCandidate<TProvider>) => Promise<TResult>,
  canRetry: (error: unknown) => boolean,
): Promise<{ result: TResult | null; lastRetryableError: unknown }> {
  return runFailoverCandidates(candidates, run, canRetry, {
    onSuccess: (candidate, _result, durationMs) => logProviderAttempt({
      provider: candidate.providerKey,
      model: candidate.model,
      stage: "free-failover",
      outcome: "success",
      durationMs,
      status: 200,
    }),
    onRetryableFailure: (candidate, error, durationMs) => logProviderAttempt({
      provider: candidate.providerKey,
      model: candidate.model,
      stage: "free-failover",
      outcome: "retryable-failure",
      durationMs,
      status: providerErrorStatus(error),
    }),
    onTerminalFailure: (candidate, error, durationMs) => logProviderAttempt({
      provider: candidate.providerKey,
      model: candidate.model,
      stage: "free-failover",
      outcome: "terminal-failure",
      durationMs,
      status: providerErrorStatus(error),
    }),
  });
}
