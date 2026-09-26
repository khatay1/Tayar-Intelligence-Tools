# Full-stack implementation checkpoint

Base: `36adde894332a5d9adea26db2950ccabd34575b1` (latest main fetched 2026-09-26).
Branch: `feat/fullstack-max-20260926`. Do not merge/deploy until the full release criteria pass.

## Evidence-based inventory

| Area | Status | Existing implementation / remaining work |
|---|---|---|
| Visual pages, elements, free positioning, responsive styles, reusable components | NEEDS VERIFICATION | Native operation/command engine and existing design tests; preserve and exercise in full-stack apps. |
| CMS | PARTIAL | `website-cms.ts`: typed fields, references, views, localized entries and materialization. Public content, not a transactional user database. Reuse bindings and UI patterns. |
| Persistence | PARTIAL | Legacy snapshot v6 retained; optional application schema persists in v7 through snapshot, fingerprints and load/reset. Canonical integration envelope now preserves legacy readers. Full-stack runtime lifecycle still incomplete. |
| AI operations | PARTIAL | Existing AI engine now proposes validated application table/auth/permission operations through the same manual command and review path. Runtime actions and full-stack orchestration remain missing. |
| Forms | PARTIAL | Validated public submission endpoint, uploads, leads and email/webhook automations exist. No generated-app data CRUD/action chain. |
| Integrations | PARTIAL | Provider registry, environments, secret reference interfaces and adapter-based dispatcher exist. UI secret writer/test callbacks have no concrete controller implementation; several provider adapters are absent. |
| Secrets | MISSING | No project-scoped persistent secret service connected to builder. Existing interfaces must be extended; never use Tayar billing/AI credentials as generated-app credentials. |
| Generated-app database/auth/roles | PARTIAL | Versioned shared model, RLS SQL, revisioned additive migrations, isolated browser client and PostgreSQL policy tests exist. Automated per-project provisioning, role assignment and published auth/UI are missing. Platform Supabase auth is not a substitute. |
| Generated-app payments | MISSING | Stripe registry entry exists; `websiteBillingService` invokes Tayar subscription billing. Do not reuse it for customers' apps. |
| Actions, variables, backend functions | MISSING | Existing visual interactions and form automations are not a general application action executor. |
| Publishing | PARTIAL | Static site pipeline, versions, rollback, domain and staging configuration exist. No backend deployment/provisioning gate. |
| Full-stack templates and A/B/C test apps | MISSING | Visual templates exist. No proven SaaS/booking/secret API test application. |
| Final E2E / security release | NEEDS VERIFICATION | Existing regression gate is a baseline, not evidence of full-stack runtime completion. |

## Protected reuse points

- `core/editor-native-operation.ts`, `editor-command.ts`, `editor-transaction.ts`: shared manual/AI operation layer.
- `core/editor-project-snapshot.ts`, `editor-max-project-state.ts`, `services/projectCloudService.ts`: persistence lifecycle.
- `core/website-cms.ts`, `editor-ai-cms.ts`: content schema/binding patterns.
- `core/editor-integrations*.ts`, `editor-integration-runtime.ts`: provider, secret references and dispatch boundary.
- `supabase/functions/website-form-submit`: existing form backend; no parallel submission engine.
- Existing publishing services and controller preflight: extend, do not replace.

## Ordered batches

1. IN PROGRESS: integration boundary security and canonical persistence, then versioned application definitions and shared validated operations.
2. MISSING: real isolated app data/auth/permissions execution plus manual Data/Auth editor and AI operations.
3. MISSING: project secret service, REST/backend actions, workflows and bindings using existing integration contracts.
4. MISSING: project Stripe checkout/subscriptions, verified webhooks and storage/email flows.
5. MISSING: full-stack templates, publish/provision gate, end-to-end apps A/B/C, final audit.

## Rules for this branch

- No production deployment during incomplete implementation.
- No placeholder runtime is counted COMPLETE.
- Preserve old project data and identity; reject invalid new operations without partial application.
- Runtime rows, users, secret values and payment records stay outside editable/exported project snapshots.
- Frontend visibility is not backend authorization.
- Verify migrations against an isolated database before any production migration.

## Known execution prerequisites

- Local environment has no `supabase`, `psql`, `docker` or `deno` executable. An isolated Supabase test project is available through the connector for database policy and migration tests; generated app Edge/browser integration tests still need real deployment/configuration.
- Payment E2E needs project-specific Stripe test credentials/webhook delivery; never make live charges to test the builder.
- No genuine user credential is needed for schema/model/pure-runtime implementation; continue that work autonomously.

## Checkpoint 2026-09-26 — foundation (not a full-stack release)

- COMPLETE: integration boundary fixes, canonical/legacy persistence, reject unsupported secret references, mandatory webhook signing, environment opt-out preservation. Commit `9dfe021`.
- COMPLETE: versioned application metadata, strict schema/reference validation, atomic commands using existing transactions/history; captures immutable reviewed plan and approval.
- COMPLETE: snapshot/load/reset integration; legacy projects remain v6; application projects v7; fingerprints include application definitions.
- COMPLETE: fail-closed static publishing gate for configurations requiring a backend that has not been provisioned.
- PARTIAL: manual/AI parity proven at the command layer only. Neither visual Data/Auth panels nor AI service routing is wired yet.
- MISSING: actual generated-app database/auth/runtime/Stripe/secrets service. No feature claimed functional solely from metadata.
- Validation PASS: application foundation regression (including actual loader, history, stale/wrong-project rejection and atomic rollback), existing snapshot regression, integrations regression, full TypeScript, lint on changed TS/TSX, whitespace.
- New foundation regression added to `health:project`. Full health/build/E2E not yet run for this batch.
- Next: wire the shared command layer into existing builder history/controller and Data/Auth editor; implement isolated server enforcement before enabling publishing. Keep runtime rows and secret values outside metadata.
- No merge, production deployment, remote schema migration or user project modification performed.

## Checkpoint 2026-09-26 — Data/Auth editing and reviewed AI plans

- PARTIAL: Settings now exposes a lazy Data/Auth panel using the validated application operations, existing edit history and save fingerprint. Tables, fields, CRUD rules, roles and protected-page definitions are editable as metadata; runtime access remains blocked until actual backend provisioning.
- PARTIAL: existing `ai-engine` plans those same operations; the server response is parsed strictly, dry-run validated through the same command, reviewed in the UI, and checked against project ID, load sequence and definition fingerprint before application. No AI-only project model.
- PASS: mocked AI-engine rejection tests, model/serialization/history tests, integrations regression, reachability, TypeScript, changed-file lint and production Vite build. These do not demonstrate a generated-app runtime.
- NEXT: independent per-app backend identity and row-level enforcement; after isolated SQL/Edge tests, wire project secret storage/API/actions and payments. Production publishing continues to fail closed for configured applications.

## Checkpoint 2026-09-26 — isolated schema draft and form webhook hardening

- PARTIAL: compiled initial SQL for a dedicated generated-app database: typed tables, indexes, references, owner immutability, private role lookup, grants and RLS for read/create/update/delete. This is a schema candidate, not an applied migration or functioning generated backend.
- COMPLETE: existing form webhook delivery refuses missing signing key, unsafe endpoint strings and redirects; failure logs omit network exception details. UI form automation normalizer now uses the same public endpoint preflight.
- PASS: schema security assertions, signed webhook runtime test with injected fetch, existing form regression, edge TypeScript syntax, full app TypeScript and affected lint. Actual Postgres policy tests are NOT available in this branch yet.
- BLOCKED: Supabase development branch creation returned `PaymentRequiredException` (current organization free plan). Read-only cost query says a separate project is $0/month, but the Supabase connector explicitly requires the user to choose its organization before project creation. No production SQL, deployment, migration or production branch change was performed.
- NEXT: obtain an isolated Postgres project, run generated SQL in a transaction, test authenticated/anonymous/owner/role CRUD and cross-app isolation, then connect migration/provisioning and runtime. The browser/server publishing gate stays closed until that is complete.

## Checkpoint 2026-09-26 — real isolated PostgreSQL validation

- Dedicated free test project `sgewokeojtzsqjaeluan` created in the user-selected Tayar Tools organization; Tayar production project `pnbllxdlskljcakyaylt` was not mutated.
- PASS: generated booking schema applied to PostgreSQL 17, then improved after Supabase security/performance advisors and applied again. Disposable fixture includes vehicles, bookings and a private manager role table.
- PASS: SQL transaction tests for unauthenticated visitor, owner, manager, unrelated authenticated user and Supabase anonymous sign-in; verified read/write denial, owner spoofing prevention, role-only delete, public inventory and rollback. Durable test script: `scripts/fixtures/application-booking-rls.sql`.
- PASS: final advisors no generated-schema security warnings; only INFO `private.app_user_roles` deliberately lacks direct-access policies and `unused_index` on tiny test data. The test project's account setting warns leaked-password protection is disabled; production app configuration must enable it.
- PARTIAL: the SQL compiler is a validated *initial* schema, not an incremental migration/provisioner. Generated-app auth frontend, page enforcement, production publishing, secret store, payments and integrations remain unimplemented. Publishing gate stays closed.
- NEXT: implement isolated per-app backend provisioning and client/server runtime; exercise complete application A/B/C before release. Keep test project separate from Tayar infrastructure.

## Checkpoint 2026-09-26 — additive application schema upgrades

- PARTIAL: shared SQL compiler now accepts a previously deployed definition and a next definition. It adds tables, fields, indexes and cross-table references, and atomically replaces changed RLS grants/policies. It refuses removed/reordered/changed fields or tables, auth/role changes, and required fields lacking a safe default on existing data.
- PASS: local no-op/addition/revocation/destructive-change regression and full TypeScript. Applied the generated upgrade to the isolated test project with two existing bookings and one vehicle. Existing records survived with default status, a new location table/reference was created, and the removed manager delete grant/policy was denied by PostgreSQL. `scripts/fixtures/application-booking-upgrade.sql` preserves the transaction test.
- PASS: final Supabase advisors show no generated-schema security or performance warnings. INFO private role table intentionally has no direct RLS policy; unused indexes reflect the tiny fixture. Separate test-project leaked-password-protection setting remains WARN.
- IMPORTANT: the first database upgrade attempt used a different table order than the *deployed* initial definition and failed atomically; no data changed. Provisioning must retain the exact deployed definition/identity, verify current schema revision before applying a migration, and serialize deployment. The SQL compiler is not yet a trusted provisioner.
- MISSING: app backend provisioning, runtime CRUD/auth/page protection, secrets, Stripe, workflows, bindings and full-stack publishing; the release gate remains closed.
- The initial schema now stores the exact validated definition in a private, ungranted revision table. An additive upgrade locks and checks that revision, then updates it in the same database transaction. Recreated the fixture, verified a stale definition fails before DDL with both original bookings intact, applied the correct upgrade, and confirmed replay fails before DDL. Role/RLS tests and the upgrade fixture passed again.
- Applied a second additive upgrade using the row-lock revision guard on the same isolated PostgreSQL project; both bookings, inventory, and the revoked delete policy retained the expected state.

## Checkpoint 2026-09-26 — isolated app browser data client

- PARTIAL: added a small generated-app Supabase client factory with a dedicated project identity check, separate auth storage, public-key-only validation and no Tayar platform client import. Its data runtime accepts only declared tables and fields, applies bounded pagination, and uses the app project's RLS-backed CRUD endpoint. Basic app auth methods use the same isolated client.
- PASS: regression rejects platform backend reuse, mismatched refs, insecure URLs, service role/secret keys, system-field writes and unknown tables, then verifies the REST request targets the isolated app endpoint. TypeScript and affected lint pass. The test mocks HTTP; it does not prove a published app login or CRUD browser flow.
- Legacy anon JWTs must also carry the matching project ref and Supabase issuer; an anon key from Tayar's platform project is rejected even though it has the public `anon` role.
- Full `health:project` suite and Vite production build passed at this checkpoint. These gates cover existing Tayar behavior but cannot certify unfinished full-stack runtime features.
- MISSING: backend provisioning and verified public config persistence, role assignment service, page route guard, dynamic component bindings, production publish integration. The fail-closed publish gate remains in effect.

## Checkpoint 2026-09-26 — additive app roles

- PARTIAL: additive schema upgrades now accept appended role definitions. When adding the first role, they create the existing private role table and lookup function; later role additions only update the guarded schema revision and affected RLS policies. Removing, reordering or altering existing roles still requires a separately reviewed migration.
- PASS: PostgreSQL transaction test for adding the first role to a no-role app, with private table inaccessible to the browser role; rollback restored the existing booking fixture. A subsequent committed upgrade appended `Staff` to the booking app. `scripts/fixtures/application-role-upgrade.sql` proves unassigned users cannot update inventory, assigned Staff can, and neither can change record ownership. Advisor reports no new generated-schema security findings.
- MISSING: safe privileged role assignment/bootstrap service and UI; service-role-only fixture setup is test scaffolding, not a production role management feature.
