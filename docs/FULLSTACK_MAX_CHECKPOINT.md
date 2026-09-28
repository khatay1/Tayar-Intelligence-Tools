# Fullstack MAX — canonical BYO checkpoint

Updated: 2026-09-28. Branch: `internal-fullstack-max-continue-20260927`. HEAD: the latest commit on this branch containing this checkpoint; starting baseline was `d166683`. Always fetch the branch before continuing. `main`, production deployment, migrations and flags remain unchanged.

## Architecture decision

Tayar builds and edits applications. The customer owns the GitHub repository, Supabase backend, Vercel hosting, domain, Stripe account and other runtime services. Published applications must keep running without an active Tayar subscription. Tayar's platform credentials, billing, Supabase and Vercel projects must not become default customer runtime infrastructure. OAuth grants and runtime secrets stay outside editable project snapshots and generated source.

## Phase 1 reconciliation

| Classification | Existing work | BYO action |
| --- | --- | --- |
| Reusable | `application-model`, shared validated manual/AI operations, project history, schema/RLS compiler, dedicated Auth/data browser client, request ledger, form mappings, trusted renderer, revision digests and integration definitions | Keep one application definition and one operation/history path for AI and manual changes. Export the runtime to customer-owned accounts. |
| Needs adaptation | `websiteApplicationBackendService`, backend binding/credential custody, private release service, isolated host/session routes, publishing UI, project Vault, integration execution | Bind verified customer Supabase identity and revision; use customer Vercel/GitHub target; hand off secrets to customer runtime; reconcile remote deployment and ownership. Keep current publish gates closed. |
| Managed-runtime assumption to retire only after replacement | Tayar Storage bucket `website-application-releases`, Tayar Edge published route and the `private_runtime_enabled` activation path as the final customer host | Preserve for legacy releases while present. Do not delete until dependency search, BYO replacement, regression and migration/compatibility proof are complete. |

No-repeat: do not rebuild the model, editor operations, history, schema compiler, RLS, browser Auth/data client, request identity or private rendering. Existing mocked tests are foundations, not live BYO proof.

## Completed

- Historical Fullstack MAX foundations through branch baseline `d166683` remain intact; see `FULLSTACK_MAX_HANDOFF.md` for detailed historical evidence.
- Phase 1 architecture classification and ownership decision are recorded here.
- Phase 2 has a server-owned connection contract for GitHub, Supabase, Vercel, Stripe and external providers: owner/project/account/environment identity, permissions, status, version, operation nonce, verified timestamp and stale-response checks. A private platform registry migration adds a service-role-only version-guarded writer and owner-scoped read RPC. An owner reader drops undeclared payload fields and rejects cross-project, stale, malformed and duplicate responses. The migration is source only; OAuth provider adapters and token custody remain unimplemented.

## Verified

- BYO contract regression checks wrong owner/project/account, stale version and operation, false ready state, repeated completion, disconnect and secret-shaped account IDs. Owner-reader regression uses mocked RPC and checks scoped response handling. TypeScript passed.
- The migration was run only inside rolled-back transactions on `Tayar Fullstack MAX Validation` with a disposable `public.projects` fixture: service-role insert and guarded update, stale-version refusal, owner projection, other-owner refusal and authenticated write denial passed. A post-rollback query found neither fixture table. This is isolated PostgreSQL proof, not a platform migration or live OAuth proof.
- Earlier Vault inventory checks used mocked RPC, not a live customer account.

## In progress

- Phase 2 trusted OAuth/installation identity verification and token custody. The connection status UI must read server-owned records, never editable snapshot claims.

## Remaining

1. Finish Phase 2: trusted provider identity verification, encrypted token custody/rotation/revocation, disconnect and stale operation recovery on the private registry.
2. Phase 3: customer GitHub choose/create, export/update with repo/branch/commit guards and reconciliation.
3. Phase 4: customer Supabase choose/create, schema/RLS/Auth/Storage/functions lifecycle and safe revision upgrades.
4. Phase 5: customer Vercel team/project/env/deployment/domain lifecycle with observed readiness.
5. Phases 6–9: secret handoff, application runtime, payments/integrations and resumable publish orchestration.
6. Phases 10–11: user-owned validation A/B/C applications and real browser E2E, recovery, republish and exit independence.

## Tests still mocked / live E2E pending

No GitHub OAuth/installation, Supabase account ownership, Vercel team ownership, Stripe checkout, BYO secret transfer or BYO deployment is proven. Existing isolated database rollback tests prove older schema/RLS foundations only. Real browser sign-in, form submission and full customer-account deployment remain pending.

## Files changed in the latest batch

`docs/FULLSTACK_MAX_CHECKPOINT.md`, `docs/FULLSTACK_MAX_HANDOFF.md`, `package.json`, `src/modules/website-builder/core/application-infrastructure-connections.ts`, `src/modules/website-builder/services/websiteInfrastructureConnectionClient.ts`, `supabase/migrations/20260928205027_website_byo_infrastructure_connections.sql`, `scripts/application-infrastructure-connections-regression.mjs`, `scripts/website-infrastructure-connection-client-regression.mjs`.

## Next exact batch

Add a trusted GitHub installation/account adapter on this registry: verify the current user's grant and repository ownership/permissions against GitHub, keep tokens in separate short-lived custody, and do not mark ready until the target is observed. Add a read-only connection status surface only after the trusted adapter is wired. Keep Supabase/Vercel adapters and publish gates closed until their own verification exists.

## Known blockers

- The current isolated validation Supabase project does not have Tayar's `public.projects` table; the new migration was tested with a rolled-back fixture, but actual platform integration is still unproven. Never apply it to production during this branch work.
- Customer OAuth grants and live provider accounts are not yet configured. Do not mark a connection ready from a UI click or a mocked 200 response.
