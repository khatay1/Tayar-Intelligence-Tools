# Admin hardening deployment runbook

Branch: `release/admin-role-hardening`

This release changes both the database authorization layer and the shared server-side authentication used by selected Supabase Edge Functions. Treat it as a coordinated deployment.

## What changes

- Applies `20260829144000_harden_admin_role_and_admin_access.sql`.
- Uses `public.is_admin()` as the trusted administrator check.
- Prevents browser clients from changing `role`, `plan`, or suspension fields directly.
- Adds protected administrator RPCs for user listing, updates, and deletion.
- Adds administrator read access required by the admin dashboard.
- Protects administrator-only support ticket fields.
- Rejects suspended accounts in the shared Edge Function authentication helper.

Affected Edge Functions:

- `ai-engine`
- `billing-portal`
- `create-checkout-session`
- `email-service`

## Safe preview

Use PowerShell from the repository root:

```powershell
.\scripts\admin-hardening-deploy.ps1 -ProjectRef <SUPABASE_PROJECT_REF>
```

The default mode links the selected Supabase project, lists migration state, and runs:

```text
supabase db push --dry-run
```

It does not apply database changes or deploy Edge Functions.

Supabase documents `db push --dry-run` as the preview step before applying remote migrations. Never use `db reset --linked` against production.

## Apply only after reviewing the dry-run

```powershell
.\scripts\admin-hardening-deploy.ps1 -ProjectRef <SUPABASE_PROJECT_REF> -Apply -ConfirmProduction
```

The explicit `-ConfirmProduction` switch is intentional. The script then applies pending migrations and deploys only the four Edge Functions that depend on the modified shared authentication helper.

## Verification after deployment

1. Sign in with an active administrator account.
2. Open `#admin`; the header should show **Admin Verified**.
3. Open Users and confirm names/emails/counts load.
4. Confirm the current administrator cannot suspend, demote, or delete their own account.
5. Test a separate non-admin account: direct access to `#admin` must be denied.
6. Suspend a test user. That user must be blocked from the workspace and receive a server-side rejection from AI/Email/Billing Edge Functions.
7. Reinstate the test user and verify normal access returns.
8. Open Dashboard, Subscriptions, Support, AI, Tools, Content, and System. Database/RLS errors must appear as errors rather than empty data.
9. Verify Content saves as an admin draft only; it must not claim public-site publication.
10. Verify Backups does not expose fake create/download operations.

## Rollback strategy

Do not delete migration history or run a destructive linked reset in production. If rollback is required, create and review a new forward migration that restores the previous grants/policies/functions, then deploy it normally. Edge Functions can be redeployed from the previous known-good Git commit.

Before a production apply, use the Supabase dashboard/provider backup controls appropriate to the project and record the current deployed Git commit.
