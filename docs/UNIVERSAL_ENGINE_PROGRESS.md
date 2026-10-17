# Universal engineering platform — verified checkpoint

## Current continuation checkpoint — 2026-10-16

- Verified merged baseline `main` is `55bc778ddea8e32ca1cbbe582443eb7c131d0cfa` (PR #251). Exact head `05bd3721947473946c3ac6f7cd63a0297569946e`, tree `253f6147b2fdbf06a52e3c929626509a19c5b20a`, passed Release Gate `38888520453`, including actual isolated PostgreSQL source/Production-receipt tests. Vercel Preview was READY and its authenticated root returned HTTP 200. Post-merge main gate must be checked separately. PRs #242–#251 are merged; do not repeat them. Customer/provider activation remains deferred.
- PR #214 was closed without merging: its custom-source specification, coverage, immutable release resolver and focused regressions already landed in `7ae9983`; those source/test files match the old branch. Its branch remains retained. Other old open PRs are not approved for integration; preserve the deferred Social Hub branch.
- PR #146 remains merged; the original owned-runtime staleness and application data-view browser regression were repaired and its Release Gate passed. No recurrence was found in the latest verified gates.
- The last recorded Production deployment is READY at `ab55075ea6f8ebd09b71994a0e631efe12e96024`, behind `main`. Production promotion and runtime/custom-execution activation remain deferred; no external production changes were made in this session.
- PR #230 displays bounded custom-operation JSON results in an accessible collapsible panel using a `textContent` sink. Generation/reference-project, custom-operation flow/client/runtime, TypeScript, scoped ESLint, generated-artifact consistency and whitespace checks passed before merge. Generated Edge bundles were restored from trusted sources after the PR gate found stale copies.
- Existing operation authorization, immutable release resolution, quota reservation/finalization and one-shot no-network Node 22 sandbox are implemented. Custom functions still cannot claim database transactions or use external credentials. A successful isolated run does not prove a complete customer application or external services are ready.
- Seven synthetic reference-project fixtures and native transactional workflow/counter regressions already exist; do not recreate them without an affected-code reason. Organization/branch tenancy remains fail-closed until membership isolation is implemented.
- Supabase advisor findings last checked 2026-10-14 remain unchanged: reviewed SECURITY DEFINER/private-RLS boundaries should not be blanket-revoked; unused-index notices need representative workload; leaked-password protection was unavailable on the current Free plan. No live DB/Auth/billing changes were made.
- The post-merge main Release Gate initially failed in Website Builder browser regression: the shell was not ready within 10 seconds and cleanup raced Chrome profile subprocesses (`ENOTEMPTY`). PR #232 increased the shell wait and now terminates detached browser/server process groups before removing profiles. Its PR browser regression passed; post-merge main Release Gate `38735797782` passed. Local browser execution remains unavailable here because Chrome/Chromium is absent.
- PR #235 added the closed `form-values` acceptance-test protocol. It executes the current form compiler/converter, checks expected mapped output or rejection, rejects credential-like fixtures, and never claims a database write.
- PR #236 added `workflow-transition`, checking only whether a declared model permits or rejects a transition from an enum state and destination; it does not execute authorization, conditions, SQL effects or persistence. Its first Release Gate exposed stale generated bundles; the corrected runtime, BYO Publish, backend-link and release chain was regenerated with the locked toolchain and verified by the passing PR and main gates.
- PR #237 added `page-access` acceptance tests against the shared pure page-policy function for synthetic authenticated, roleless and anonymous principals. These checks do not prove login, server authorization or route delivery. Project-specification and requirement-coverage regressions, application-generation smoke, TypeScript, scoped ESLint, the application data-runtime regression, generated runtime/browser/Edge bundle checks and `git diff --check` pass locally. Authentication identity, persistence, integrations and external services still need their own executable evidence; delivery remains blocked until each criterion has a passing supported test. Production/customer-service activation stays in the final phase.

## Private Production source target selection — active follow-up

- Production source preparation now selects both GitHub environment connections and the Production Vercel target through the existing service-only PostgreSQL projection. The high-level preparation API accepts project/owner/operation scope and expected Preview source, not provider connection IDs. The existing compiler/capture/export/checkpoint chain is reused.
- A forward-only projection extension returns Production GitHub metadata only when its owner/project/environment and verified repository/account match Preview. Production source requires both Production GitHub and Vercel targets. Older projections without the new field normalize it to null, so ordinary Preview keeps working while Production source preparation stays unavailable until its migration/connection exists. No browser endpoint or production activation action was added.
- The projected identities/versions are rechecked alongside compiled source scope before export and checkpoint completion. Missing, mismatched, stale or revoked targets refuse export; changes after export preserve its exact SHA with `recovery-required`. No provider grant or source body appears in projected metadata.
- Local target/source composition, runner, TypeScript, scoped ESLint, generated artifact and whitespace checks passed. The existing dedicated PostgreSQL fixture adds actual projection-migration checks for matching targets, wrong repository/account/owner, revoked GitHub, incompatible hosting custody and service-only access. Exact-head database/Release Gate and platform Preview remain required before merge; no live migration/provider request was made.
- Resume after this PR passes: continue the controlled non-activating Production deployment claim/creation/observation and production attempt/promotion receipt integration. Customer source/runtime/behavioral/provider evidence, migration replay ordering, final activation and Social Hub remain open.

## Production-only backend receipt isolation — PR #251 merged

- PR #251 first gate exercised valid/stale receipt paths and correctly refused changing a verified historical operation. Its regression expectation now requires that same-operation refusal; a distinct operation may claim preparation/rotation, retaining old environment IDs for cleanup. No receipt immutability or runtime guard was weakened. The corrected exact head passed Release Gate `38888520453` before merge.

- The existing Production public-runtime preparation helper now requires the separately verified Production binding/Supabase connection and its exact Production Vercel version/account. Preview bindings and foreign Vercel accounts fail before any RPC/provider effect. The provider request contains only the dedicated Production public backend pair, never a copy of Preview values. Invocation/activation approval is not granted by this helper.
- A new forward-only source migration reuses the existing receipt claim, rotation, cleanup, commit and lost-response reconciliation functions. A shared private current-scope proof checks the Production binding/key digests, distinct current Preview database, saved application, current registry versions, matching repository/host account and unexpired Vercel custody. Begin, commit and reconcile all apply that proof, so historical Preview-backed Production receipts cannot be recovered as valid. Empty/duplicate environment-ID objects are refused.
- The local existing environment regression checks separate values, Preview/foreign-account refusal and the existing one-shot write/cleanup/lost-response behavior. The existing isolated PostgreSQL fixture is extended using actual historical receipt-table/rotation DDL and the new migration; it tests valid claims/commits/retries, stale bindings/leases/repository/definition, bad IDs and historical receipt refusal. Actual isolated PostgreSQL and full Release Gate `38888520453` passed before merge; no live migration or provider call was performed.
- Remaining: integrate private Production targets, controlled staged-deployment creation/observation, production-only secret/provider receipts and source/runtime/behavioral proof before approved final activation. Existing legacy Preview-promotion entry remains blocked; do not weaken that guard or environment isolation. Migration replay ordering, live customer evidence and Social Hub remain deferred.
- Resume: verify this PR's exact-head PostgreSQL/Release Gate and platform Preview, then continue the staged deployment handoff and production attempt/promotion receipt integration. Do not activate customer Production or apply historical migrations without the separate required approval.

## Durable Production source checkpoint — PR #250 merged

- PR #250 first-head isolated PostgreSQL test passed. The later existing booking setup failed because it unconditionally creates cluster-global roles. The new dedicated-database step now runs after booking initializes those shared roles; no existing booking assertion or production permission was changed. The corrected exact head passed Release Gate `38883504274` before merge.

- The source-only preparation adapter now persists an immutable private handoff after the existing GitHub export cursor proves the exact Production source/commit. It records only digests, identifiers and version metadata, and says `source-prepared`; it grants no deployment, runtime, behavior, promotion or delivery approval. No new public publishing endpoint was added.
- Existing saved project, Preview coordinator, export cursors, runtime bindings and connection records are reused. PostgreSQL independently checks both environments, the same repository/account and Vercel project/account, distinct Supabase projects, the exact ready Preview and saved specification. Every read rechecks the captured content fingerprint and dependency versions. Changed/revoked/deleted/foreign scope returns no usable handoff, and an old operation cannot be overwritten.
- The server reconciles exact committed metadata after response loss, avoids repeat writes on an exact retry and rejects conflicting or extra secret fields. Failed/stale checkpoint completion preserves the exported head with `recovery-required`. No provider grants, backend keys, source files or duplicate project snapshot are stored in the new table.
- Local composition/checkpoint regressions, project TypeScript, focused ESLint, generated bundle, historical-source-map and whitespace checks are required. The new dedicated local PostgreSQL CI test applies the actual registry/cursor/binding/checkpoint migrations and checks source immutability, stale scope, database isolation, access grants and RLS. The isolated PostgreSQL regression passed in Release Gate `38883504274`; no live migration was applied.
- Remaining: select private Production targets, prepare production-only backend/environment receipts, create a non-activating staged deployment once, verify its source/runtime and required behaviors, then obtain final activation approval. No Production, credentials, billing, live database/history or Social Hub changes.
- Resume: verify this exact PR head's database/Release Gate and platform Preview; merge only after required checks pass, then continue the staged-deployment/production-receipt integration. Live customer/provider evidence remains open.

## Isolated Production source and candidate boundary — PR #249 merged

- The first PR #249 gate failed before any Chrome request reached the unchanged generated-page fixture. The harness now proves its isolated TLS/HTTP proxy before launch and disables fresh-profile first-run/default-browser/extension/sync/keychain setup. The 30-second acceptance deadline and every behavioral assertion remain unchanged; the corrected exact head passed Release Gate `38882251454` before merge.
- Missing staged Production candidates return a fixed, localized `production-candidate-required` error instead of suggesting a retry; local operation polling stops and provider error details remain private. Browser regressions also reject malformed scopes before requests.
- The existing compiler/source capture now prepares a distinct Production package against the exact current saved specification verified by Preview. Snapshot SHA-256 equality prevents a different specification from piggybacking on Preview evidence; the full source/runtime digests remain different. Production uses separate environment connections and a different dedicated Supabase project, while customer repository/account, Vercel project/account and verified canonical origin remain bound. GitHub source capture now refuses a connection from the wrong environment.
- `prepareWebsiteOwnedProductionSource` reuses the existing GitHub export worker/custody/cursor CAS to write only the dedicated `tayar/<project>/production` branch. It returns source/snapshot/runtime digests and commit metadata, never credentials or generated files to an HTTP caller. Concurrent changes after export preserve the head SHA with `recovery-required`. This source-only composition is not mounted as a new public publishing action and does not provision, deploy or assign domains.
- The existing provider promotion primitive, promotion worker and legacy Production adapter now perform a read-only, twice-stable preflight requiring a READY Production-target deployment from the exact dedicated Production branch, account/project/commit and bounded Vercel URL. The legacy Preview deployment is rejected before operation initialization, runtime-variable preparation, promotion claims or provider writes. Ready-recovery paths also recheck the provider target instead of trusting historical Preview promotion receipts. An ordinary READY Preview cannot be promoted as if it were a verified Production candidate.
- Regression reuses the existing clinic fixture and actual compiler/capture/adapter code. It covers same-spec/different-source proof, separate backend values, wrong environment/repository/account/database, stale Preview evidence and revocation, concurrent source changes, dedicated source export/recovery, provider target/branch/stability refusal and zero SQL/provider writes from the legacy Preview path. Registry/Auth/provider/export transport is synthetic; no live customer service proof is claimed. TypeScript, scoped ESLint, affected source/export/promotion regressions, generated-source and whitespace checks passed locally; the PR Release Gate is required before merge.
- Remaining: durable staged-Production candidate state and non-activating deployment creation, private Production target selection, production-only backend preparation/receipt migrations, package/runtime verification and explicit approved activation. The legacy environment-preparation SQL still describes copying Preview bindings, so it must not be used to activate a customer application; the newly guarded entry refuses that path before it writes. Do not weaken the environment guard or repurpose Preview receipts. No migration/history, provider/account/key, Production, billing or Social Hub change was performed.
- Resume: verify the exact PR head gate/Preview, then implement the durable staged candidate handoff and its isolated database regressions before any real production action. Behavioral release-bound Auth/RLS/data/provider evidence and migration replay ordering remain open.

## Preview origin and environment isolation — PR #248 merged

- Reproduced the generated application rejecting its actual Preview URL with 403: runtime setup records a verified Production domain, and the existing page/session guard requires that exact origin. The existing generated handler now derives Preview's origin solely from Vercel's server-side `VERCEL_URL` and requires `VERCEL_ENV` to match the compiled release environment before any identity, Auth, payment or email route executes. Request/forwarded headers cannot select a trusted origin. Production retains the owner-verified canonical domain; a mismatched/missing environment fails closed.
- Reuses the clinic reference fixture and existing session/page/payment implementations. The generated Preview regression covers public page delivery, anonymous protected-page denial without private HTML, mocked dedicated identity validation, host-only Secure/HttpOnly session synchronization and subsequent cookie navigation, foreign/canonical/forwarded-host denial, invalid provider hosts and both cross-environment directions. The existing checkout regression now compiles separate Preview and Production packages/configurations, verifies test-price/Preview return URLs and refuses running Production source as Preview. These are local tests with mocked Auth/Stripe transport, not live account/browser/provider verification.
- TypeScript (now including the generated runtime handler source in the existing project typecheck), scoped ESLint, affected source/capture/session/runtime-proof regressions and generated-source/whitespace checks passed locally. Vercel system environment variables must be exposed for the generated runtime; missing variables produce an unavailable result rather than falling back to an untrusted host. No account/environment configuration was changed.
- Important remaining release blocker: the legacy Production coordinator promotes the exact Preview source and copies its public backend binding. An environment-bound Preview package is not a separately verified Production candidate and must not be activated through that path. Implement staged Production compilation/configuration and runtime verification with isolated Production bindings before final activation; do not remove the environment guard to make an unverified promotion appear successful. Auth email callback/redirect configuration and actual provider/browser flows also remain unverified. Production activation stays deferred.
- PR #248 merged after exact-head Release Gate `38878220112` and Vercel Preview passed; post-merge main gate `38878660378` passed. Next: finish the staged Production-candidate handoff and release-bound behavioral evidence. Migration replay ordering and final customer activation remain open. No live database, credentials, billing, Production or Social Hub changes.

## Customer deployed runtime identity — PR #247 merged

- Reused the existing customer-owned compiler, runtime and Preview publish worker. The compiler now binds a SHA-256 identity to every executable runtime byte, including its manifest, HTML pages, public backend binding and bundled handler. The identity excludes only its own declaration. Source capture still binds the complete export and saved snapshot to the existing immutable source digest/commit.
- The generated runtime exposes only a bounded anonymous identity/challenge response, without schema, records, credentials or Auth state. The trusted worker probes the exact HTTPS Vercel deployment URL already matched to customer account/project/commit by the existing authenticated inspector. It sends no cookies or credentials, refuses redirects/custom hosts, streams at most 1 KiB, and bounds the request/body by eight seconds. Missing, cached, malformed, stale or mismatched proof fails closed before recording provider/final readiness. A retry preserves the observing checkpoint; no retry loop or deployment trigger was added.
- Ready-operation retries recheck the captured source and live identity without rewriting the checkpoint. Old exports cannot acquire a new proof merely from a stored READY flag: changed compiler output/source identity must be published and verified. Status-only reads remain historical checkpoints, not fresh runtime attestations.
- Regression covers the real compiled runtime and actual Preview adapter/verifier, old-deployment/new-source refusal, challenge replay, foreign scope, tampered artifacts/payloads, invalid hosts, stale ownership/source, declared/streamed size limits, deadline, response cancellation and sanitized errors. Worker regression proves failed/stale checks never commit readiness and callback inputs cannot mutate the checkpoint. Existing owned-source/Auth/Stripe/email, source-capture and publish runner/worker regressions, TypeScript, focused ESLint, generated-source consistency and whitespace checks passed locally. PR #247 merged after exact-head Release Gate `38877153354` and Vercel Preview passed.
- This is deployed runtime identity/reachability evidence only. It does not prove sign-in, actor/RLS isolation, database writes, transactions, payments, notifications, arbitrary acceptance criteria or a customer delivery. The application delivery action remains closed. No live customer request, credentials, database/migration history, Production, billing or Social Hub changes were performed.
- Next: complete the Preview origin/environment follow-up, then extend the existing release-bound verification to behavioral Auth/data/provider checks. Historical migration replay ordering and final customer Preview/provider activation remain open; do not blindly rename/replay migration aliases.

## Historical migration source identity — active follow-up

- Read-only production metadata inspection on 2026-10-16 found 119 recorded migrations and 128 local files. All 45 remote-only timestamps map by unique logical name to local files with the exact same SHA-256 after removing only trailing CR/LF. The stored server statements and local files retain every other SQL byte. No SQL source, timestamp, database history, Auth setting, provider flag or production data was changed.
- `supabase/migration-source-map.json` records the observed version aliases/source hashes and nine local names absent from the remote history: scheduler readiness, Supabase OAuth capacity, three redirect migrations, email runtime, runtime secret staging, custom quota and execution-error accounting. This is source identity evidence, not proof those nine migrations are safe/applied or that current live schema matches all source.
- `node scripts/verify-migration-source-map.mjs` checks the committed snapshot offline. It fails on changed/missing sources, invalid paths, duplicate identities and collisions with any existing local timestamp. It always reports `historyAligned:false` and `liveDatabaseRechecked:false`; passing cannot silently authorize deployment/history repair. Release Gate also runs the targeted tamper/refusal regression.
- Local source-map/regression checks, focused ESLint and whitespace checks passed; all 45 aliases and nine unmatched local sources have matching pinned hashes. No database writes were performed. Next: verify this PR gate, then separately review replay order and the nine unapplied sources before proposing any source rename/history reconciliation. Runtime attestations and final live Preview/provider evidence remain open; Production and Social Hub stay deferred.

## Application delivery proof — PR #245 merged

- Reproduced a real delivery bypass: a project with one passing synthetic page-policy criterion and a recorded URL could be marked delivered, although its report explicitly said deployment/runtime/services were unverified. Generic all-green launch flags also supplied no release-bound behavioral proof.
- The existing delivery action now fails closed for applications after its existing contract/approval/publishing checks. Definition approval and evidence-report export still work; brochure delivery keeps its existing path. The existing English/Arabic/Swedish publish-and-verify message is reused; browser flags cannot stand in for missing runtime/service evidence.
- Actual generation/delivery regression, TypeScript, scoped ESLint, i18n coverage and whitespace checks passed locally. No provider calls, database changes or charges were performed.
- Remaining blocker: this editor has no trusted server-verified attestation bound to the current immutable customer release and all required behaviors/providers. Do not reopen delivery with a client boolean, checklist or saved approval. Implement that handoff and collect Preview evidence before final activation. This batch also supports explicit bounded table planning for large projects, described below.

## Bounded incremental table planning — PR #245 merged

- The existing planner/UI now offer an explicit table scope. It sends the selected table, the complete outgoing reference/transaction dependency closure (including cycles), relevant native forms/data views/page policies and requirement results/criteria. Related tables, Auth, roles and policies are read-only. Scoped context is explicitly identified; it does not masquerade as the full specification.
- Returned operations can update only the selected existing table. New/other-table/Auth/role/page operations and references to previously unseen dependencies are rejected. The original complete project fingerprint, full schema and repair guard still govern dry run and actual application. No editor/history mutation occurs while planning.
- A large unrelated schema can now be planned without sending every table; full tables and dependencies are never sliced. If the selected dependency closure still exceeds the existing context/body limits, it fails before a provider request. This is bounded table editing, not arbitrary cross-project context partitioning or unverified provider success.
- Planner regressions cover a previously oversized 20-table project, exact context, cyclic transaction/reference dependencies, bound native views, scoped requirement criteria, out-of-scope operation/dependency rejection and an oversized closure. TypeScript, focused ESLint and i18n checks passed. Planning controls and scope explanation use the existing CMS UI translation supplement; published runtime dictionaries/bundles remain unchanged and both BYO publish/application release generator checks pass.
- PR #245 merged after Release Gate `38822154686` and Vercel Preview passed. Next engine work is binding behavioral runtime/service evidence to immutable customer releases. Customer keys, migration history changes, Production and Social Hub remain deferred.

## AI repair security and storage contracts — PR #244 merged

- A regression reproduced an owner-to-authenticated permission expansion that left form/payload checks passing. The existing shared repair guard now rejects broader table-operation/page/workflow audiences, weakened Auth/email verification, newly enabled registration and changed refund authorization, even without requirement fixtures. SQL OR semantics are respected; owner and role audiences are incomparable. Explicit reviewed manual configuration remains available.
- Existing table/field storage identities, constraints, defaults, references, formulas and native booking/counter/transaction/workflow/payment/file/notification/report contracts cannot be removed or changed by AI repair. New tables/fields, labels and ordinary indexes remain supported. Equivalent JSON member ordering does not produce a false contract change. These are editor safety checks, not a database migration engine or proof of live service behavior.
- The actual planner/shared-command regression reuses all seven reference fixtures. It covers valid-but-unsafe schemas, the access audience matrix, protected pages with no tests, workflow/refund roles, atomic rejection with no history entry, safe additions/indexing, manual policy editing and existing undo/redo. The foundation fixture now establishes storage defaults and permissions through reviewed manual configuration before testing safe AI updates.
- PR #244 merged after Release Gate `38821230329` and Vercel Preview passed. TypeScript, scoped ESLint, planner/page-repair/foundation regressions and whitespace checks passed locally. Production, live database/migration history, customer credentials and Social Hub stay deferred.

## Acceptance evidence scope — PR #238 merged

- Closed acceptance tests now match both the requirement capability and its current declared implementation target: `form-values` → `form:<bound-table-id>`, `workflow-transition` → `workflow:<table-id>`, and `page-access` → `page:<page-id>`. Relinking a passing page/form/workflow test cannot verify authentication, payments, external services or another implementation target.
- A legacy manifest without structured acceptance criteria remains editable/generatable, but compile-only evidence cannot approve delivery. Missing criteria are explicitly `not-run`. Tests remain bounded contract evidence; semantic equivalence to arbitrary natural-language criteria is not claimed.
- Focused coverage regressions exercise cross-capability and cross-target relinking, missing specifications, and the existing delivery approval/report path. Seven reference projects retain their compiler evidence while staying blocked without behavioral acceptance evidence.
- Application-generation smoke, attachments regression, TypeScript, scoped ESLint, generated runtime/owned runtime/backend-link/release/BYO bundle consistency checks and whitespace validation passed locally. No generated artifact changed.
- Read-only migration investigation confirmed that Supabase Preview's “Remote migration versions not found in local migrations directory” failure already existed before PR #237. Timestamp/name alignment needs a reviewed historical source map; no database history, migration SQL, Auth setting, credential or provider flag was changed.


## Booking schedule acceptance — PR #239 merged

- Adds the closed `booking-schedule` test kind against the existing published booking schedule policy, linked only to `booking:<table-id>` evidence. Fixtures contain a table ID, two canonical UTC instants and expected `withinSchedule` boolean; malformed or normalized dates are rejected.
- Checks current weekly hours, maximum elapsed duration, reversed intervals, closing boundaries, date closures/special windows and time-zone behavior across a DST change. Missing/invalid schedules fail even when the expected result is negative; editing the schedule invalidates stale expectations.
- This is interval-policy evidence only. It does not authenticate actors, inspect resource availability, reserve resources, prove conflict prevention or persist a booking. Those criteria remain unverified by this test kind.
- The existing AI generation path accepts and preserves the new contract and rejects malformed fixtures atomically. Cross-capability and cross-table relinking remain blocked. Seven reference projects are reused, not recreated.
- Application-generation smoke, existing booking regression, published-runtime and owned-source regressions, TypeScript, scoped ESLint, all affected generated runtime/Edge consistency checks and whitespace validation passed locally. Generated dependencies were rebuilt from their trusted generators with the locked esbuild version.


## Record payload acceptance and generated target resolution — PR #240 merged

- Adds closed `record-values` tests for the existing data-view create/update parser. Tests name a page, section and operation, use bounded synthetic string fixtures, and compare the exact converted payload or require input rejection. Coverage is restricted to `records` and `view:<bound-table-id>:<operation>`; it cannot satisfy read, another table/operation, authentication or formula requirements.
- The current view must compile and expose the tested action before parsing. Missing/invalid targets fail even for negative expectations. Existing fixture limits, closed shapes, unique field names and credential-like input rejection apply. Reports omit fixture values.
- Covers numeric/boolean/date/JSON conversion, required/default behavior, unknown fields, and refusal to directly write workflow states or generated formula fields. This proves only payload validation, not server authorization, persistence, generated database results or effects.
- Fixes a discovered generation gap: page-based acceptance fixtures previously retained model-supplied IDs while generation assigned new page/section IDs. Generated page slugs and explicit unique section anchors now resolve atomically to saved IDs for record, form and page-policy tests. Missing/ambiguous targets and unavailable record actions reject generation without editor mutations. Existing manifests without tests remain unchanged.
- The existing generation-handler regression verifies persisted normalized fixtures, real coverage results, response immutability and atomic malformed/missing/ambiguous-target rejection. Seven reference projects are reused. Focused specification, coverage, booking/record acceptance, reference-project and real generation-handler checks passed; TypeScript, scoped ESLint, affected generated-source consistency, data-view/AI/published-runtime/owned-source regressions and whitespace checks passed locally. The uploaded tree matched the tested local tree; PR Release Gate `38816790364` (#1849) and Vercel Preview passed before merge.
- Remaining work includes broader executable requirement evidence, live actor/data isolation and persistence checks, safe repair/rollback and external-service verification. Customer/provider activation remains the final phase; Social Hub stays deferred. No production promotion, credential, live database or migration-history changes were made.


## Safe AI application repair — PR #241 merged

- The existing AI page-edit/repair path now validates application page access, bound forms and data views before advisory model review or candidate preview. Unbound contact forms, invalid bindings and removed protected pages fail closed.
- Current requirement coverage is recomputed for the baseline and candidate. Every previously passing contract/acceptance check must still pass; existing untested criteria can stay untested so unrelated safe repairs remain possible. This does not claim live database/provider behavior or authorize schema/requirement changes.
- The controller supplies the current application to the existing lazy AI change handler. Validation failures never mutate editor pages, replace undo snapshots or create project checkpoints. Safe accepted changes retain the existing before/after checkpoints and undo path; rejected previews remain inert.
- The behavioral regression drives the real AI handler with synthetic model responses and an advisory model that would claim safety. Removing a required form or renaming a bound field is rejected before the advisory request, preview or mutation. A safe title edit applies and checkpoints; a declined preview applies nothing. Direct checks cover broken data views, page access, unbound forms, pre-existing untested criteria and unchanged baselines.
- TypeScript, scoped ESLint, the real repair regression, existing candidate-audit/undo regressions and whitespace validation passed locally. Release Gate now runs the new repair regression beside the existing undo regression; no generated runtime bundle changed. The first PR gate exposed a legacy source-order assertion requiring validation after advisory review. Its expectation now matches the earlier fail-closed boundary; the real handler regression confirms failure prevents that model request.
- Customer keys/accounts, Production promotion, migration-history reconciliation and Social Hub remain deferred. Full automatic repair planning, schema repair and live rollback verification remain future work.


## Safe AI application configuration repair — PR #242 merged

- PR #242 merged as `24b89ef626e698eac6f8db97a08e98d21f24f78b` after Release Gate `38819005690` (#1854) and Vercel Preview passed. Post-merge verification is tracked on main Release Gate `38819363300` (#1855).

- The shared application command now applies the existing repair guard to AI schema/auth/role/page-policy plans. It validates current form/data-view bindings against the candidate application and compares requirement coverage before/after, preserving every previously passing check. Schema validity alone cannot authorize breaking existing behavior. Manual configuration changes retain their existing reviewed editing path.
- The existing planner dry run and actual editor application use the same command, so unsafe plans fail before review and again before application. A failure in a multi-operation plan discards the entire draft and adds no history entry. Safe plans use the existing full-project history/undo/redo boundary.
- Review fingerprints now include native page/section/form/data-view/custom-action configuration instead of page IDs alone. Editing a bound form name/validation/mapping or a data-view action invalidates an outstanding plan with unchanged page IDs. Unrelated title/color edits do not invalidate schema review. Stored runtime rows and credentials are not introduced into the fingerprint.
- Extends the existing application-AI regression through the actual planning service and shared command with synthetic data. Covers still-valid schemas that change numeric payloads or anonymous page policy, removed create permission, field changes, atomic rollback, stale page configuration, safe indexing, undo/redo and pre-existing untested criteria. Existing page-only repair/foundation/coverage regressions remain passing.
- TypeScript, scoped ESLint, affected regressions, all application/browser/owned/Edge generated-source consistency checks and whitespace validation passed locally. Generated artifacts remain unchanged because the shared runtime page types changed only at the type level.
- This is a configuration repair boundary, not automatic schema repair planning, database migration application, persistence or live-provider evidence. Customer keys/accounts, Production promotion, migration-history reconciliation and Social Hub remain deferred.


## Complete bounded application planning context — PR #243 merged

- The existing application planning request now includes the current native form/data-view mappings, field types/validation, custom-operation targets and requirement-test IDs/results. It reuses the same page projection as approval fingerprints, with an outbound projection that omits automation configuration, custom input literals, placeholders and unrelated visual content.
- The AI instruction explicitly preserves native mappings and passing checks; diagnostic results remain local contract evidence. The existing shared command remains authoritative for validating both the model's proposed plan and the user's later application of it.
- Removes silent string slicing of the user's instruction and serialized application context. Instructions over 4,000 characters and complete contexts outside the existing 32,000 context / 40,000 message / 60,000 serialized-body character budgets fail before the AI request. JSON within the budget is complete; no schema, mapping, criterion or instruction is silently omitted.
- Extends the existing real planning-service regression to inspect complete schema/native mappings and diagnostic results, omission of synthetic private automation/input values and visual content, and pre-provider rejection of oversized instructions/projects. Existing schema repair, atomic rollback, stale review and undo/redo checks are reused.
- TypeScript, scoped ESLint, the real planning-service/command regression, existing foundation checks and whitespace validation passed locally; no provider call or live database was used.
- This does not add large-project context partitioning: an oversized project receives an explicit limit and requires a narrower scope. It does not claim automatic repair loops, live provider/database behavior or production activation. Customer keys/accounts, migrations, Production promotion and Social Hub remain deferred.


## Live repository check — 2026-10-14

- `main` is `6612bb8dbbe572d23568b988acd8b079dcfa39a3`; PR #217 is merged
  after PR Release Gate `38595436276`, Vercel Preview, and main Release Gate
  `38595967134` all passed. PR #146 is merged as
  `ab55075ea6f8ebd09b71994a0e631efe12e96024`; its stale-runtime and browser
  regression failures are resolved and are not current blockers. PR #213 also
  merged as `7e8c258c`; the latest main Release Gate passed.
- Production deployment `dpl_BhDGCqhxhDMBZBm6MhjSmKZGUuJo` is READY at
  `ab55075e`, behind `main`. Promotion remains deferred until the outstanding
  platform work passes its release gate; previews are not production delivery.
- Supabase advisor snapshot on the active project (2026-10-14): no uncovered
  foreign-key notices are recorded in the phase-zero migration checkpoint.
  Remaining SECURITY DEFINER and private-table RLS notices were reviewed as
  intentional server/API boundaries; do not blanket-revoke grants or add RLS
  policies. Newly added indexes can still appear unused before representative
  workload. Leaked-password protection remains disabled on the Free plan and
  requires an owner plan decision; no billing or auth setting was changed.
- The merged custom-operation batch stores bounded custom operation source in the
  immutable private release snapshot and resolves it only by matching owner,
  project, release and operation IDs. It remains inert and cannot pass delivery
  coverage; the custom-operation route remains unmounted pending end-user
  authorization and runtime integration. Focused regressions, type checks and
  both release gates passed.
  Regenerated Vercel, BYO publish, application release and runtime artifacts
  match their sources. Production has not been promoted.

## Durable rules

Extend the existing application engine; do not create sector-specific engines.
Customer credentials and live provider activation stay last. Social Hub remains
deferred on `deferred/social-hub-foundation-20261011` and must be preserved.
Generated code, a successful build, passing tests, deployment and verified live
services are distinct delivery states.

## Phase zero — complete on 2026-10-11

- PR #146 merged to `main` as
  `ab55075ea6f8ebd09b71994a0e631efe12e96024` after Release Gate
  38165046959 passed. The subsequent main Release Gate 38165264856 also passed.
- The stale owned runtime and dependent BYO Edge bundle were regenerated from
  their trusted source. The application data-view browser regression now waits
  for an explicit terminal result, detects crashes/timeouts and cleans up the
  Chromium process group safely. Real CI Chrome passed the en/ar/sv assertions.
- Source migration `20261011183711_phase_zero_advisor_hardening.sql` added the
  16 verified foreign-key indexes and converted the constant scheduler readiness
  function to SECURITY INVOKER while preserving ACL, RLS and disabled scheduling.
  The live Supabase migration record is version `20261011184736` with the same
  logical migration name. Embedded and native PostgreSQL regressions passed.
- After the migration, the uncovered-FK advisor notice count is zero. Remaining
  SECURITY DEFINER notices were reviewed rather than blanket-revoked: their
  exposed callers have explicit grants, fixed search paths and application
  authorization/published-site guards. RLS-without-policy tables remain private
  server-only tables. Newly created indexes can appear as unused until workload.
- Supabase leaked-password protection remains disabled because the organization
  is on the Free plan and the supported feature requires an owner plan decision.
  No billing, Auth configuration, customer credential or secret change occurred.
- Vercel production deployment `dpl_BhDGCqhxhDMBZBm6MhjSmKZGUuJo` is READY from
  the exact merged SHA above. `https://www.tayar.se/` and its manifest returned
  200; an invalid published-site API path returned the expected 400. These probes
  do not claim that unconfigured customer services are live.

## Phase one — structured specification merged

PR #147 merged to `main` as
`f30ad8e37c3b1c547b212f14a3e8f5ae93f891e3`. PR Release Gate
38168336221 and main Release Gate 38168604276 both passed.

Implemented a domain-neutral `ProjectSpecification` attached to the existing
`ApplicationRequirementManifest`. It references the existing generated schema,
roles and requirement IDs rather than creating a parallel generator. The closed,
bounded contract records actors, entity scope/sensitivity, explicit or inferred
requirements, observable acceptance criteria, operations and dependencies,
business rules, tenancy, deferred integration scopes, privacy/retention and
unresolved decisions.

The validator rejects unknown fields/IDs, duplicates, missing table
classifications or requirement coverage, dependency cycles, missing sensitive
data plans, contradictory tenancy and unresolved conflicts. Custom execution and
organization/branch isolation fail closed until their isolated executor and
membership policies exist. Descriptive rules and acceptance criteria are never
treated as implementation or test evidence.

Agent-mode application generation now requires this specification and validates
it before mutating editor state. Legacy/manual projects and ordinary brochure
generation remain backward compatible. The AI request performs the analysis in
the existing single generation call and is explicitly forbidden from inventing
credentials, sector assumptions or unsupported native behavior.

Verified locally after this change:

- TypeScript and focused ESLint passed.
- Domain-neutral specification regression passed across retail, restaurant,
  school, clinic, government, factory and a custom research record model.
- Real generation-handler regression passed: a valid specification persisted;
  a missing specification and claimed custom execution were rejected atomically.
- Application foundation, release upload/endpoint, backend link, published
  runtime, owned source/runtime binding and BYO Edge regressions passed.
- Application runtime, backend-link, release, owned runtime and BYO publish
  generated artifacts were regenerated from source and passed consistency checks.

## Autonomous QA — coverage matrix merged

PR #148 merged to `main` as
`c59444be414f383f9f9786257ad7e02822539aad`. PR Release Gate
38219553289 and main Release Gate 38219830834 passed.

The existing requirement verifier now builds explicit coverage rows:
Requirement → Implementation → Contract Test → Result → Delivery Status. It
recomputes evidence from the current project and executes the existing form/data
view compilers; saved AI claims cannot create a passing row. Specification
operation IDs are included as traceability metadata, while test results come
only from current executable contracts.

Removed pages, invalid bindings and missing native actions produce failed tests
and block approval. Delivery reports include the matrix and use
`contract-verified`, which intentionally does not claim deployment or live
service verification. Applications cannot be marked delivered while unpublished
or while a launch-readiness check fails. Brochure compatibility is unchanged.

Focused TypeScript, ESLint, coverage-matrix and real generation/delivery
regressions passed, followed by both full gates.

## Business logic — active declarative workflow batch

PR #149 merged to `main` as `09e5406891d9af32b68cbed19352888d9f1ba524`.
PR Release Gate 38244010970 and main Release Gate 38244295671 both passed.

The existing atomic workflow engine now supports optional bounded same-record
effects on each transition: a typed literal assignment, a bounded numeric
increment, or a server transaction timestamp. Effects run in the same locked
PostgreSQL transaction as the guarded state change and the existing idempotency
receipt. They cannot target the state field, formulas, protected counters,
duplicate fields, unknown fields or arbitrary expressions/code.

Validation enforces closed shapes, field/type compatibility and a maximum of 20
effects. Existing workflows remain compatible. The AI generation contract may
use only these declared primitives and must report cross-record logic as
unsupported rather than inventing execution. TypeScript, ESLint, workflow,
schema, backend verification, release endpoint, owned source, BYO Edge,
generation/coverage and all generated-artifact consistency checks passed
locally. The PostgreSQL concurrency/effect assertion runs in Release Gate.

## Business logic — workflow audit history merged

PR #150 merged to `main` as `829cd67036cba3192937dd95ee15941bca6e68e3`.
PR Release Gate 38245758281 and main Release Gate 38246046180 passed.

Workflow receipts now carry a server transaction timestamp, are indexed by
record and time for audit history retrieval, and reject updates/deletes at the
database trigger layer. The owned workflow catalog verifier checks the new
column, index, function and immutable trigger. This strengthens the existing
private transition audit records without exposing sensitive transition details
through client access. PostgreSQL assertions verify timestamp presence,
immutability and catalog integrity in Release Gate.

## Business logic — atomic related-record workflow merged

PR #151 merged to `main` as
`2fb4952b3421a335d7aa7e4a95e2b2d92d1bb5af`. PR Release Gate run
38266169172 and main Release Gate run 38266516500 both passed.

The existing guarded workflow transition can now apply one bounded mutation to
a related record selected by a required reference, in the same PostgreSQL
transaction as the source state change and immutable idempotency receipt. It
supports typed set, bounded increment and transaction timestamp changes; target
rows are locked and checked against their own declared read/update permissions.
Missing targets or denied permissions abort the entire operation. Workflow
states, formula outputs, counters, arbitrary expressions, fan-out and self-table
references remain unsupported and fail closed. The AI generation contract now
describes this exact executable capability.

Focused workflow/schema regressions, TypeScript, scoped ESLint and generated
bundle consistency passed locally. Release Gate verified the actual PostgreSQL
atomic mutation and denied-target rollback. Earlier PR gates identified stale
generated Supabase BYO, application backend-link and application-release
bundles; all were regenerated from their trusted source scripts before the
passing PR and main gates.

The additive schema migrator recompiles affected workflow functions when
workflow effects, relation fields, or referenced-table permissions/fields
change.

## Deployment and delivery — evidence reporting merged

Client delivery reports now separate the editable project definition and
current requirement contract results from build-artifact verification,
deployment health and live runtime/provider checks. A recorded published URL is
reported as a URL, not proof of healthy deployment; build and external service
status remain explicitly unverified because this report has no fresh execution
attestations. PR #152 merged to `main` as
`7ef664d5e27ee2771955880625e264979a297577`; PR Release Gate run 38267122879
and main Release Gate run 38267488592 both passed. The real
application-generation/delivery regression, TypeScript and focused ESLint
passed locally.

## Reference projects — generated-contract coverage

The regression covers seven synthetic definitions: retail, restaurant, school,
clinic, government, factory and custom research. Each model is validated and
compiled to schema SQL, then passed through the real application preparation
path with a structured project specification and a bound overview data view.
Current requirement coverage must pass for authentication, page access and
record reading; a broken table binding must fail before the project is applied.
The check also verifies RLS, owner isolation and each model's expected native
backend feature. Invalid transaction permissions and booking resources fail
closed. Release Gate now runs this focused regression. These are generated
contract fixtures, not complete end-to-end customer products or live provider
proof.

## Reference project runtime isolation — added

The Release Gate now also runs each of the seven generated reference schemas on
an isolated PostgreSQL database. It seeds records for two test owners, confirms
each authenticated owner can read only their own row, and verifies an attempted
owner reassignment is denied or rejected without changing the row. The fixtures
reset the disposable schemas after use. This proves the generated schemas apply
and their baseline tenant boundary works; it does not claim full customer
product E2E or live provider readiness. Existing transaction, workflow,
formula, booking and related PostgreSQL regressions remain the evidence for
those native capability classes.

The rollback safety regression also covers a verified publish whose project
metadata commit fails: the previous live snapshot is restored and editor
publication state stays unchanged. This is a recovery contract test, not proof
of a live provider restore.

The generated PostgreSQL schemas now also execute each reference project's
primary feature: retail/factory inventory transactions, restaurant/government
workflow transitions, school formula calculation, clinic booking and overlap
rejection, and research-sample analysis. The seven scenarios passed the full
Release Gate in PR #164. This verifies generated database behavior, not the
generated page/browser/backend integration or a complete customer-ready product.

The seven fixtures now also pass through the real …61 tokens truncated…ared transaction, workflow, booking or
formula field. This closes the generated HTML-to-runtime-configuration handoff
check; it does not simulate browser interaction or prove live provider access.

Release Gate boots rendered application pages with their real browser
bootstrap in headless Chrome and verifies that generated data views read and
display fixture records. It now also opens each of the seven generated reference
project pages (retail, restaurant, school, clinic, government, factory, and
custom research) in Chrome and verifies the page-specific bound data view renders
a labeled fixture row. The fixture records are isolated by project and table,
including schemas that share table names. This verifies the generated page,
private bootstrap, browser runtime, and mocked read path for every reference
definition; it does not exercise each project's full workflow or prove live
provider access.

The browser regression exercises representative project workflows through
the actual private application runtime against local mocked Supabase responses.
The generated restaurant page advances a kitchen ticket queued → cooking →
ready; separate government permits are approved and rejected; and a research
sample advances received → analysed → archived. It also creates an inventory
transaction, checks availability and creates a clinic appointment inside the
clinician schedule, then rejects a second overlapping appointment without
creating another record. Generated school assessment and formula-backed rows
are saved with their computed totals kept out of editable fields. PRs #181–#184
added and passed the Release Gate for the research, restaurant, government and
clinic browser flows. These are representative paths, not full end-to-end tests
for every project type.

The remaining evidence gap is interaction coverage for additional project
behaviors and wiring the now-live-verified Vercel adapter into the server-side
application runtime behind a reviewed, bounded operation contract. Customer
execution remains disabled until that integration and its authorization,
cleanup, timeout and release regressions pass. Production migration history and
provider activation stay separate final-stage work; these fixtures touch no
production database or credentials.


## Business logic — bounded multi-record workflows merged

PR #154 merged to `main` as
`d09a03559292e5559b0d6ff8373f572eaf88be11`. PR Release Gate run
38276567066 and main Release Gate run 38277439123 both passed.

The existing atomic workflow engine now supports up to four distinct related
tables per transition, with one row per table, stable target lock order,
per-target permission checks and transaction rollback. The AI contract and
generated runtime bundles were updated from their source generators. Release
Gate also exposed a stale application-page browser bundle; it was regenerated
from `scripts/build-application-page-browser.mjs`. PostgreSQL constraint
rollback, the other application database regressions, production build,
dependency audit and whitespace checks passed in both gates.

The Supabase Preview migration check remains blocked by migration history drift:
the connected production database has 46 recorded versions absent from the
current local migration filenames, while 58 local versions are not recorded by
their current version. Several logical migration names exist on both sides with
different timestamps. This is historical drift, not a single stale migration.
Do not rewrite database history, add no-op migration placeholders, or apply
production migrations to silence the check; reconcile the historical source
mapping before enabling preview migration validation. Production has not been
deployed from this branch.

## Custom code — isolated execution boundary

The server now defines a provider-neutral, one-shot execution contract for
untrusted custom code. Each adapter invocation must create a fresh Node 22 VM
with network access denied, persistence disabled, one vCPU, and a bounded
timeout. Requests and results must be finite JSON within strict size and depth
limits. The boundary stops the sandbox after success, failure, timeout or
oversized output and returns stable error codes without forwarding provider
errors.

Release Gate now runs regressions for the policy contract, missing-adapter
fail-closed behavior, request/output bounds, timeouts, cleanup, and a mocked
Vercel Sandbox REST adapter. The adapter requests an empty network allowlist,
ephemeral Node 22 VMs, bounded resources and lifetime, and sends no environment,
repository, mount or customer credential fields. Its HTTP contract is covered
with mocked requests and responses only. No credentials were injected into
the provider smoke, and the adapter is not mounted into an application route.

A controlled provider smoke has now created a non-persistent Node 22 sandbox
with one vCPU, a 30-second timeout, and deny-all network policy in the connected
Vercel project. It wrote and read a local fixture file, confirmed an external
fetch was blocked, exited successfully, and the session was stopped. This
verifies the provider can start and isolate a short-lived VM; it does not verify
the repository's REST adapter against Vercel, mount custom execution into an
application route, or activate customer code.

Custom operations remain rejected during project generation until this
provider behavior is verified against a controlled activation sandbox and
explicitly wired to the server-side application runtime. No customer code can
reach this adapter today.

An opt-in live smoke command now exercises the repository adapter and the shared
one-shot cleanup boundary: `npm run smoke:vercel-sandbox:live`. It skips without
a provider request when `VERCEL_TOKEN` is absent; `VERCEL_TEAM_ID` is optional.
Provide credentials only through the local process environment, never by
pasting them into source or command text. The smoke runs one deterministic
expression with deny-all networking and a 10-second execution limit, suppresses
provider error details, and is excluded from CI/Release Gate. It has not yet
been run against Vercel, so the repository-adapter live verification remains
open until that command completes successfully.

## Custom code — live repository adapter verified

The opt-in live smoke completed successfully on 2026-10-13 against main commit
`f999dc64d90fc4f69f177d7013497f6262fe8172` (workflow run
[38480702220](https://github.com/khatay1/Tayar-Intelligence-Tools/actions/runs/38480702220)).
The repository adapter created a deny-all, non-persistent Node 22 sandbox,
executed the deterministic fixture, validated its result, and stopped the
sandbox. This closes the live REST-adapter verification gap. It does not enable
customer execution: the adapter remains unmounted, custom operations remain
rejected during generation, and no customer code or credentials were involved.

## Custom code — published-operation gate contract added

The server now has a fail-closed orchestration contract for a future published
custom operation route. It accepts only owner/project/release/operation IDs and
bounded JSON input; source is resolved server-side from the requested immutable
release. Authorization must pass before source resolution, and a durable usage
reservation must pass before a sandbox is created. The feature defaults off,
rejects release mismatches and extra request fields, and maps provider failures
to stable public codes. Release Gate covers ordering, disabled/unauthorized/
unreserved denial, release mismatch and sandbox cleanup. The existing atomic
per-user usage meter now has a dedicated custom-execution policy and bounded
monthly limits (free 0, Pro 10, Business 50); it is seeded disabled by default.
The server quota adapter validates the tool policy and effective plan before
reserving usage, and finalizes the reservation after a sandbox attempt so
failed customer code still consumes the bounded execution allowance. Release
Gate covers reservation configuration, disabled-policy denial, finalization
and clamped duration metadata. These additions are source-only and have not
been applied to a live database. The orchestration contract remains unmounted;
generation still rejects custom operations. Runtime authentication/release
integration and the production migration remain pending.

A server-only HTTP route contract now limits operation requests to same-origin POST JSON with a 32 KiB body, rejects client-supplied owner/project/source data, and maps failures to stable no-store responses. Release Gate covers origin, method, media type, query, body-size and successful-execution paths. This route contract is not mounted: the immutable release currently carries no custom source artifact or operation authorization policy. Release storage and live-auth bindings must be implemented before any customer operation can run.

The published-operation orchestrator now distinguishes a thrown value from a successful `undefined` result, including adapters that throw `null` or another non-Error value. It still finalizes the reserved attempt before returning a stable failure. The focused regression and TypeScript check passed on PR #211; the route remains unmounted and disabled.

The Website Builder AI undo path now has a direct behavioral regression in
Release Gate. It verifies restoration of the complete captured page, site,
brand, SEO, theme, header and reusable-symbol state; confirms restored
collections are detached from the saved snapshot; and rejects stale-project or
in-progress undo attempts without applying project data. Before a valid undo,
the current project is now checkpointed so the history panel can restore an
accidentally reverted AI result.

## Honest completion boundary

### Published operation identity binding — implementation checkpoint

The execution orchestrator now requires the release resolver to return both
the requested immutable release ID and operation ID. It rejects missing or
mismatched identities, empty source, and extra artifact fields before usage
reservation or sandbox creation. This closes a concrete source-selection gap in
the orchestration contract; it does not implement persistent artifact storage,
authorization policy, or route mounting. The focused custom-operation
regression, TypeScript, scoped ESLint and whitespace checks passed locally.
PR #213 merged as `7e8c258c0a5f7f1fe62f05d93cfa6018679517c1` after its PR and
main Release Gates passed.

### Inert custom-source release artifacts — implementation checkpoint

Custom operations in the structured specification can now carry bounded source
(64 KiB); native operations cannot carry source, and custom code cannot claim
database transaction guarantees. The existing immutable application release
snapshot retains this specification. A server resolver selects source only
when owner, project, immutable release, private release bucket, and operation
IDs all match. The AI generation contract describes deterministic JSON-in/JSON-out
draft source and explicitly forbids claiming it is authorized, executed, or
deliverable. Requirement coverage adds a failing contract row for each custom
operation, so source storage alone cannot pass delivery. Execution remains
disabled pending the authorization and runtime integration work. Focused
specification, generation, coverage, resolver, type and bundle checks passed;
the PR Release Gate and post-merge main Release Gate passed.

The Release Gate identified stale generated dependencies in the Vercel
connection Edge bundle, owned application runtime template, BYO Publish Edge
bundle and application backend-link Edge bundle. Each was regenerated from its
trusted source. Focused feature regressions and the current main Release Gate
passed. The activation preflight remains intentionally not ready because
provider credentials and account configuration are deferred to phase eight.

The first PR gate caught a stale private application runtime bundle. It was
rebuilt from the trusted generator; generated-runtime consistency and the
published-runtime regression passed locally, followed by passing PR and main
Release Gates.

Phase one structured analysis is merged, but broader inferred-requirement depth
will continue to evolve with the generator. Phases two through seven still
require incremental implementation and evidence, especially authorization for
the custom execution boundary, safe repair/rollback, and verified external
service behavior. The seven reference projects have generated-contract coverage
and a browser regression exercising synthetic workflow/transaction behavior for
retail, restaurant, school, clinic, government, factory and custom-research
projects. This is not evidence that each is a complete customer-ready product.
Final provider activation remains phase eight.

## Business logic — guarded conditional workflow transitions merged

Workflow transitions accept up to ten bounded, typed predicates over
ordinary record fields. The SQL compiler checks them after record and role
authorization while the source record is locked, before related-row effects or
state changes. PR #216 passed Release Gate run `38585320340` and Vercel Preview,
then merged to `main` as `630591c59c37a6dfd9d97efc6316b91564e86a14`.
Post-merge Release Gate run `38592549651` passed all checks except a timeout in
`application-reference-page-browser-regression.mjs`; the browser made no HTTPS
requests and the PR gate passed the same tree. Only the failed workflow job
was restarted as run attempt 2 and passed. This completes the post-merge gate.
Supabase Preview remains skipped because preview branches are disabled.

## Business logic — all/any predicate groups merged

An additive `conditionMode` supports AND (default) and OR matching for bounded
workflow predicates. The workflow regression, TypeScript, focused ESLint, all
affected generated-bundle consistency checks and whitespace validation pass
locally. The trusted BYO Publish generator regenerated its transitive
application-validation dependency; the bundle check and deployment-entry
regression pass. PR #217 merged to `main` as
`6612bb8dbbe572d23568b988acd8b079dcfa39a3`. Gate run `38594651303` had checked
stale merge ref `ac8312f` and failed the old bundle; the new PR gate
`38595436276` passed on the refreshed head and main gate `38595967134` passed.

## Custom code — application actor authorization merged

PR #218 merged to `main` as `75c78de6208cf40678920bded0262bd4a2188bc0` after
Release Gate `38597169913`, Vercel Preview and main Release Gate `38597630171`
passed. Its fail-closed adapter verifies the end-user access token against the
bound customer Supabase Auth project, rejects anonymous users, and checks
role-bound actors through the existing `app_my_roles` RPC. It validates the
trusted project ref, uses only the public key and user's bearer token, applies
bounded responses/timeouts, and ignores user-editable metadata.

## Custom code — bearer token route contract merged

PR #219 merged to `main` as `ca7d2e01a4a8b37b86d81b48d71aca1173f21560` after
Release Gate `38598293618`, Vercel Preview, and main Release Gate
`38598681838` passed. The HTTP operation contract now requires a bounded JWT
Bearer token and passes it only to the authorization callback. Missing or
malformed credentials fail before execution; the token is excluded from release
loading and quota callbacks.

The generated customer runtime still does not mount this route and custom
execution remains disabled. The active composition checkpoint adapts the route
callback directly to customer Auth/RLS verification and tests the complete
HTTP-token-to-Auth/RPC path with synthetic responses. Focused route and runner
regressions, strict TypeScript, scoped ESLint and whitespace checks pass locally.
Remaining activation work requires immutable runtime identity, platform quota
custody and sandbox credentials to be integrated without exposing Tayar secrets
to customer code. Production remains unpromoted.

## Owner stock — authenticated customer runtime wiring (2026-10-16)

Continuation from `main@782132ae` (#264); its post-merge Release Gate
`38963443115` passed. The existing customer-owned data runtime now accepts an
explicit list of stock table IDs and exposes `stockReservations(tableId,
expectedUserId)` for available/reserve/release/fulfill using its own Supabase
client. Every RPC verifies a permanent user, pins that user's captured token on
the request, and rechecks identity/token and disposal before returning a result.
A switched account cannot receive another account's result; a retained stock
handle cannot operate after disposal. Errors remain generic and receipts are
caller-retained for safe retry after an uncertain outcome.

The ordinary/platform runtime and default customer runtime expose no stock
adapter. Table selection is copied, validates the same owner-only integer
counter rules as SQL, and cannot be changed by mutating the input list. A shared
eligibility helper removes SQL installation code from the browser RPC import.
The existing real Supabase SDK regression covers all four operations, exact
customer endpoint/public key and pinned Authorization, invalid/anonymous/missing
identity, provider failures, account switches and disposal during a request.
Existing PostgreSQL coverage remains the authority for stock concurrency/expiry.

This is runtime wiring, **not customer-ready inventory activation**. No saved
application opt-in, generated stock UI, trusted installation workflow or
publish-readiness integration is claimed. An installation attestation must
still accompany the exact customer app/database before mounting controls.
Location UUIDs remain labels, not warehouse balances. No customer database,
Production, credentials or Social Hub changes were made. Next: connect explicit
saved stock requirements to source/provisioning/readiness and generated UI,
then prove the UI-to-database flow. PR and exact-head CI results are recorded in
issue #253 after the gate completes.

PR #265 follow-up: the first Release Gate correctly caught a stale transitive
Vercel connection Edge bundle. Regenerate affected connection/backend bundles;
do not bypass consistency checks. Added fail-closed checks for disposal during
either awaited identity verification. The stock PostgreSQL regression now also
routes the real owned runtime and Supabase SDK through an HTTP fixture to the
actual isolated database, covering concurrent last-unit reservations,
lost-response retry, account switch after commit, reconciliation without a
second decrement, foreign-owner denial and expired fulfillment. Native database
results must pass on the final PR SHA before merge. Infrastructure activation
preflight remains intentionally unready because final credentials are deferred.

## Shared runtime lifecycle guard — follow-up to #265 (2026-10-16)

Stock runtime wiring merged in #265 as `dd210fc7192b24345abf54e68cc2a145e3c978a9`
after exact-head Release Gate `38969436501` passed, including the native
PostgreSQL scenarios. Inventory source/provisioning/UI work remains incomplete.

A focused SDK reproduction found a pre-existing lifecycle race outside the
stock adapter: an ordinary record update could send its PATCH after disposal
while awaiting the actor verification response. The shared token guard now
checks disposal after both asynchronous session/actor reads. `createOnce` also
checks its later owner lookup, including its legacy call without an explicitly
pinned owner. These checks prevent initiating database writes after closure;
they do not undo a write already sent to the database.

The existing SDK regression was extended with update and durable-create
requests closed during the first or second actor check. It failed against the
merged baseline (an update was actually sent) and passes with the fix, asserting
no REST/database request was sent after closure. No database rules, permissions,
expected outputs, existing receipt semantics or customer settings were relaxed.
Only affected generated outputs are refreshed. PR/exact-head gate and main
results are recorded in #253. Next inventory work remains saved explicit
requirements, trusted provisioning/catalog readiness and generated stock UI.

## Saved stock opt-in and available-stock UI — 2026-10-16

Continuation from `main@900515d2` (#266). Its post-merge Release Gate
`38970430857` passed; #265 and #266 are complete and are not repeated.

- An explicit table `stockReservations: true` is persisted in the validated
  application definition. It requires Auth, an integer counter starting at zero,
  and owner-only read/update permissions. Ordinary counter apps stay unchanged.
- Initial schema/source generation installs the existing stock SQL exactly once
  and retains the declaration in the customer source and schema revision.
  Existing stock application changes cannot use automatic additive migrations.
  A canonically identical already-installed definition remains a read-only
  preparation no-op, including PostgreSQL jsonb object-key reordering.
- Both dedicated runtime entrypoints bind declared stock tables to their own
  authenticated client. The generated records component adds a localized
  `stock-availability` action with an informational quantity, stale/error
  clearing and actor-switch refusal. It queries available stock, not the stored
  counter field. Availability never authorizes a reservation or fulfillment.
- Normal backend setup now verifies exact stock SQL/RLS/grants when opted in.
  The actual BYO publish host also obtains exact leased customer OAuth custody,
  verifies customer project ownership and rechecks installation and connection
  identity at publication; an old binding or saved flag cannot substitute for
  current SQL evidence. The verifier remains read-only and secrets never escape.
- AI repair preserves existing stock declarations. Generation recognizes
  owner-stock availability in English/Arabic/Swedish and requires its actual
  bound view. Requests for stock reservations fail explicitly until generated
  reserve/release/fulfill controls exist; ordinary transactions cannot pass as
  reservation support. Generation guidance is updated accordingly.

Evidence is covered by the existing scoped source, schema, stock opt-in,
SDK, repair, policy and browser suites. The native stock PostgreSQL regression
now installs the FULL generated initial schema, verifies setup/publication
through real catalogs, and drives the actual browser component and Supabase
SDK into that database through a local HTTP/Auth fixture. This fixture is not
proof of a real GoTrue/PostgREST deployment. Final CI results are recorded in
issue #253. No new OSS code/dependencies, live migrations, final keys, customer
Production activation or Social Hub work. Owner-only availability is the slice;
reservation mutation controls, reviewed existing-DB migration, physical warehouse
balances and live customer activation remain incomplete.

## Owner stock hold controls, continuation from #267

`main@e03b61d0` passed post-merge Release Gate `38974998424`. The next
change adds a separate `stock-reservation` action to saved owner-stock data
views. The controller stores one receipt per owner/table/item in scoped browser
session storage before the network request. A lost reserve response can only
retry the same item, location label, quantity and receipt. A lost release or
fulfillment response can only retry the same decision. Validated receipts
survive a same-tab reload and are removed on confirmed settlement/expiry.
Cross-device receipt management is not provided; the server's 15-minute expiry
releases abandoned holds. The location UUID is a label, not a physical
per-warehouse stock balance. The authenticated SQL RPC remains the authority
for owner checks, concurrency, availability and terminal idempotency.

Generation now distinguishes stock holds from appointment bookings and
multi-item transactions and requires a bound stock-reservation action when
requested. Its requirement evidence is the bound action, while release-ready
evidence still requires native PostgreSQL/browser regression on the final PR
head. No current customer database is auto-migrated, and live service
activation remains separate.

The generation completion gate explicitly rejects physical stock balances by
location (including multi-warehouse requests) even when a stock table and
reservation UI are otherwise valid. The receipt's location UUID remains only
a label; there is no independent location quantity or atomic transfer rule.

## Independent counter debit identity for stock settlement — 2026-10-17

PR #269 merged as `d516630b26995149feb4610d4dc28c75f3814d9b` after
exact-head Release Gate `38976524381` passed; its Vercel status also passed.
Its source tree matches the local baseline `3b26c1c58843645034c0ecd4dd14a01516d5e200`.

Review found that stock fulfillment reused the client-chosen stock receipt UUID
as a public counter request UUID. If an earlier public adjustment used the same
item, delta and UUID, the counter returned `already-adjusted` and stock could be
marked fulfilled without its own debit. A different prior adjustment caused an
identity mismatch instead. Fulfillment now uses a server-generated UUID for the
internal counter debit and requires the result `adjusted`; any other result
aborts the transaction. Existing item/receipt locks and terminal stock status
remain the replay authority, including concurrent and lost-response retries.

The existing isolated PostgreSQL regression adds actual public-counter/stock
receipt collisions with both matching and different adjustments, simultaneous
fulfillment, retry without double debit, and preservation of the original public
counter receipt's identity. Static SQL, opt-in, source and schema checks run
locally; native PostgreSQL is unavailable in this container and exact-head CI
must pass before merge. The trusted generated BYO publish bundle is refreshed.
No historical/customer migration, new dependency, live key, customer Production
activation or Social Hub change. Existing installations require separately
reviewed SQL upgrade; the exact catalog verifier refuses outdated function bodies.
Physical multi-location balances and transfers remain an open engine capability.

## Physical stock levels by owner, item and warehouse — 2026-10-17

Continue from merged #270 `07c7b9ea5a871acbc408f3182c36371ae5ca740f`.
Its exact-head Release Gate `38986228957` passed on `a6ed8aed`; the local
baseline tree is the identical `27c7d73bbeef04cfde11fe30529e4215b9182672`.

A new initial-install `table.stockLocations={itemFieldId,locationFieldId}`
declaration uses existing stock-level row counters and reservations. Both
required fields reference distinct owner-only catalog and warehouse tables.
One owner/item/warehouse tuple is unique and its dimensions cannot be edited.
Composite owner foreign keys retain ownership even if an operator disables a
normal audit trigger; normal owner RLS and restrictive deletes still apply.
No second product total or parallel stock engine is introduced.

Reservation SQL requires the warehouse actually saved on that level row.
Availability/holds/fulfillment and expiry remain scoped to that level; a different
warehouse's units cannot cover its shortage. Stock controls require visible
item, warehouse and quantity columns. The localized hold form pins its warehouse
from the displayed row; ordinary edit controls keep both dimensions read-only.
AI repairs preserve the declaration. Generation requires a real bound physical
stock view and still rejects a plain location label. Atomic warehouse transfers
remain unsupported and are explicitly refused rather than represented as two
unrelated adjustments.

Normal initial schema/source compilation and stock installation/publication
verification include the new SQL. The read-only proof checks exact function
bodies and privileges, dimension types/nullability, the unconditional enabled
identity trigger, immediate unique keys and validated owner foreign keys.
Existing stock applications still require a separately reviewed database
migration; identical definitions remain read-only no-ops.

The new dedicated PostgreSQL fixture covers independent warehouse quantities,
wrong-location/foreign-owner denial, concurrent last-unit holds, fulfillment
retry, immutable dimensions/owner references and refusal after catalog drift.
The existing en/ar/sv browser fixture adds warehouse pinning, immutable edit
controls and actual reserve/release calls through the controller. Local strict
validation/generation/repair, schema/source, seven reference projects,
requirement coverage, TypeScript, scoped ESLint and ES2020 fixture bundling pass.
Native PostgreSQL/Chrome and the exact-head Release Gate remain required before
merge; local fixture transport is not live GoTrue/PostgREST evidence.

No new OSS dependency/source import, live migration, key or provider activation,
customer Production promotion or Social Hub work. Transfers, stock valuation,
shared-organization stock, reviewed existing-DB upgrades and final live evidence
remain open; do not infer them from this physical-level capability.

PR #271 first native run passed physical stock/ownership/concurrency cases and
its new exact stock catalog proof, then stopped at the existing general owner
INSERT policy comparison. Extend that comparison only for the exact generated
PostgreSQL conjunction (including both new-owner checks), with negative drift
regressions; do not relax RLS or replace semantic proof with policy names.

## Atomic transfers between physical warehouse levels — 2026-10-17

Continue from merged #271 `92c758aac0e45d2470bea68ec0d15d3efc45dc44`,
whose exact-head Release Gate `39032861389` passed on `b3d30f5d`.
The matching local baseline tree is `6c753921707902d6dbfe517ca84f2e651f0d0e52`.

New physical stock installations compile an authenticated single-item transfer
RPC and private immutable request receipts. Both existing level rows must belong
to the same actor/item and different warehouses. The database locks both level
UUIDs in sorted order, claims one receipt, then calls the existing guarded counter
engine for debit and credit with independent server-owned UUIDs. Counter bounds
and unexpired hold floors remain authoritative. A failed leg aborts both legs,
the transfer receipt and internal counter receipts. A completed retry returns the
same result before testing current stock, with source/destination/quantity
identity checked; a changed request is refused.

The saved `stock-transfer` data-view action requires physical stockLocations and
visible item/location/quantity columns. It uses the existing owner-pinned SDK
bridge and bounded same-item destination pagination. The controller persists a
strict session receipt before transmission and refuses changed destination or
quantity after uncertainty. The localized UI freezes uncertain transfers and
restores them across a same-tab reload. Corrupt storage, blocked storage and actor
changes fail closed; no shared/private stock rows are cached. Generation requires
the bound transfer action, not two adjustment controls. Multi-item atomic batches,
shipping and cross-organization transfers remain unsupported.

Publication proof now verifies the exact transfer functions and their grants,
private ledger ACL/RLS, strict receipt columns, primary-key uniqueness and
restrictive foreign keys/checks. Existing stock databases still need separately
reviewed upgrades; no automatic migration is enabled.

Local definition/generation, durable controller/RPC, schema/source, reference
projects, requirement coverage, TypeScript, scoped ESLint and ES2020 fixture
bundling checks pass. The dedicated native fixture now tests held-unit floors,
matching actor/item, credit-failure rollback, same-ID replay after stock changes,
competing transfers, opposite-direction locking, identical concurrent requests,
expired holds, the actual RPC adapter and catalog drift. The existing en/ar/sv
browser fixture tests destination selection, uncertain-result freezing, reload
retry identity and account-switch clearing. Native PostgreSQL/Chrome and final
exact-head Release Gate are required before merge; fixture evidence is not a
live customer GoTrue/PostgREST/provider verification.

No new OSS code/dependency, live database/history migration, key, provider
activation, customer Production promotion or Social Hub work. Reviewed existing
DB upgrades, broader engine capabilities and final live release evidence remain
open. Do not infer stock valuation or multi-item transfer batches from this slice.
