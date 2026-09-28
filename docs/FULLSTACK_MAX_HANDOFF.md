# Fullstack MAX — resume here

Updated: 2026-09-28.

## Canonical working branch

`internal-fullstack-max-continue-20260927`

GitHub: https://github.com/khatay1/Tayar-Intelligence-Tools/tree/internal-fullstack-max-continue-20260927

Base main commit: `2643566473d5e255b948574224dc9369036a1046` (all earlier completed Fullstack MAX foundations consolidated).

The owner explicitly requested continuing on this GitHub side branch so work survives a usage limit/session interruption. Save tested batches here. Do not merge to main or deploy production until the full requested work is complete. The `internal-*` Vercel auto-deploy exclusion applies; main auto-deploy is also disabled. Keep runtime/release/session flags off.

## Latest completed batch — guarded request-identity upgrade and preflight

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
2. Run the guarded `_tayar_request_id` upgrade on a disposable legacy isolated backend and verify PostgreSQL uniqueness/trigger/RLS behavior and same-request recovery in a transaction. Resolve the mixed legacy/additive table case before automated lifecycle application. Then connect the saved form controller to stable request IDs and published listeners, only lifting the renderer gate when those paths are proved. Verify editor mapping interactively in a real browser. Keep unbound contact forms on their existing path. Follow with read/list/update/delete bindings and action sequences. No global privileged client is exposed.
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
- `scripts/application-form-runtime-regression.mjs`
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
