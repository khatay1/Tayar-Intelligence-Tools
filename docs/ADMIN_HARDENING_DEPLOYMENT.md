# Admin hardening deployment runbook

This release changes both the database authorization layer and the shared server-side authentication used by selected Supabase Edge Functions. Treat it as a coordinated deployment.

## What changes

- Applies `20260829144000_harden_admin_role_and_admin_access.sql`.
- Uses `public.is_admin()` as the trusted administrator check.
- Prevents browser clients from changing `role`, `plan`, or suspension fields directly.
- Adds protected administrator RPCs for user listing and updates; account deletion is routed through the server function so billing and owned storage are cleaned first.
- Adds administrator read access required by the admin dashboard.
- Protects administrator-only support ticket fields.
- Rejects suspended accounts in normal Edge Function authentication while preserving authenticated self-service account deletion.

Affected Edge Functions:

- `ai-engine`
- `billing-admin-control`
- `billing-admin-status`
- `billing-portal`
- `create-checkout-session`
- `delete-account`
- `email-service`
- `public-plan-catalog`
- `stripe-webhook`

## Safe preview

Use PowerShell from the repository root:

```powershell
.\scripts\admin-hardening-deploy.ps1
```

The script defaults to the Tayar Supabase project ref `pnbllxdlskljcakyaylt`. The default mode links that project, lists migration state, and runs:

```text
supabase db push --dry-run
```

It does not apply database changes or deploy Edge Functions.

Supabase documents `db push --dry-run` as the preview step before applying remote migrations. Never use `db reset --linked` against production.

## Apply only after reviewing the dry-run

```powershell
.\scripts\admin-hardening-deploy.ps1 -Apply -ConfirmProduction -ConfirmAuthConfig
```

The two explicit confirmation switches are intentional. Before passing `-ConfirmAuthConfig`, review `supabase/config.toml` and verify the production Supabase Auth **Site URL** plus **Redirect URLs** still include the exact production reset-password origin. The script then applies pending migrations, pushes the reviewed Auth hook/password configuration, and deploys the affected Edge Functions.

## Hosted Auth settings when CLI config access is unavailable

The database hook function is installed by the launch migration, but hosted
Supabase Auth must still be told to invoke it. In the Tayar project dashboard:

1. Open **Authentication → Hooks** and configure **Before User Created** as a
   Postgres hook. Select schema `public` and function
   `hook_enforce_tayar_signup_policy`, then save it.
2. Open **Authentication → Providers → Email**. Set the minimum password length
   to `8` and require lowercase letters, uppercase letters, and digits. Do not
   change email-confirmation or provider settings as part of this release.
3. Open **Authentication → URL Configuration**. Set **Site URL** to
   `https://tayar.se` and ensure these production redirects are allowed:
   - `https://tayar.se/`
   - `https://tayar.se/?auth=recovery`
   - `https://www.tayar.se/`
   - `https://www.tayar.se/?auth=recovery`

The application does not use an `/auth/callback` route. Google sign-in returns
to the current Tayar origin, and password recovery uses the `?auth=recovery`
query parameter. Do not paste access tokens, passwords, or provider secrets into
the runbook or a support conversation.

## Verification after deployment

1. Sign in with an active administrator account.
2. Open `#admin`; the header should show **Admin Verified**.
3. Open Users and confirm names/emails/counts load.
4. Confirm the current administrator cannot suspend, demote, or delete their own account.
5. Delete a disposable non-admin with a Stripe test subscription; verify Stripe is canceled, both owned storage prefixes are empty, and the Auth user is gone.
6. Test a separate non-admin account: direct access to `#admin` must be denied.
7. Suspend a test user. That user must be blocked from the workspace and receive a server-side rejection from AI/Email/Billing Edge Functions, while still being able to open the Privacy Policy and permanently delete their own non-admin account.
8. Reinstate the test user and verify normal access returns.
9. Open Dashboard, Subscriptions, Support, AI, Tools, Content, and System. Database/RLS errors must appear as errors rather than empty data.
10. Verify Content saves as an admin draft only; it must not claim public-site publication.
11. Verify Backups does not expose fake create/download operations.

## Rollback strategy

Do not delete migration history or run a destructive linked reset in production. If rollback is required, create and review a new forward migration that restores the previous grants/policies/functions, then deploy it normally. Edge Functions can be redeployed from the previous known-good Git commit.

Before a production apply, use the Supabase dashboard/provider backup controls appropriate to the project and record the current deployed Git commit.
