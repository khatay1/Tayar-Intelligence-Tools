# Tomorrow production release

## Goal

Deploy the full prepared release in one controlled production window:
- database migrations;
- required Supabase Edge Functions;
- one merge to `main`;
- one Vercel production deployment;
- production verification.

No extra retry commits or preview deployments.

## Pre-flight

1. Confirm PR #7 Release Gate is green.
2. Confirm Vercel deployment quota is available again.
3. Confirm local checkout is clean and current:

```powershell
git fetch origin
git switch prep/tomorrow-release
git pull --ff-only origin prep/tomorrow-release
```

## Supabase: dry-run first

Run the guarded deployment script without `-Apply`:

```powershell
.\scripts\admin-hardening-deploy.ps1 -ProjectRef pnbllxdlskljcakyaylt
```

Review the pending migrations. The prepared release includes these new migrations:

- `20260829223500_admin_full_access_override.sql`
- `20260829225000_admin_access_overrides.sql`
- `20260829231500_account_block_re_registration.sql`
- `20260829233000_admin_block_list_and_support_immutability.sql`
- `20260829234500_subscription_grace_period.sql`
- `20260829235500_enforce_signup_policy.sql`

Then apply only after the dry-run is clean:

```powershell
.\scripts\admin-hardening-deploy.ps1 -ProjectRef pnbllxdlskljcakyaylt -Apply -ConfirmProduction
```

The script deploys the affected Edge Functions:
- `ai-engine`
- `billing-portal`
- `create-checkout-session`
- `stripe-webhook`
- `billing-admin-status`
- `email-service`

## Stripe verification before Vercel merge

Open Tayar Admin -> System -> Readiness or Subscriptions -> Payment Settings and verify:
- Stripe connected;
- correct Live/Test mode;
- charges enabled;
- payouts enabled;
- Pro price verified;
- Business price verified;
- webhook endpoint found;
- required webhook events configured;
- Checkout ready;
- Billing Portal ready.

Do not place Stripe secret values in the browser or repository.

## Merge and one Vercel deployment

1. Merge PR #7 into `main`.
2. Do not push additional commits while Vercel is building.
3. Wait for the single production deployment on the merge commit.
4. Confirm GitHub Release Gate on `main` is green.

Then:

```powershell
git switch main
git pull --ff-only origin main
.\scripts\verify-production.ps1
```

## Production smoke test

Verify on `https://www.tayar.se`:

### Admin / users
- Toggle `signup_enabled` off and confirm new email/password registration is rejected while existing sign-in still works.
- Confirm Google OAuth also respects signup-disabled mode.
- Confirm a blocked email returning through Google OAuth is signed out and cannot enter Workspace.
- Admin account displays `Admin Access`, not Free.
- Admin keeps Business-level internal access without fake Stripe revenue.
- Complimentary Pro/Business access can be granted and removed.
- Complimentary access does not appear as paid MRR.
- Suspend blocks access.
- Delete only allows later re-registration.
- Delete + Block prevents re-registration with the blocked email.
- Account Blocks tab lists blocks and can unblock them.

### Billing
- Pro checkout opens Stripe.
- Business checkout opens Stripe.
- Successful test payment updates the correct plan through webhook.
- Billing Portal opens for a Stripe customer.
- `past_due` is labeled with the 3-day grace period.
- `unpaid/canceled` loses paid access after policy rules apply.

### AI
- dark Model Manager is visible;
- Add model manually is visible;
- custom valid `gemini-*` model can be added;
- managed model can be selected and saved as Default;
- non-Gemini providers remain clearly marked Backend not enabled.

### UI
- native dropdown menus remain dark when opened;
- Admin Users dropdowns are dark;
- Complimentary Access dropdown is dark;
- no white popup menus remain in the tested admin/workspace flows.

### Support / audit
- submitted ticket subject/body/type cannot be edited by the owner;
- admin-only ticket fields remain protected;
- System Logs show useful metadata for admin actions.

## Important

- Do not deploy Supabase twice.
- Do not create empty commits to retry Vercel.
- Do not manually deploy Vercel unless the Git-triggered production deployment genuinely fails for a code reason.
- `main` remains the only canonical source of truth after merge.
