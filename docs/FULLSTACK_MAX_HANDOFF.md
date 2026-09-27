# Fullstack MAX — resume here

Updated: 2026-09-27.

## Canonical working branch

`internal-fullstack-max-continue-20260927`

GitHub: https://github.com/khatay1/Tayar-Intelligence-Tools/tree/internal-fullstack-max-continue-20260927

Base main commit: `2643566473d5e255b948574224dc9369036a1046` (all earlier completed Fullstack MAX foundations consolidated).

The owner explicitly requested continuing on this GitHub side branch so work survives a usage limit/session interruption. Save tested batches here. Do not merge to main or deploy production until the full requested work is complete. The `internal-*` Vercel auto-deploy exclusion applies; main auto-deploy is also disabled. Keep runtime/release/session flags off.

## Latest completed batch

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
2. Embed the existing dedicated application runtime and account-management/navigation controls into published page HTML. Currently the trusted account shell works on protected 401 responses or an explicit account query; successfully served authored pages do not yet have a login/logout toolbar or automatic navigation synchronization wiring.
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

Run `node scripts/build-application-runtime.mjs` and `node scripts/build-application-release.mjs` after shared/browser changes; their consistency checks also check the generated Auth script. Run affected tests, `npm run health:project`, `npm run lint`, and `npm run build` when a substantive batch is ready.

## Git transport note

The workspace Git remote can fetch but lacks direct push authentication. GitHub connector writes work. Upload the exact tested tree through connector tree/commit APIs, verify the remote tree SHA equals the local tree SHA, then update only this branch with force=false. Preserve existing commits and inspect new remote work before any update. Never publish node_modules or local credentials. Local work was at `/workspace/scratch/1693ce8be115/tayar-fullstack`; use GitHub if that workspace no longer exists.
