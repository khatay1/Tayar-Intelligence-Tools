# Tayar Fullstack MAX — remaining work after source consolidation

Updated 2026-09-28. Earlier foundations are consolidated on main; ongoing work now lives on `internal-fullstack-max-continue-20260927` by explicit owner request. Read FULLSTACK_MAX_HANDOFF.md first. Integration is not production activation or completion of MAX.

## Implemented foundations to preserve

- Shared validated application model and atomic manual/AI operations, Data/Auth editor, persistence and history compatibility.
- Dedicated application database schema compiler, guarded additive upgrades, RLS and role administration primitives, tested in an isolated PostgreSQL transaction with rollback.
- Dedicated browser Auth/data client, bounded queries and server authorization before protected HTML reads.
- Owner-scoped backend linking, encrypted credential custody, schema/Auth preflight and revision binding.
- Private immutable release storage, trusted rendering, whole-snapshot comparison, atomic activation, uncertain-commit reconciliation and read-only release status UI.
- Isolated-origin session cookie adapter, browser synchronization and per-project release URL derivation. These are opt-in foundations; they are not wired into a fully deployed generated application.
- Project secret Vault/owner RPC foundation and integration scope checks. The complete secret-management UI and execution path remain unfinished.

## Remaining delivery order

| Priority | Workstream | Concrete remaining work / completion evidence |
|---|---|---|
| 1 | Published authentication and navigation | A trusted isolated account shell now provides login/signup/reset/recovery/logout flows, with mocked tests. Authorized isolated page responses now embed the runtime/account controls and synchronize ordinary internal navigation; synchronize refresh and protected navigation; expose role administration safely. Verify direct links, reloads, multiple tabs, expired sessions and revoked permissions in a real browser. |
| 2 | Live isolated backend and host lifecycle | Connect creation/preparation of per-app backends and controlled schema upgrades; configure isolated app DNS/hosting/routing and Auth redirect/email delivery; verify linking and credential rotation against a live test deployment. Existing linking assumes a prepared backend. |
| 3 | Data-driven UI and application actions | Bind visual components, lists and forms to declared app tables; implement CRUD actions, variables, action sequences and server functions through the shared manual/AI operation path. Prove persisted data and permission behavior end to end. |
| 4 | Secrets and integrations | Connect secret-management controls to the existing project Vault boundary; implement server execution, REST/provider adapters, email/storage flows, safe errors, timeouts/retries and environment isolation. Never expose service keys to generated HTML or use Tayar's own credentials for customer apps. |
| 5 | Application payments | Add each application's Stripe test configuration, checkout/subscriptions, verified idempotent webhooks and entitlement updates. Exercise successful/failed/canceled payments and replayed events. Tayar platform billing is separate. |
| 6 | Complete private publishing lifecycle | Add publish UI only after prerequisites pass; implement rate/concurrency/idempotency controls, controlled removal of legacy public copies, private rollback/pruning, CMS dynamic-route permission mapping and recovery workflows. Audit privileged storage writers. |
| 7 | Templates and final release proof | Build and exercise A/B/C reference apps (SaaS, booking, secret API/integration); verify manual/AI parity, AR/SV/EN, desktop/mobile, existing builder regressions, security, isolation, backup/recovery and full live browser/API/database/payment flows. |

These are substantial workstreams, not seven small fixes. Existing visual editing, CMS, static publishing and other earlier MAX features should be reused rather than rebuilt.

## Deployment state and limitations

- Vercel Git auto-deployment for main is disabled for the requested source integration. Restore deliberately when a verified production release is intended.
- Runtime, release and browser-session flags stay disabled by default. Do not enable merely because source is on main.
- SQL migrations and Edge endpoints are stored in the repository; this integration does not apply/deploy them remotely.
- Isolated SQL validation is real and rolled back. Current session/release HTTP regressions mock transport; browser bridge tests simulate locking. They do not establish deployed full-stack E2E correctness.
- Full project health and production build passed during the preceding implementation checkpoint. Integration checks are recorded separately in FULLSTACK_MAX_STATUS.md.
