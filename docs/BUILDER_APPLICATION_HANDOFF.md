# Application generation and customer ownership

The published Apex Dental example exposed three distinct gaps: AI generation dropped application definitions and form bindings; internal CTA paths escaped the project URL and pointed at missing anchors; the independent publishing panel was not mounted in the editor.

## Behavior in this change

- Generation accepts validated application definitions alongside native editable pages. Page access rules use response slugs and resolve to the actual retained page IDs.
- Native contact forms retain their fields and application bindings; invalid mappings, unexpected configuration, public writes, unbound app forms, missing access-rule pages, application page-limit truncation and declared unsupported features abort before editor state or history changes.
- Appointment requests cannot be applied as auth-only descriptive pages without a bound form. Brochure sites remain supported.
- Known root-relative AI routes become `page:<slug>` references. Missing project pages/anchors and routes escaping the project block publishing and independent source export. Page links preserve fragments.
- Infrastructure readiness no longer treats connected, outdated-schema or deployment-failed records as ready.
- Settings includes the independent Preview/Production publisher. Connection availability remains explicit. `VITE_WEBSITE_BYO_PUBLISH_ENABLED=true` is required in addition to all three valid connection endpoints; it defaults to false. Unsaved projects cannot start independent publishing. Persisted ready/blocked operations are reread from the server on reopening rather than being inferred from browser storage.
- Application generation reports that the backend has not yet been provisioned. The Tayar page publisher remains blocked for application definitions and points users toward their own infrastructure.
- Independent export includes the application runtime, application-definition.json, initial database schema with access policies, and HANDOVER.md. No runtime rows, provider secrets, or platform endpoint are exported.

## Ownership after handover

GitHub source, dedicated Supabase data/Auth and Vercel hosting belong to the connected customer's accounts. Tayar is setup/editing tooling. The deployed runtime operates independently of Tayar, and the customer manages billing, backups, user administration, monitoring and maintenance.

Setup OAuth permissions and application runtime credentials are different. Removing runtime credentials will break the application. Existing provider disconnect actions may deliberately clean runtime settings for security; they must not be presented as a safe automatic final-handover action. The handover document explains verifying the deployment and revoking setup applications through provider account settings while retaining runtime credentials.

The exported schema is for reconstructing a NEW dedicated project, not rerunning on an existing database and not a data backup.

## Live activation is still incomplete

Read-only production inspection on 2026-10-07 found no deployed `website-github-connection`, `website-supabase-connection`, `website-vercel-connection` or `website-byo-publish` functions. Browser connection endpoint settings existed for Preview only, not Production. No production provider settings, account permissions, paid plans or existing client projects were changed by this work.

Before enabling the production flag:

1. Verify/register the official GitHub App, Supabase OAuth application and Vercel integration with exact HTTPS callbacks and minimum required permissions. Keep provider client secrets server-side.
2. Use the existing isolated activation preflight, apply/verify its database migration manifest and deploy the generated connection/publishing functions with the existing JWT configuration. Do not point customer resources at Tayar's own accounts.
3. Configure browser endpoints only after checking provider consent, target selection, disconnect/cleanup and source export on isolated customer test accounts.
4. Test Preview followed by Production: sign-in, a bound form write, another user's read denial, role-protected pages and operation retries.
5. Verify the published app continues to work after setup authorization is revoked. Only then enable the Production browser flag and call handover complete.

No provider setup consent or real customer-owned deployment was performed in this change. A passing code suite does not replace those tests.

## Supported scope and remaining application work

The existing runtime supports Auth, role-protected pages and create forms. It does not implement a complete clinical management system. Calendar conflict handling, SMS/email, data dashboards and editing views, files, prescription dispatch and inventory workflows require additional native runtime adapters and complete-flow tests. Generation must explicitly reject those requested features instead of substituting descriptive sections.

The existing Apex Dental publication has not been rewritten or republished. It needs a new complete application revision after the relevant adapters and live connection activation are ready.

## Validation

The new regression exercises the actual AI generation handler. It fails on baseline main (`5ff20905`) because the application definition is dropped, and passes with this change. It also checks native forms, internal routes, page access identity, history snapshots and atomic rejection of unsafe/incomplete results.

Application, independent infrastructure/publishing and owned-source suites pass. TypeScript, production build and ESLint have been checked; four existing unused-directive lint warnings and the existing large-bundle build warning remain. Full project health was resumed after adding the new Arabic/Swedish UI phrases.
