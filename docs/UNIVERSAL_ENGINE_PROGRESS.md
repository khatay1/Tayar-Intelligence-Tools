# Universal engineering platform — verified checkpoint

## Scope and sequencing

Continue the existing engine; do not create sector-specific replacement engines.
Customer credentials/live provider activation stay last. Social Hub stays on
`deferred/social-hub-foundation-20261011`; preserve that branch.

## Phase zero — 2026-10-11

Inspected GitHub once: main `4ebd186afa8427c5ac2989df7e6b4f3814b14858`,
open PR #146 head `b1d326665f43f5e15e0bbfd9817990ab6fc1de3b`.

- PR Release Gate 38162235711 failed because the owned runtime template was
  stale. Regenerated it from its trusted source with the repository builder,
  then regenerated the dependent BYO publish Edge bundle. Both consistency
  checks now pass; browser runtime, backend-link and release bundles also match.
- Main Release Gate 38158241853 failed with `Error: RUNNING`: Chrome dump-dom
  returned before async browser assertions completed. The browser regression
  now posts its terminal assertion result to the loopback fixture server. The
  runner waits with a 35-second wall-clock deadline and rejects browser crashes,
  timeouts and FAIL results. Cleanup handles signal exits and open connections.
- Targeted generation, data-view, owned-source, owned-runtime-binding and BYO
  Edge regressions passed. Focused ESLint and whitespace checks passed.
- A local real Chromium attempt was blocked by the execution environment's
  Unix-socket restrictions (`socket() failed: Operation not permitted`). This
  is NOT a passing browser check. Required real-browser verification is in CI.
- Release Gate for the repaired PR is pending. Do not merge until it passes.

## Infrastructure observations (not activation claims)

- Vercel production project `prj_Va68HaopapL5mCzXkQsnJ7X7Kr7V`, team
  `team_dxtUwkdzIKpmkmE2GFEaMWn1`: READY deployment
  `dpl_Hh5UVVH12dSfAV3cgxBnGcn8hrCo` is commit
  `22e528a8c22572d170cc1e6d40186e94a57fb40b`, older than main. Update only
  after the corrected release passes; verify staged deployment before promotion.
- Supabase platform project `pnbllxdlskljcakyaylt`: 6 anonymous and 45
  authenticated SECURITY DEFINER execution notices, 16 uncovered foreign keys,
  31 unused-index informational notices. These counts are not proof of a
  vulnerability. Inspect bodies/callers and preserve intended access.
- Live catalog confirms explicit role grants (no PUBLIC EXECUTE) and fixed
  search paths on the exposed functions. Most authenticated entry points have
  identity/role guards; delegated wrappers require following their callees.
  Public signup status and published-site ingestion/resolution have intentional
  anonymous callers. Review authorization and published-site checks before
  changing them; do not indiscriminately revoke access or disable RLS.
- `website_publish_scheduler_ready()` currently returns constant false under
  SECURITY DEFINER; no elevation is required for that constant. Prepare an
  invoker migration with privilege/readiness regression coverage.
- Leaked-password protection is disabled. Supabase organization
  `vpdokchxxttciydfbbcw` is Free; official password-security documentation
  requires Pro or above. No billing change is authorized/performed. Activation
  requires an owner plan decision and a supported Auth configuration connection.
  Reference: https://supabase.com/docs/guides/auth/password-security
- Advisor references: https://supabase.com/docs/guides/database/database-linter

## Next action

Run Release Gate on the repaired PR head and merge only when successful.
Then finish the scoped database advisor review/index migration and verify
production freshness before any Universal Engine expansion. Inspect existing
specification, workflow, generation, coverage and isolated execution modules
first; extend only missing capabilities. Record each verified batch here.

## Completion boundary

Universal phases 1–7 are not yet certified; no universal-generation, secure
custom execution, live-provider or final production readiness claim is made.
