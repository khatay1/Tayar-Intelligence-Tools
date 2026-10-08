# Application generation and customer ownership

The published Apex Dental example exposed three distinct gaps: AI generation dropped application definitions and form bindings; internal CTA paths escaped the project URL and pointed at missing anchors; the independent publishing panel was not mounted in the editor.

## Behavior in this change

- Generation accepts validated application definitions alongside native editable pages. Page access rules use response slugs and resolve to the actual retained page IDs.
- Native contact forms retain their fields, application bindings and success/automation settings for validation; unsupported application redirects and enabled automations abort instead of being silently discarded. Invalid mappings, unexpected configuration, public writes, unbound app forms, missing access-rule pages and declared unsupported features abort before editor state or history changes.
- Generation sends the actual subscription page allowance to the model (up to 100 pages), retains every generated page and section within native limits, and rejects over-limit, empty or unsupported plans atomically for both brochures and applications. The former six-page/eight-section truncation is removed. Missing optional actions no longer produce invented `Learn More` buttons pointing at nonexistent contact sections; explicit navigation buttons without destinations are rejected.
- Appointment requests cannot be applied as auth-only descriptive pages without a bound form. Brochure sites remain supported.
- Known root-relative AI routes become `page:<slug>` references. Missing project pages/anchors and routes escaping the project block publishing and independent source export. Page links preserve fragments.
- Infrastructure readiness no longer treats connected, outdated-schema or deployment-failed records as ready.
- Settings includes the independent Preview/Production publisher. Connection availability remains explicit. `VITE_WEBSITE_BYO_PUBLISH_ENABLED=true` is required in addition to all three valid connection endpoints; it defaults to false. Unsaved projects cannot start independent publishing. Persisted ready/blocked operations are reread from the server on reopening rather than being inferred from browser storage.
- Application generation reports that the backend has not yet been provisioned. The Tayar page publisher remains blocked for application definitions and points users toward their own infrastructure.
- Independent export includes the application runtime, application-definition.json, initial database schema with access policies, and HANDOVER.md. No runtime rows, provider secrets, or platform endpoint are exported.

## Native record views

Content sections can save `applicationDataView` references to a declared table,
visible field IDs, allowed CRUD actions, pagination size and an optional text
search column. AI generation, manual inspector editing, native snapshots and
independent source export retain the same binding. Invalid table/column/action
references and dashboards without a bound view abort before generation applies.

The published component reads and writes only through the isolated customer
Supabase runtime. It checks current identity/roles before each action and current
identity after responses; database RLS remains authoritative. Every mutation must
return a confirmed result, and deletion asks the site's user for confirmation.
Search escapes wildcard characters; field forms validate declared data types;
records render as text, never HTML. Account changes, logout and page disposal
clear the UI. Create requests persist only a scoped UUID and SHA-256 fingerprint
in tab storage so an uncertain commit can be reconciled after a reload without
duplicating a row. Submitted values and record caches are never persisted there.

This supplies working generic record dashboards/editors. Inventory reservations,
file attachments and notification delivery still require dedicated business
adapters; basic CRUD must not claim these.

## Conflict-safe resource bookings

An optional native `table.booking` references a required UUID/resource field and
required start/end datetime fields. Optional required enum status plus an explicit
nonempty list of blocking states lets cancellation release a time. AI generation
and the application data editor retain this rule; appointment requests require a
real create form/view bound to a table with a booking rule, never plain CRUD.

The isolated database compiler installs `btree_gist` in its existing extension
namespace, a finite strictly increasing interval check and a GiST exclusion for
half-open `[start,end)` intervals per resource. Adjacent bookings are allowed.
Concurrent insert/update conflicts are enforced even when RLS hides other users'
rows. Activation of a cancelled booking must pass the same constraint. Customer
publish preflight requires the actual validated exclusion/check constraints and
required typed columns, not just a saved schema revision. Additive migrations can
introduce a new rule atomically; removing/changing an existing rule needs a
reviewed data migration. Existing conflicting rows abort rather than being deleted.

Native views provide local datetime controls. The runtime translates known
conflict/interval rejections in English, Arabic and Swedish. A confirmed rejection
on a freshly allocated request can be corrected; a replay after an uncertain
outcome retains its UUID and cannot abandon an earlier possible commit. No
runtime rows or resource samples enter snapshots. Reference fields now use actual related-record selectors with names, search and
20-record pagination. They read only through the target table's declared access
and RLS, verify identity after responses, retain an existing out-of-page ID and
render labels as text. Choices and related rows are never cached in snapshots.
UUID-only fields still accept real operator-supplied IDs. Calendar grids, availability picking,
recurrence, multi-resource booking and business-hours enforcement remain outside
this adapter's scope.

## Generic quantity operations

Optional `table.counter` targets a required numeric field defaulting to its configured
minimum, with an optional maximum and integer-only rule. Stock items, quotas and
points use the same native `adjust` data view action. Normal editing cannot overwrite
the protected field. A single database transaction locks an authorized row, checks
current read/update policies, applies a signed delta within bounds and records the
actor/request UUID in a private idempotency ledger. Concurrent deductions cannot
cross the minimum; concurrent or lost-response retries cannot apply twice.

Write guards require a private transaction context which browser roles cannot forge.
The public RPC is an invoker wrapper around a private narrowly scoped implementation.
Customer preflight verifies exact function bodies/grants, ledger uniqueness, required
typed columns, active guards and bounds. Permission upgrades replace the RPC bodies
alongside RLS; removing/changing deployed counter rules requires reviewed migration.
The independent source includes the same schema and runtime. Initial records start at
minimum; operators use adjustments for opening quantities. This is an atomic operation
on one record, not a multi-product order/payment/reservation workflow or financial ledger.

## Ownership after handover

GitHub source, dedicated Supabase data/Auth and Vercel hosting belong to the connected customer's accounts. Tayar is setup/editing tooling. The deployed runtime operates independently of Tayar, and the customer manages billing, backups, user administration, monitoring and maintenance.

Setup OAuth permissions and application runtime credentials are different. Removing runtime credentials will break the application. Existing provider disconnect actions may deliberately clean runtime settings for security; they must not be presented as a safe automatic final-handover action. The handover document explains verifying the deployment and revoking setup applications through provider account settings while retaining runtime credentials.

The exported schema is for reconstructing a NEW dedicated project, not rerunning on an existing database and not a data backup.

## Live activation is still incomplete

Read-only production inspection on 2026-10-07 found no deployed `website-github-connection`, `website-supabase-connection`, `website-vercel-connection` or `website-byo-publish` functions. Browser connection endpoint settings existed for Preview only, not Production. No production provider settings, account permissions, paid plans or existing client projects were changed by this work.

The follow-up inspection also found all 34 infrastructure migrations absent from production migration history; a catalog query confirmed that the connection/OAuth tables are absent. This is a deployment gap, not a browser cache problem. GitHub Release Gate for the initial change completed successfully, including browser regression, full project health, production build and dependency audit.

Use `npm run preflight:website-builder:deployment-inventory -- <inventory.json> pnbllxdlskljcakyaylt` to compare a names-only live inventory against the required manifest. It exits unsuccessfully for missing migrations, inactive functions, wrong JWT settings, an unexpected project or missing target-wide browser configuration. It never returns inventory values or secrets. The inventory contains `projectRef`, `target` (`preview` or `production`), `migrations` (objects with `version`), `functions` (objects with `name`, `status`, `verify_jwt`) and `environmentKeys` (objects with `key`, `target`, optional `gitBranch`/`customEnvironmentIds`). Obtain these from current provider inventories; do not treat an old saved inventory as deployment proof. Passing this check still requires the isolated configuration preflight and actual consent/customer-flow verification.

Exact callbacks for the current Tayar platform project:

| Provider | OAuth callback |
| --- | --- |
| GitHub | `https://pnbllxdlskljcakyaylt.supabase.co/functions/v1/website-github-connection?action=callback` |
| Supabase | `https://pnbllxdlskljcakyaylt.supabase.co/functions/v1/website-supabase-connection?action=callback` |
| Vercel | `https://pnbllxdlskljcakyaylt.supabase.co/functions/v1/website-vercel-connection?action=callback` |

Browser endpoint values are those same URLs without `?action=callback`. Register the integration applications under Tayar's operator account; customer repositories, databases and deployments must be created in the consenting customer's account. Integration registration itself does not transfer customer account ownership. The connected tools cannot inspect or register these operator OAuth applications or manage Supabase function secrets. Their registration and server-side credential configuration must be completed through the providers' application settings; do not send client secrets in chat or commit them.

Before enabling the production flag:

Browser verification on 2026-10-07 confirmed that the existing GitHub App, two published Supabase OAuth apps and private Vercel integration already target the isolated Activation project `uepltkguloltmebepvbo`. Its four connection/publish functions are ACTIVE. Its migration history uses Management API deployment timestamps with source identities in the migration names; inventory verification now accepts exact source names as well as original versions. These isolated registrations must not be overwritten with production callbacks merely to expose production buttons.

The authorized Supabase application has Database read/write, Organizations/Projects/Secrets read-only, and no other scopes. The current flow selects an existing dedicated customer project; it does not create a customer Supabase project. The Vercel integration has Projects/Teams/Current User read and integration-owned environment variable write. On 2026-10-07, after explicit action-time user approval, Deployments was upgraded from no access to read/write. Vercel accepted the scope-update note and the saved setting was verified after reloading the integration page. The other scopes remained unchanged. Existing installations may require their users to approve the increased scope; registration-level scope alone does not prove token-level access or a completed customer deployment.

The isolated platform refuses resources in its own Supabase organization and Vercel account. Full customer flow tests need separate customer-owned test resources and explicit customer consent. Operator-app setup alone is not a completed application handover.

The tested `website-byo-publish` bundle was deployed to Activation on 2026-10-07 as version 8. A fresh provider inventory confirmed ACTIVE status and `verify_jwt=true`; Production was not deployed. Release Gate run 37593055682 passed, including the real browser scenarios, after increasing the hosted Chrome startup endpoint deadline from 10 to 20 seconds (the previous failed job showed DevTools starting just after the ten-second deadline). The whole-suite hard timeouts and assertions remain enforced. The local browser suite could not start because Chrome is absent in this workspace; the successful hosted run supplies that validation. Customer OAuth consent and full customer Preview Publish remain pending.

1. Verify/register the official GitHub App, Supabase OAuth application and Vercel integration with exact HTTPS callbacks and minimum required permissions. Keep provider client secrets server-side.
2. Use the existing isolated activation preflight, apply/verify its database migration manifest and deploy the generated connection/publishing functions with the existing JWT configuration. Do not point customer resources at Tayar's own accounts.
3. Configure browser endpoints only after checking provider consent, target selection, disconnect/cleanup and source export on isolated customer test accounts.
4. Test Preview followed by Production: sign-in, a bound form write, another user's read denial, role-protected pages and operation retries.
5. Verify the published app continues to work after setup authorization is revoked. Only then enable the Production browser flag and call handover complete.

No provider setup consent or real customer-owned deployment was performed in this change. A passing code suite does not replace those tests.

## Supported scope and remaining application work

The runtime is shared across project types: Auth, role-protected pages, create forms, bound data dashboards/editing views, related-record selectors, conflict-safe single-resource bookings and atomic single-record stock/quota/points adjustments. These are reusable capabilities for customer portals, resource management, membership tools and inventory applications. Full multi-product order/payment/reservation transactions, live calendars/availability, recurring scheduling, SMS/email and files still require additional runtime adapters and complete-flow tests. Generation must explicitly reject unsupported requested features instead of substituting descriptive sections.

The existing Apex Dental publication has not been rewritten or republished. It needs a new complete application revision after the relevant adapters and live connection activation are ready.

## Validation

### Same-admin clinic inspection — 2026-10-07

After explicit action-time approval, the private GitHub App `Tayar Deployment Production` was registered under `khatay1` on 2026-10-07. App ID: `5222279`; client ID: `Iv23ctpkgbYFLxCyAr23`; settings: `https://github.com/settings/apps/tayar-deployment-production`. Its callback is the Production `website-github-connection?action=callback` URL above. The approved permissions are repository Contents read/write plus mandatory Metadata read; installation is restricted to the owner's account. Webhooks are inactive. GitHub visibly reported Registration successful. No client secret/private key was generated, no app installation occurred and no server credentials or Production functions were configured by this registration. Secure credential generation/configuration remains a user handoff, and the existing Activation application remains separate.

The production browser was signed in through secure authentication as `khaled`, visibly marked `Admin · Business Access`. The existing Apex Dental project (`c3b19c4e-ec97-4fd9-a9c9-c1a1a3d00ce9`) was opened from recent files. It has six pages and no persisted `application` definition. Its infrastructure panel exposes disabled GitHub/Supabase/Vercel actions; refreshing returns unavailable infrastructure status. Production has neither `public.website_infrastructure_connections` nor `website_infrastructure_connections_for_owner(uuid)`.

The published staff portal has no login form or `staff-login` target. Booking has contact fields (name/email/message), no appointment date/doctor fields and no `booking-form` target. No form was submitted, project content edited or clinic republished during inspection.

The saved clinic also incorrectly displays a save-before-backend message when its actual missing prerequisite is the application definition. The reviewed fix separates unsaved-project messaging from missing data/access configuration, and separates infrastructure saving from connecting/verifying accounts. Arabic and Swedish translations and saved/unsaved regression cases are included.

Activation contains neither the production admin UUID nor this clinic project. A Preview test there cannot be claimed as a test of the same account/project. Connector inventories expose only the Tayar Tools Supabase organization and Vercel team. The next real customer flow requires an independently owned test backend/hosting target and consent. Production activation requires separate operator applications/credentials and the reviewed migrations/functions; copying Activation callbacks into Production frontend configuration would cross authentication boundaries and is not a valid fix. Do not merge/activate Production merely to remove the disabled buttons, seed verified connection rows, or weaken the customer-resource ownership guards.

The new regression exercises the actual AI generation handler. It fails on baseline main (`5ff20905`) because the application definition is dropped, and passes with this change. It also checks native forms, internal routes, page access identity, history snapshots and atomic rejection of unsafe/incomplete results.

Application, independent infrastructure/publishing and owned-source suites pass. TypeScript, production build and ESLint have been checked; four existing unused-directive lint warnings and the existing large-bundle build warning remain. Full project health was resumed after adding the new Arabic/Swedish UI phrases.
