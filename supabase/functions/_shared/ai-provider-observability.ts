export type ProviderAttemptStage = "configured" | "free-failover" | "environment";
export type ProviderAttemptOutcome = "success" | "retryable-failure" | "terminal-failure";

export interface ProviderAttemptEvent {
  provider: string;
  model: string;
  stage: ProviderAttemptStage;
  outcome: ProviderAttemptOutcome;
  durationMs: number;
  status: number;
}

export function providerErrorStatus(error: unknown): number {
  if (error && typeof error === "object" && "status" in error) {
    const status = Number((error as { status?: unknown }).status);
    if (Number.isFinite(status)) return Math.max(0, Math.floor(status));
  }
  return 0;
}

export function logProviderAttempt(event: ProviderAttemptEvent): void {
  // Deliberately log metadata only. Never include prompts, messages, responses,
  // request bodies, authorization headers, provider secrets, or user content.
  const provider = event.provider.trim().slice(0, 60) || "unknown";
  const model = event.model.trim().slice(0, 100) || "unknown";
  const durationMs = Math.max(0, Math.floor(event.durationMs));
  const status = Math.max(0, Math.floor(event.status));
  const message = `[AI PROVIDER] stage=${event.stage} provider=${provider} model=${model} outcome=${event.outcome} status=${status} duration_ms=${durationMs}`;
  if (event.outcome === "success") console.info(message);
  else if (event.outcome === "retryable-failure") console.warn(message);
  else console.error(message);
}
