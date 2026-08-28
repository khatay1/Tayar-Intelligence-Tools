# Tayar Website Builder V1 — Production Launch Guide

Sprint 157–168 marks the Website Builder module as **active / V1.0.0**. The codebase contains the builder, cloud save, publishing, releases/rollback, forms/CRM, analytics, multilingual pages, team workspaces, billing entitlements, security hardening, recovery, smoke tests, and the V1 Launch Center.

## Required automated checks

From the repository root run:

```powershell
npm run smoke:website-builder
npm run launch:website-builder
npm run typecheck
npm run build
```

`smoke:website-builder` and `launch:website-builder` must have zero failures. `typecheck` and `build` should also succeed on the deployment machine with dependencies installed.

## Billing production setup

Set Supabase Edge Function secrets; never commit them to GitHub:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_BUSINESS_PRICE_ID`
- `APP_URL`

Deploy the functions:

```powershell
npx supabase@latest functions deploy create-checkout-session
npx supabase@latest functions deploy billing-portal
npx supabase@latest functions deploy stripe-webhook --no-verify-jwt
```

Configure the Stripe webhook endpoint to the deployed `stripe-webhook` function and verify at least one test purchase, upgrade/downgrade path, Customer Portal visit, and cancellation event before accepting live payments.

## Database and hosting

```powershell
npx supabase@latest db push
```

Verify production environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are configured in the web host. Confirm the public website storage/publishing route works in the real browser, including `index.html`, internal pages, form submission and analytics.

## Human launch checks

Use the **Launch** button inside Website Builder and complete the manual production sign-off:

1. Stripe test purchase + webhook + Customer Portal verified.
2. Production domain, DNS and HTTPS verified.
3. Support contact, Privacy Policy and Terms of Service reviewed.

The Launch Center should show **V1 LIVE** and the final decision should read **GO — READY FOR FIRST PAYING CUSTOMERS** before opening paid access.

## First customer smoke path

Create a fresh user account, create a Website Builder project, choose a template, save to cloud, publish, submit a form from the public site, confirm the lead appears in CRM, confirm analytics records the visit/conversion, create a preview, create a release, and verify rollback. Repeat once as a team Editor/Viewer to confirm RLS permissions.
