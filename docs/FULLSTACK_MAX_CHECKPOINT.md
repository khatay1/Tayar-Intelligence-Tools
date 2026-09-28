# Fullstack MAX — canonical BYO checkpoint

Updated: 2026-09-28. Branch: `internal-fullstack-max-continue-20260927`. HEAD: the latest commit on this branch containing this checkpoint; Phase 2 registry checkpoint is `b50877a`. Always fetch the branch before continuing. `main`, production deployment, migrations and flags remain unchanged.

## Architecture decision

Tayar builds and edits applications. The customer owns the GitHub repository, Supabase backend, Vercel hosting, domain, Stripe account and other runtime services. Published applications must keep running without an active Tayar subscription. Tayar's platform credentials, billing, Supabase and Vercel projects must not become default customer runtime infrastructure. OAuth grants and runtime secrets stay outside editable project snapshots and generated source.

User flow after building: an **Infrastructure** step shows Connect GitHub, Connect Supabase and Connect Vercel (plus optional Stripe/providers), then guided account/project selection and verified readiness. Tayar handles Git, SQL, environment settings and deployment internally. A connection button is enabled only when its real server callback exists; a successful click alone never sets Connected. Runtime charges belong to each customer account.

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
- Phase 3 has a pure GitHub target/export guard: it requires a matching observed installation account, immutable repository ID, repository owner, selected installation access and write permission. It checks branch/head, project, connection version and source digest before planning an export. It does not call GitHub, write a repository or mark a deployment successful.
- A server-only GitHub App user-grant verifier now checks the installation through the user-scoped installations API, then checks the selected repository through that installation. It requires Contents write, user push permission, matching account/repository identity and an active repository. The setup URL's installation ID is treated as untrusted. The user token stays request-local. OAuth code exchange, one-time state, custody and a deployed callback still need implementation.

## Verified

- BYO contract regression checks wrong owner/project/account, stale version and operation, false ready state, repeated completion, disconnect and secret-shaped account IDs. Owner-reader regression uses mocked RPC and checks scoped response handling. TypeScript passed.
- The migration was run only inside rolled-back transactions on `Tayar Fullstack MAX Validation` with a disposable `public.projects` fixture: service-role insert and guarded update, stale-version refusal, owner projection, other-owner refusal and authenticated write denial passed. A post-rollback query found neither fixture table. This is isolated PostgreSQL proof, not a platform migration or live OAuth proof.
- GitHub target/export guard regression uses fixture observations for wrong account/repository, revoked permission, branch drift and stale connection. TypeScript passed. GitHub's own documentation says installation repository access and Contents write permission must be checked, and ref updates must avoid force when guarding fast-forward changes; no live GitHub write was attempted.
- GitHub verifier regression uses mocked HTTP for valid installation/repository, missing installation, read-only/suspended grant, wrong owner, absent push access, archived repo and error masking. TypeScript and ESLint passed. No live OAuth or GitHub API call was made.
- Earlier Vault inventory checks used mocked RPC, not a live customer account.

## In progress

- Phase 2 trusted OAuth/installation identity verification and token custody, then Phase 3 provider adapter and repository write/reconciliation. The connection status UI must read server-owned records, never editable snapshot claims.

## Remaining

1. Finish Phase 2: trusted provider identity verification, encrypted token custody/rotation/revocation, disconnect and stale operation recovery on the private registry.
2. Phase 3: customer GitHub choose/create, export/update with repo/branch/commit guards and reconciliation.
3. Phase 4: customer Supabase choose/create, schema/RLS/Auth/Storage/functions lifecycle and safe revision upgrades.
4. Phase 5: customer Vercel team/project/env/deployment/domain lifecycle with observed readiness.
5. Phases 6–9: secret handoff, application runtime, payments/integrations and resumable publish orchestration.
6. Phases 10–11: user-owned validation A/B/C applications and real browser E2E, recovery, republish and exit independence.

## Tests still mocked / live E2E pending

No live GitHub OAuth/installation, Supabase account ownership, Vercel team ownership, Stripe checkout, BYO secret transfer or BYO deployment is proven. The GitHub verifier has mocked HTTP only. Existing isolated database rollback tests prove older schema/RLS foundations and the source-only BYO registry, not production account connections. Real browser sign-in, form submission and full customer-account deployment remain pending.

## Files changed in the latest batch

Latest GitHub verifier batch: `docs/FULLSTACK_MAX_CHECKPOINT.md`, `package.json`, `src/modules/website-builder/services/websiteGithubInstallationService.ts`, `scripts/website-github-installation-regression.mjs`. Earlier GitHub guard batch: `src/modules/website-builder/core/application-github-target.ts`, `scripts/application-github-target-regression.mjs`. BYO registry batch: `src/modules/website-builder/core/application-infrastructure-connections.ts`, `src/modules/website-builder/services/websiteInfrastructureConnectionClient.ts`, `supabase/migrations/20260928205027_website_byo_infrastructure_connections.sql`, `scripts/application-infrastructure-connections-regression.mjs`, `scripts/website-infrastructure-connection-client-regression.mjs`.

## Next exact batch

Add one-time OAuth state and a trusted GitHub App code-exchange callback bound to the currently authenticated Tayar owner/project. Feed its user token only into the server-side verifier, then save the observed installation/repository in the private connection registry under CAS. Mint installation tokens on demand for export; perform a non-force branch update with uncertain-commit reconciliation and a durable repository/branch cursor. Only then expose a working Connect GitHub button and server-backed status. Keep Supabase/Vercel adapters and publish gates closed until their own verification exists.

## Known blockers

- The current isolated validation Supabase project does not have Tayar's `public.projects` table; the new migration was tested with a rolled-back fixture, but actual platform integration is still unproven. Never apply it to production during this branch work.
- Customer OAuth grants and live provider accounts are not yet configured. Do not mark a connection ready from a UI click or a mocked 200 response.
- A GitHub App registration (App ID, callback URL, private key and minimum Contents write permission) is needed before a live one-click connection can be verified. Its credential belongs in Tayar platform secrets, never the generated project. The UI must not offer a pretend Connected state while the callback is absent.
