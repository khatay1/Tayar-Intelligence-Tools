# Fullstack MAX — resume here

Updated: 2026-09-28.

## Canonical working branch

`internal-fullstack-max-continue-20260927`

GitHub: https://github.com/khatay1/Tayar-Intelligence-Tools/tree/internal-fullstack-max-continue-20260927

Base main commit: `2643566473d5e255b948574224dc9369036a1046` (all earlier completed Fullstack MAX foundations consolidated).

The owner explicitly requested continuing on this GitHub side branch so work survives a usage limit/session interruption. Save tested batches here. Do not merge to main or deploy production until the full requested work is complete. The `internal-*` Vercel auto-deploy exclusion applies; main auto-deploy is also disabled. Keep runtime/release/session flags off.

## Current source batch — editor integration secret storage

- Owner-facing read-only Vault inventory (2026-09-28): the saved-project integrations panel can check scoped reference counts (linked, missing and unlinked) through the existing owner-only reference RPC. Results are discarded if project/user/load sequence or editor configuration changes. Invalid/duplicate/foreign-project RPC rows fail closed; no plaintext credential is fetched or added to the project snapshot. EN/AR/SV labels, mocked owner-RPC cases, SSR control, full project health, lint and Vite build passed. Unlinked entries are reported, not deleted; live owner-session/browser proof and deliberate cleanup remain pending.

- Follow-up on 2026-09-28: project Vault references now require an exact UUID/connection/field/environment path. References with extra path segments or malformed IDs cannot appear configured or pass integration validation. Focused integration and writer regressions, TypeScript and ESLint passed. This does not reconcile orphaned Vault entries or verify a live owner session.

- The existing V2 integrations panel now sends a secret entered for a saved cloud project to the owner-scoped Vault RPC through `websiteProjectSecretService`. The project snapshot receives only an opaque reference. The callback rechecks project ID, user ID, load sequence and editor configuration after the RPC; a stale response cannot attach a reference to another project or overwrite newer edits.
- The current integration model has one reference per secret field. The panel therefore enables secret entry only when exactly one environment is selected and explains the constraint in English, Arabic and Swedish. Test-connection and published integration execution remain disabled/unimplemented; production publish blockers remain in place.
- A changed or multi-selected environment invalidates an existing project Vault reference in local configuration checks; the password field no longer labels that reference as configured. Vault cleanup and reference reconciliation remain a separate owner-facing flow.
- PASS secret writer and stale-project regressions, panel SSR for secure-writer/one-environment gating, integration runtime regression, full `health:project`, typecheck and lint. The Vault migration is source only; no production secret or migration was written.

## Previous source batch — refreshed account identity

- Account initialization, sign-in, confirmed sign-up, password recovery completion and protected-page continuation now verify a fresh permanent dedicated Auth user after session-cookie synchronization. A session lost during synchronization cannot leave the account shell in a signed-in state or navigate to a protected page.
- A regression forces logout between the stale session read and bridge synchronization, and again before protected navigation. The controller stays signed out and refuses navigation. Browser bundle and local application tests passed; a real isolated-host multi-tab browser test is still required.

## Previous source batch — account role controls (2026-09-28)

- The isolated account shell now shows the signed-in user's own UUID after dedicated Auth verification. When the dedicated backend confirms role administrator status, it reveals a role form for a known target UUID and a declared application role. Grant/removal calls recheck the current user and administrator status; the existing security-definer RPC remains the final authority. The shell does not enumerate users.
- Account markup, English/Arabic/Swedish labels and browser bundle were updated. Local controller and route regressions cover manager checks, invalid target/role refusal and hidden controls before verification. On the dedicated validation backend, a temporary administrator grant succeeded and a nonadministrator grant failed inside a rolled-back transaction; post-rollback inspection found no administrator or role grant.
- This source path still needs a real isolated-host browser test for login, role controls, reloads and revocation before publishing. Flags and production remain closed.

## Current source batch — durable request ledger (2026-09-28)

- New isolated schemas now record each non-null form request UUID in a private owner/table/request ledger from an insert trigger. Deleting a business row does not delete this ledger entry; the same request cannot create another row. The capability marker is version 2, and the trusted reader rejects version 1.
- The guarded legacy upgrade accepts an absent marker or version 1, backfills existing request rows, installs the ledger triggers and commits version 2 last. Newly added tables install the ledger trigger when the ledger already exists; otherwise the later guarded upgrade covers them.
- The tab-scoped pending fingerprint includes the destination table ID as well as submitted values, so rebinding a form cannot reuse a request identity. Bound form publication remains closed.
- Local schema, backend and controller regressions passed. On the dedicated validation database, both legacy-to-v2 and v1-to-v2 paths passed inside transactions ending in ROLLBACK, including delete-then-repeat rejection and v1 row backfill. Post-rollback inspection showed no persistent marker, ledger or test row. These are database checks, not live browser/hosting proof.
- The repeatable `scripts/fixtures/application-form-request-upgrade.sql` proof now checks version 2, ledger permissions/triggers and authenticated delete-then-replay rejection. It passed after the generated upgrade in another rolled-back validation transaction.

## Previous source batch — strict same-request reconciliation

- The isolated `createOnce` client now requires a verified permanent dedicated-app user before insert and checks the same identity after a successful response. Following an uncertain insert, it only reports `already-created` if an owner-scoped readable row has the same request UUID **and every submitted field matches**. Missing/different fields or an account change remain uncertain; no raw row or backend error reaches the form.
- PASS SDK/HTTP-mocked tests for no-session preflight, matching row, mismatched/missing field and switched user; full project checks are recorded at the checkpoint. Published bound forms remain blocked pending real browser/Auth and live submission proof.

## Latest source batch — authorized page form listener, still gated

- After successful private-page authorization, the server projects only each valid bound form's page/section IDs, form field constraints and binding references into the page bootstrap. It omits disabled automation settings and all platform lead credentials; the account shell does not get this metadata.
- The isolated page script captures contact-form submissions so Enter cannot fall back to a page POST. Bound forms stay disabled until a dedicated non-anonymous user is checked and the exact form/section match is compiled. Each submit rereads the dedicated Auth user, uses the tab-stable `createOnce` controller, serializes pending clicks, and shows a distinct uncertain result without clearing values. Sign-out/pagehide disposes the controllers. Unbound contact forms remain disabled on private app pages.
- PASS projection privacy/validation regression and application suite with regenerated browser/release bundles. This is not enabled for new bound releases: the release service still refuses publication. Real browser, auth callback and live published form submission tests remain required before opening the gate.

## Latest source batch — disabled private form HTML

- The trusted private renderer now validates a saved binding and can produce the existing contact form markup with its submit button disabled and without the platform lead endpoint. The isolated page bootstrap may enable it only after dedicated Auth and matching section checks. The release service continues to refuse bound form publication before upload, including when a custom renderer is supplied.
- PASS direct trusted-render regression for disabled markup and no platform identity, plus release refusal regression. This prepares the real HTML path; it does not open publishing or establish a browser E2E.

## Previous completed batch — durable browser request identity boundary

- Added `createDurableApplicationFormSubmission`, a controller for the dedicated `createOnce` runtime. A caller-supplied key must scope the dedicated project, authenticated user and form. It stores only a random UUID and SHA-256 payload fingerprint in tab session storage before mutation, reuses the UUID for the identical pending payload after reload, and rejects changed values/corrupt storage. It allows an explicit same-payload retry after uncertainty, with owner-scoped database uniqueness remaining the authority.
- Concurrent calls in the same page runtime for the same storage key are serialized; confirmed submissions clear the marker, while uncertain/disposed submissions keep it. Storage or hashing failures stop before the network mutation. This boundary is not wired to published HTML: safe form discovery, identity scoping, lifecycle and live reconciliation still need work. Cross-tab coordination is not proved.
- PASS mocked lost-response/reload, changed payload, failure, concurrency and intentional new-record regression; TypeScript and project checks at this checkpoint. No live browser or database execution.

## Isolated PostgreSQL verification — 2026-09-28

- On the dedicated `Tayar Fullstack MAX Validation` Supabase project only, generated the upgrade from its actual saved legacy definition (vehicles, bookings, locations) and ran it inside a transaction followed by `ROLLBACK`. It passed owner insert and same-request uniqueness, immutable request identity, owner lookup, anonymous insert denial, other non-manager user read denial, column/trigger checks and service-only RPC privilege checks. A second invocation inside the same transaction returned version 1. Post-rollback inspection showed no capability table, no request columns and the original two booking rows.
- The upgrade also tolerates a previously added table with the correctly typed request column and unique index. It validates both before writing the marker and replaces the trigger. Separate rolled-back tests confirmed that a wrong column type or unrelated same-name index aborts the upgrade without a capability marker.
- Moved the privileged capability reader into `private`; the exposed `public` RPC now runs with invoker rights and is granted only to `service_role`. The proof query lives in `scripts/fixtures/application-form-request-upgrade.sql` for a disposable validation backend.
- These checks prove the generated upgrade against the existing test backend, not a production deployment, browser submission or multi-tab recovery.

## Previous completed batch — guarded request-identity upgrade and preflight

- Added a transactional, definition-checked SQL upgrade for legacy isolated app tables. It locks the saved schema revision, adds request UUIDs with owner-scoped unique indexes and immutable triggers, and writes a private version marker last. A repeat call with the same marker is a no-op. A service-role-only revision RPC and dedicated-backend reader let release preparation check the capability against the same isolated backend.
- A saved bound form requires this capability at release time and still fails closed: stable browser request IDs, published listeners and live PostgreSQL behavior are not yet proved. No migration was executed against a live project. The upgrade must run before further additive table migrations on a legacy backend; a mixed pre-upgrade state fails safely and needs an explicit recovery plan.
- PASS local SQL compiler, backend reader and release refusal regressions plus application suite. Full project health, lint and build are recorded below after this batch.

## Previous completed batch — application request identity foundation

- New isolated application schemas and newly added tables include nullable `_tayar_request_id`, a unique `(owner_id, _tayar_request_id)` index and an update trigger that prevents changing the request identity. Ordinary CRUD can omit it. The dedicated public-key client has `createOnce(tableId, values, requestId)` and uses only the declared fields plus that UUID; after a failed insert it attempts owner-scoped reconciliation only when a read rule exists, otherwise reports an uncertain outcome. No platform credential is involved.
- PASS schema compiler assertions and SDK/HTTP-mocked request tests including scope, system-field denial and masked uncertainty; full project health, TypeScript, ESLint, Vite build, application regression suite and generated runtime consistency. These checks do not prove PostgreSQL enforcement or live recovery.
- The saved form controller and published UI do not call `createOnce`; bound publishing remains closed. Never treat this as completed durable idempotency or enable it on production.

## Previous completed batch — manual application form mapping controls

- The V2 section inspector now displays application form data mapping for a selected contact section. It lists only tables with a declared create permission, maps each existing form field to a declared table field, validates the entire binding with the same compiler as private rendering, and saves or removes it through the shared native `update_section` operation. A saved mapping reopens from project state; project/schema changes remount the draft to prevent stale application.
- Added EN/AR/SV labels and a bounded responsive grid. An invalid candidate cannot be saved. The UI warns that a bound form cannot accept records until secure private execution is available; the private renderer continues to refuse publication of bound mutations.
- PASS mapping SSR regression for permission filtering, saved/invalid state; shared command save/JSON round-trip/undo/remove regression. Full health, lint and Vite build run at this checkpoint. No real browser interaction, backend insert or published form behavior is claimed.

## Previous completed batch — persisted form-binding contract

- Added a reference-only `applicationFormBinding` on contact sections. The existing `update_section` operation accepts its bounded shape for manual and AI edits; semantic validation rejects extra keys, submitted values, malformed IDs and non-contact sections. Project snapshots/history carry the field through the existing page model.
- Both native duplication and builder copy remap form field IDs while retaining application table/field references. A trusted private render compiles any saved binding against the current definition and fails closed until durable idempotent application form execution is wired; it cannot silently fall back to platform lead capture.
- PASS shared operation/clone regression, malformed/valid private-render refusal, full project health including the application suite, TypeScript, ESLint, Vite build and generated release bundle consistency. These are local checks, not live browser/backend evidence.
- This is metadata and safety groundwork only. No visual mapping controls or published form execution are enabled. The publishing gate remains closed.

## Previous completed batch — typed application form submission boundary

- Added `application-form-runtime.ts`, compiling existing contact-form field IDs to declared application table/field IDs. The binding carries references only, never submitted values, records or credentials.
- Handles bounded text/number/boolean/date/UTC datetime/UUID/reference/enum/JSON values, required fields/default coverage and basic field constraints. Rejects system fields, unknown/duplicate values, unsupported file/conditional/automation/redirect/regex flows, malformed types and excessive JSON depth/size.
- The submission controller serializes one create operation, captures the compiled scope and never exposes raw backend errors or returned rows. Once an insert call starts, a failure or disposal produces an uncertain result; automatic retry/reset is blocked. Confirmed submissions can be explicitly reset for another intentional record.
- PASS pure boundary tests plus the actual dedicated Supabase client with mocked HTTP, including exact dedicated endpoint/public key, no owner_id injection, RLS rejection, no retry, request serialization and disposal. Full health/TypeScript, lint, Vite build and whitespace pass.
- This is a tested execution foundation, NOT a completed visible form-binding feature. No new project schema metadata or UI was silently enabled. Durable idempotency/reconciliation and authored form integration remain required.
- Browser tooling was checked again: agent-browser and Chrome/Chromium are unavailable in this workspace. Real browser tests remain explicitly pending; no fake DOM test is represented as live browser proof.

## Previous completed page-navigation batch — 2026-09-28

- Successfully authorized isolated HTML page responses now embed the dedicated data/Auth runtime and localized shadow-root account/logout controls. Immutable stored HTML stays unchanged; the response uses only the frozen release public backend/definition.
- Ordinary same-origin links to HTML routes in the immutable manifest synchronize the cookie before navigating. Unicode routes and query/fragment destinations work; external links, downloads, new tabs and same-page anchors retain native behavior. Account management remains reachable even when synchronization fails.
- Navigator blocks overlapping operations and late navigation after disposal; sign-out suppresses an in-flight navigation. Page lifecycle removes event listeners and stops the owned Auth refresh timer; back/forward cache restoration reloads authorization.
- Injection happens only after private page authorization/download on opted-in isolated browser HTML GETs. HEAD, JSON clients, platform/shared origins, errors and account-shell responses do not receive the page bootstrap. Response validators/length metadata are removed after transformation.
- PASS full project health, TypeScript, ESLint, Vite build, route/API regression, navigation ordering/Unicode/failure/disposal regression and generated bundle checks. Network is mocked and navigator tests are pure; this is still not a real browser E2E.

## Earlier completed account-shell batch

- Added a trusted account screen on isolated application origins: unauthenticated HTML GETs for protected pages get a 401 account shell; `?applicationAuth=1` opens account management with a 200 shell for a valid published HTML route.
- The shell does not download private page content. Platform/shared origins, JSON clients, HEAD, invalid manifests, backend preflight failures and permission-denied responses retain their previous behavior.
- Added dedicated application account flows: login, signup, verification notice, password reset with bounded same-app callback, recovery-only password update, local logout and explicit verified Continue navigation. Supports EN/AR/SV and RTL.
- Uses existing dedicated Auth client and cookie synchronization. Server remains the page-permission authority. No Tayar user session or service key is placed in the shell.
- Generated browser bundle is built locally and embedded in the server's trusted shell; no runtime CDN script dependency. Strict shell CSP, no-referrer, no-store, noindex and disabled initial controls are included.
- Account operations serialize and sanitize errors; disposed screens stop their own refresh timer, unsubscribe and abort bridge work. Returning from browser back/forward cache reloads a fresh screen.

## Validation

PASS full project health (including TypeScript), full ESLint, Vite build, new controller regression, actual published/session API regressions with mocked HTTP, generated bundle consistency and whitespace. Final disposal/event adjustments additionally passed focused controller/API tests and lint after bundle rebuild.

Not tested: real DOM interaction/accessibility in a browser, real Supabase email/PKCE delivery, real isolated DNS/deployment, end-to-end app CRUD/payments. Existing mocked test coverage is not live E2E proof.

## Next work — do not redo earlier foundations

1. Verify the account screen in a real browser, including password reset/confirmation links and multiple-tab behavior against an isolated test backend. Resolve any UI/Auth callback defects found.
2. Verify the prepared page listener with a real browser and isolated Auth/backend: form discovery, sign-in, duplicate Enter/click, reload after lost response, user switch, revocation and multi-tab behavior. Then complete trusted private HTML form rendering and only lift the release/renderer gates after these paths pass. Verify editor mapping interactively. Keep unbound contact forms on their existing path. Follow with read/list/update/delete bindings and action sequences. No global privileged client is exposed.
3. Finish isolated backend provisioning/schema application, configured Auth redirects/SMTP and per-app DNS/routing; preserve production separation.
4. Continue the data bindings/actions, integration execution/secrets UI, application Stripe, private publishing lifecycle and A/B/C live release gates in FULLSTACK_MAX_REMAINING.md.

## Key files

- `src/modules/website-builder/core/application-auth-controller.ts`
- `src/modules/website-builder/core/application-auth-copy.ts`
- `src/modules/website-builder/browser/application-auth-screen.ts`
- `src/modules/website-builder/services/websiteApplicationAuthScreenService.ts`
- `src/modules/website-builder/services/websiteApplicationPublishedService.ts`
- `scripts/application-auth-screen-regression.mjs`
- `scripts/application-browser-session-regression.mjs`
- `scripts/build-application-auth-browser.mjs`
- `src/modules/website-builder/browser/application-page.ts`
- `src/modules/website-builder/core/application-navigation.ts`
- `src/modules/website-builder/services/websiteApplicationPageBootstrapService.ts`
- `scripts/application-navigation-regression.mjs`
- `scripts/build-application-page-browser.mjs`
- `src/modules/website-builder/core/application-form-runtime.ts`
- `src/modules/website-builder/core/application-published-forms.ts`
- `scripts/application-form-runtime-regression.mjs`
- `scripts/application-published-form-regression.mjs`
- `src/modules/website-builder/core/editor-value-safety.ts`
- `src/modules/website-builder/core/editor-clone.ts`
- `src/modules/website-builder/services/websiteApplicationRenderService.ts`
- `scripts/application-form-binding-regression.mjs`
- `src/modules/website-builder/v2-ui/BuilderApplicationFormMapping.tsx`
- `scripts/application-form-mapping-regression.mjs`
- `src/modules/website-builder/core/application-schema-sql.ts`
- `src/modules/website-builder/core/application-data-runtime.ts`

Run `node scripts/build-application-runtime.mjs` and `node scripts/build-application-release.mjs` after shared/browser changes; their consistency checks also check the generated Auth and published-page scripts. Run affected tests, `npm run health:project`, `npm run lint`, and `npm run build` when a substantive batch is ready.

## Git transport note

The workspace Git remote can fetch but lacks direct push authentication. GitHub connector writes work. Upload the exact tested tree through connector tree/commit APIs, verify the remote tree SHA equals the local tree SHA, then update only this branch with force=false. Preserve existing commits and inspect new remote work before any update. Never publish node_modules or local credentials. Local work was at `/workspace/scratch/1693ce8be115/tayar-fullstack`; use GitHub if that workspace no longer exists.
