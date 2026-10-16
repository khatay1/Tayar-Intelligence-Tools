/**
 * Bounded, network-free customer deployment heartbeat assessment.
 *
 * Inspired by status/heartbeat concepts reviewed in MIT-licensed Uptime Kuma
 * (louislam/uptime-kuma@b092505f894d66669b67f46e1da72b51016eceab).
 * Original Tayar implementation; no upstream code or runtime is copied.
 *
 * Only feed evidence from an already authenticated, scope-pinned customer
 * deployment probe, never from user-supplied endpoints or preview UI state.
 * This does not schedule probes, read secrets or certify Production readiness.
 */
export interface OwnedDeploymentHeartbeat {
  checkedAt: string;
  outcome: 'up' | 'down' | 'maintenance' | 'unknown';
  /** Successful HTTP/protocol round-trip latency, not a client estimate. */
  latencyMs?: number;
}

export interface OwnedDeploymentHealth {
  state: 'healthy' | 'degraded' | 'offline' | 'maintenance' | 'unknown';
  lastCheckedAt: string | null;
  observedChecks: number;
  successfulChecks: number;
  failedChecks: number;
  inconclusiveChecks: number;
  /** Per-check success percentage, NOT time-weighted SLA uptime. */
  observedSuccessPercent: number | null;
  p95LatencyMs: number | null;
  consecutiveSuccessfulChecks: number;
  consecutiveFailedChecks: number;
}

export const OWNED_HEARTBEAT_MAX_SAMPLES = 120;
const defaultMaxAgeMs = 15 * 60_000;
const isoUtc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function summarizeOwnedDeploymentHeartbeats(
  values: readonly OwnedDeploymentHeartbeat[],
  nowMs: number,
  maxAgeMs = defaultMaxAgeMs,
): OwnedDeploymentHealth {
  if (!Array.isArray(values) || values.length > OWNED_HEARTBEAT_MAX_SAMPLES
    || !Number.isSafeInteger(nowMs) || nowMs < 0
    || !Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1000 || maxAgeMs > 86_400_000) {
    throw new Error('Deployment heartbeat evidence unavailable.');
  }
  const observations: OwnedDeploymentHeartbeat[] = [];
  let lastMs = -1;
  for (const sample of values) {
    if (!sample || typeof sample !== 'object' || Array.isArray(sample)
      || Object.keys(sample).some(key => !['checkedAt', 'outcome', 'latencyMs'].includes(key))
      || typeof sample.checkedAt !== 'string' || !isoUtc.test(sample.checkedAt)
      || !['up', 'down', 'maintenance', 'unknown'].includes(sample.outcome)) {
      throw new Error('Deployment heartbeat evidence unavailable.');
    }
    const timestamp = Date.parse(sample.checkedAt);
    if (!Number.isSafeInteger(timestamp) || timestamp <= lastMs || timestamp > nowMs
      || new Date(timestamp).toISOString() !== sample.checkedAt) {
      throw new Error('Deployment heartbeat evidence unavailable.');
    }
    if (sample.outcome === 'up') {
      if (typeof sample.latencyMs !== 'number' || !Number.isSafeInteger(sample.latencyMs)
        || sample.latencyMs < 0 || sample.latencyMs > 120_000) {
        throw new Error('Deployment heartbeat evidence unavailable.');
      }
    } else if (sample.latencyMs !== undefined) {
      throw new Error('Deployment heartbeat evidence unavailable.');
    }
    lastMs = timestamp;
    observations.push(sample);
  }

  const last = observations.at(-1);
  const successful = observations.filter(item => item.outcome === 'up');
  const failed = observations.filter(item => item.outcome === 'down').length;
  const assessed = successful.length + failed;
  const p95Values = successful.map(item => item.latencyMs!).sort((a, b) => a - b);
  let goodStreak = 0;
  let badStreak = 0;
  for (let index = observations.length - 1; index >= 0; index--) {
    if (observations[index].outcome === 'up' && badStreak === 0) goodStreak++;
    else if (observations[index].outcome === 'down' && goodStreak === 0) badStreak++;
    else break;
  }

  // Stale or inconclusive evidence never declares a deployment healthy.
  const state: OwnedDeploymentHealth['state'] = !last || nowMs - lastMs > maxAgeMs
    ? 'unknown'
    : last.outcome === 'maintenance' ? 'maintenance'
    : last.outcome === 'unknown' ? 'unknown'
    : badStreak >= 3 ? 'offline'
    : goodStreak >= 3 ? 'healthy'
    : 'degraded';

  return {
    state,
    lastCheckedAt: last?.checkedAt ?? null,
    observedChecks: observations.length,
    successfulChecks: successful.length,
    failedChecks: failed,
    inconclusiveChecks: observations.length - assessed,
    observedSuccessPercent: assessed ? Math.round(successful.length / assessed * 10_000) / 100 : null,
    p95LatencyMs: p95Values.length ? p95Values[Math.ceil(p95Values.length * 0.95) - 1] : null,
    consecutiveSuccessfulChecks: goodStreak,
    consecutiveFailedChecks: badStreak,
  };
}
