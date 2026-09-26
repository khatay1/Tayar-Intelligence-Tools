# Tayar project audit — 25 September 2026

## Scope and evidence

Reviewed the Vite/React application, registered tool modules, admin views, Supabase policies/functions, website publishing, package dependencies, and public production pages. This is a code and automated regression audit plus an anonymous live-site check; authenticated customer and admin browser journeys require test accounts and were **not** claimed as end-to-end verified. Missing third-party API keys were expected and not considered source defects.

| Area | Coverage | Outcome |
| --- | --- | --- |
| Application shell, auth, preferences, projects, notifications, analytics | Source review, targeted behavioral regressions, TypeScript, lint, build | Session race, stale result, conflict, count, and analytics fixes prepared |
| Admin: dashboard, users, AI, tools, subscriptions, support, content, system | Source review, mocked pagination/update regressions, static health | Pagination and inaccurate zero-row success handling corrected; sensitive flows still require authenticated browser verification |
| Tools: CV, cover letter, writer, translator, document AI, study assistant, PDF, code assistant | Registry, existing smoke suite; targeted fixes for cloud projects and clipboard feedback | Automated checks pass; API-dependent generation needs configured keys and authenticated test users |
| Tools: website builder, team workspace, invoices, image tools, CSV cleaner, templates, name/letter/prompt generators, batch images, cropper, background removal, image-to-PDF | Registry, existing smoke suite, builder reachability and published runtime checks | Automated checks pass; no claim every interactive operation was manually exercised |
| Database and Edge Functions | Public table RLS inventory, admin authorization probe, security advisors, function source/syntax | 49 public tables had RLS; anonymous `is_admin()` returned false; review security-advisor items below |
| Public production UI | Anonymous browser smoke in Arabic/Swedish | Loaded without application JavaScript errors; admin/private pages not verified |
| Dependency audit | `npm audit --omit=dev` | 0 known production dependency vulnerabilities at audit time |

## Corrections in this branch

- Authentication and admin privilege state are cleared and sequenced across account changes; delayed requests cannot repopulate prior-user state.
- Project saves, renames and deletes report real failures and concurrent conflicts. Notifications count and pagination include all matching rows and isolate current account state.
- Admin dashboard totals paginate beyond the Supabase default page limit and show unavailable state on fetch failure. User, support, content, and system edits handle missing rows/errors. Content draft conversion has a dedicated pure helper.
- Preferences reject malformed local state and stale cloud responses. Analytics are sent in bounded batches. Template-library results are scoped to the current request. Tool copy actions surface clipboard failures; four missing Arabic/Swedish labels were added.
- Scheduled publishing is **disabled safely**: the existing Edge executor picked the newest preview, rather than the intended snapshot, and removed live files before its replacement was verified. Readiness is false, new scheduled rows are rejected in the database, and the Edge entry point returns 503 for execution. There were no queued/processing/failed scheduled rows at the time of inspection. Re-enable only after a specific immutable release is bound to each schedule, rollback/concurrency are addressed, a cron secret and job are configured, and a staging-to-production end-to-end test succeeds.

## Outstanding operational and verification items

1. **Scheduled publishing:** Not available. `pg_cron`/`pg_net` were not installed, the cron secret/job and Edge deployment were missing, and the legacy implementation was unsafe. The guard migration is already applied to the linked Supabase project; the source migration and Edge guard belong in the same release.
2. **Authenticated journeys:** Test sign-in/out, each admin view, purchase/subscription actions, AI providers and builder publishing with dedicated nonproduction accounts before claiming full end-to-end coverage. Do not insert real customer records just for testing.
3. **Supabase security advisors:** Five internal RLS tables have no policies, five anonymous callable `SECURITY DEFINER` functions need continued review of intended public entry points/rate limits, leaked-password protection is not enabled, and 37 unused-index informational findings need workload-based review. These are not all actionable bugs; do not remove indexes or public forms without traffic analysis.
4. **Billing metric:** Dashboard “Est. MRR” is an estimate based on plan assumptions, not reconciled Stripe revenue. Treat it as approximate until connected to billing records.

## Verification commands

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run health:project` (includes audit regressions, Edge syntax, PDF, website builder and other module smoke suites)
- `npm audit --omit=dev`

Keep the fixes on an isolated review branch until the automated gate is green. The database guard was applied immediately so the current UI cannot enqueue jobs that cannot run.

## Follow-up: publishing workflow integrity

Corrected the workflow service production folder to match the live route, rejected malformed owner/project IDs without rewriting them, isolated archive restoration to the current project, used the existing non-overwriting archive uploader, and restored the prior live snapshot after public-route verification failure. The built-in publishing bridge now rejects unsupported selective publication instead of publishing the whole website. Scheduled timestamps are serialized as UTC ISO values and rescheduling performs the same readiness check as new schedules. Scheduler activation remains blocked pending a snapshot-bound executor and operational configuration. Behavioral regressions cover live destination, invalid archive rejection, verification rollback, rollback failure reporting, immutable archive delegation and the selective publication guard.

The live storage traversal also excludes the project staging folder, so production snapshots, replacements and unpublishing cannot delete staged files. Existing localization regression now asserts the production listing never visits staging, previews or release history.

## Production pricing follow-up

Verified on the live Arabic page after the catalog request finished: Free $0, Pro $19/month, Business $49/month, with live tool limits. A previous early page snapshot showed the fallback during loading; the catalog service later returned HTTP 200. The pricing component now reports a localized loading state until the request resolves. Paid checkout was not exercised without a test account.

## Follow-up: release rollback integrity

Release restore now validates the archive owner/project/version prefix and every manifest path before changing live storage. Archive deletion also checks its target before deleting the database row or storage files. The rollback handler checks the public published route before committing the project state, so failed verification restores the previous live snapshot. Scheduled publishing remains disabled: its former executor relied on the newest preview, which is revoked when a later preview is created; it needs a durable release snapshot plus safe concurrency control and cron/secret configuration before activation.

Archive deletion now also reads the stored release record and compares its path and complete file manifest with the requested target before deleting anything. This prevents a stale or forged editor release entry from deleting a record while leaving archived files behind, or deleting files from another archive in the same project. The regression covers mismatched stored paths and manifests.

## Follow-up: restore preflight and live inspection

Release rollback now downloads every archived file and validates the archived HTML entry point before changing live storage. It uploads the replacement first, checks the new live `index.html`, and only then removes files absent from the restored version. Regressions confirm missing or invalid archives leave the live site untouched and a failed upload restores the previous snapshot. The live public catalog endpoint returned Free $0, Pro $19/month, Business $49/month; the isolated inspection browser blocks direct Supabase requests, so its pricing fallback is not evidence of a production pricing failure. The public landing and sign-in page loaded in Arabic. Supabase security advisors still report five intentionally private RLS tables without policies and five intentionally public visitor RPCs; review abuse controls separately before changing grants. The scheduler remains disabled and currently has no pending or failed tasks; `pg_cron` and `pg_net` are unavailable in the linked project.

## Follow-up: internal publishing routes

The public website renderer now rejects `/site/{owner}/{project}/staging/...` and `/preview/{owner}/{project}/{token}/release/...` before fetching storage. Both paths expose internal publishing material, not visitor-facing pages. The publishing panel labels scheduled and selected-page releases as unavailable, blocks submitting those modes, and lets an older saved schedule date be cleared to publish immediately. This is a route-level protection only: the `published-sites` Supabase bucket is public, so its direct storage URLs remain readable if a path is known. Moving staging, previews and archives into private storage requires a coordinated server fetch change and migration before claiming those files are private. Scheduled publishing remains blocked until it has a snapshot-bound executor, concurrency protection, and cron configuration.

## Follow-up: cloud staging action (2026-09-26)

The publishing panel's staging action now calls the actual cloud share-preview handler instead of the local browser preview. It awaits a boolean result and reports failed staging; the primary button explicitly says Create staging preview. The handler now includes initial project synchronization inside its try/finally so rejected saves cannot leave the busy state stuck. Behavioral tests cover the cloud callback, failure propagation, save rejection, failed synchronization, unhealthy preview routes, revision conflicts, and retaining the previous preview until the new one commits. Local lint and production build pass. These checks do not replace an authenticated browser journey against a test project.
