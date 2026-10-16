import assert from 'node:assert/strict';
import {
  summarizeOwnedDeploymentHeartbeats as summarize,
  OWNED_HEARTBEAT_MAX_SAMPLES,
} from '../server/website-owned-uptime-evidence.ts';

const start = Date.parse('2026-10-16T12:00:00.000Z');
const at = (offset) => new Date(start + offset * 60_000).toISOString();
const up = (offset, latencyMs = 30) => ({ checkedAt: at(offset), outcome: 'up', latencyMs });
const down = offset => ({ checkedAt: at(offset), outcome: 'down' });
const unknown = offset => ({ checkedAt: at(offset), outcome: 'unknown' });
const maintenance = offset => ({ checkedAt: at(offset), outcome: 'maintenance' });
const now = start + 10 * 60_000;

assert.deepEqual(summarize([], now), {
  state: 'unknown', lastCheckedAt: null, observedChecks: 0,
  successfulChecks: 0, failedChecks: 0, inconclusiveChecks: 0,
  observedSuccessPercent: null, p95LatencyMs: null,
  consecutiveSuccessfulChecks: 0, consecutiveFailedChecks: 0,
});

const normal = Object.freeze([up(1, 30), up(2, 10), up(3, 100)]);
const healthy = summarize(normal, now);
assert.equal(healthy.state, 'healthy');
assert.equal(healthy.consecutiveSuccessfulChecks, 3);
assert.equal(healthy.p95LatencyMs, 100);
assert.equal(healthy.observedSuccessPercent, 100);
assert.equal(healthy.observedChecks, 3);
assert.equal(healthy.lastCheckedAt, at(3));
assert.deepEqual(normal, [up(1, 30), up(2, 10), up(3, 100)], 'no mutation');

const failing = [up(1, 10), down(2), down(3)];
assert.equal(summarize(failing, now).state, 'degraded');
const offline = summarize([...failing, down(4)], now);
assert.equal(offline.state, 'offline');
assert.equal(offline.consecutiveFailedChecks, 3);
assert.equal(offline.observedSuccessPercent, 25);
assert.equal(offline.p95LatencyMs, 10);
assert.equal(summarize([...failing, down(4), up(5)], now).state, 'degraded',
  'first recovery cannot immediately declare service healthy');
assert.equal(summarize([...failing, down(4), up(5), up(6), up(7)], now).state, 'healthy');
assert.equal(summarize([up(1), up(2), up(3)], start + 31 * 60_000).state, 'unknown',
  'stale passing observations must never be reported as healthy');

assert.equal(summarize([up(1), maintenance(2)], now).state, 'maintenance');
assert.equal(summarize([up(1), unknown(2)], now).state, 'unknown');
assert.equal(summarize([unknown(1), maintenance(2)], now).observedSuccessPercent, null);
assert.equal(summarize([unknown(1), up(2), down(3), maintenance(4)], now).inconclusiveChecks, 2);
assert.equal(summarize([up(1), up(2), down(3)], now).observedSuccessPercent, 66.67);

for (const invalid of [
  null, {}, 'up', new Array(OWNED_HEARTBEAT_MAX_SAMPLES + 1).fill(up(1)),
  [up(2), up(1)], [up(1), up(1)], [up(11)],
  [{ checkedAt: '2026-02-30T12:00:00.000Z', outcome: 'up', latencyMs: 10 }],
  [{ checkedAt: '2026-10-16T12:00:00+00:00', outcome: 'up', latencyMs: 10 }],
  [{ checkedAt: at(1), outcome: 'down', latencyMs: 10 }],
  [{ checkedAt: at(1), outcome: 'up' }],
  [{ checkedAt: at(1), outcome: 'up', latencyMs: -1 }],
  [{ checkedAt: at(1), outcome: 'up', latencyMs: 120001 }],
  [{ checkedAt: at(1), outcome: 'up', latencyMs: '12' }],
  [{ checkedAt: at(1), outcome: 'successful', latencyMs: 5 }],
  [{ checkedAt: at(1), outcome: 'up', latencyMs: 5, source: 'client' }],
]) assert.throws(() => summarize(invalid, now), /evidence unavailable/);

for (const [time, age] of [[NaN, 15000], [start, 0], [now, 999], [now, 86400001]]) {
  assert.throws(() => summarize([up(1)], time, age), /evidence unavailable/);
}

const many = Array.from({ length: OWNED_HEARTBEAT_MAX_SAMPLES }, (_, n) => up(n, n));
assert.equal(summarize(many, start + 120 * 60_000).p95LatencyMs, 113,
  'nearest-rank p95, no unbounded input processing');
console.log('PASS bounded owned deployment heartbeat evidence, recovery, stale refusal, status and latency summaries');
