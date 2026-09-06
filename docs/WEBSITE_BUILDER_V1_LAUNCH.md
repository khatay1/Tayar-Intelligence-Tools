# Tayar Website Builder V1 — Production Launch Guide

Sprint 157–168 marks the Website Builder module as **active / V1.0.0**. The codebase contains the builder, cloud save, publishing, releases/rollback, forms/CRM, analytics, multilingual pages, team workspaces, billing entitlements, security hardening, recovery, smoke tests, and the V1 Launch Center.

## Required automated checks

From the repository root run:

```powershell
npm run health:project
npm run lint
npm run build
npm audit --audit-level=moderate
```

The project health gate includes TypeScript, all Edge Function syntax checks, Website Builder verification, i18n coverage, production hardening, published runtime, and the pilot-launch regression suite. Every command above must finish without errors; compare lint warnings with the reviewed baseline.

## Billing production setup

Set Supabase Edge Function secrets; never commit them to GitHub:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_BUSINESS_PRICE_ID`
- `APP_URL`

Use the guarded deployment script from PowerShell. First run its read-only preview:

```powershell
.\scripts\admin-hardening-deploy.ps1
```

After the migration dry-run is reviewed, apply the coordinated migration, Auth configuration, and function deployment with both explicit confirmations:

```powershell
.\scripts\admin-hardening-deploy.ps1 -Apply -ConfirmProduction -ConfirmAuthConfig
```

Before `-ConfirmAuthConfig`, review `supabase/config.toml` and verify the production Supabase Auth **Site URL** and **Redirect URLs** allow the exact production reset-password URL. Do not copy the localhost URL from `.env.example` into production. The script pins the reviewed Supabase CLI version and deploys `stripe-webhook` without gateway JWT verification; the webhook still requires Stripe signature verification in its handler.

Configure the Stripe webhook endpoint to the deployed `stripe-webhook` function and verify at least one test purchase, upgrade/downgrade path, Customer Portal visit, and cancellation event before accepting live payments.

## Hosting and public configuration

Verify that disabling `signup_enabled` blocks a new email and a new Google identity while an existing Google user can still sign in.

Verify production environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are configured in the web host. The five public `VITE_LEGAL_*` identity values from `.env.example` are optional for this pilot and appear only when configured. Confirm the public website storage/publishing route works in the real browser, including `index.html`, internal pages, form submission and analytics.

## Human launch checks

Use the **Launch** button inside Website Builder and complete the manual production sign-off:

1. Stripe test purchase + webhook + Customer Portal verified.
2. Production domain, DNS and HTTPS verified.
3. Support contact, Privacy Policy and Terms of Service reviewed.
4. Account export and permanent deletion tested with a disposable free account and a Stripe test subscription.

The Launch Center should show **V1 LIVE** and the final decision should read **GO — READY FOR FIRST PAYING CUSTOMERS** before opening paid access.

## First customer smoke path

Create a fresh user account, create a Website Builder project, choose a template, save to cloud, publish, submit a form from the public site, confirm the lead appears in CRM, confirm analytics records the visit/conversion, create a preview, create a release, and verify rollback. Repeat once as a team Editor/Viewer to confirm RLS permissions.
