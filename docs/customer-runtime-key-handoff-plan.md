# Customer runtime key handoff

This plan deliberately separates feature implementation from credential activation. No credential value belongs in Git, generated source, logs, editor snapshots, browser storage, or handover documents.

## Activation order

1. Finish and test the generated database, runtime routes, UI, and provider adapters with fixtures.
2. Connect Preview provider accounts and verify exact customer ownership, project IDs, and environment modes.
3. Transfer each Preview secret directly from its locked source to a write-only Vercel sensitive environment variable. Persist destination IDs and fingerprints only.
4. Deploy Preview and run sign-in, RLS denial, form, notification, checkout, webhook replay, and refund authorization tests.
5. Repeat the transfer independently for Production. Never promote a Preview secret or reuse a Preview receipt.
6. Enable the supported production schedule only after checking the customer's Vercel plan. Verify one authorized invocation and one rejected invocation.
7. Rotate or remove every temporary source copy after destination verification. Re-run readiness and handover checks.

## Runtime variables

| Variable | Exposure | Source | Used by | Final proof |
| --- | --- | --- | --- | --- |
| `SUPABASE_URL` | Public runtime config | Verified customer Supabase project | Browser and server routes | Exact project-ref URL and Vercel environment ID |
| `SUPABASE_ANON_KEY` | Public runtime config | Verified publishable customer key | Browser Auth and RLS requests | Key fingerprint, project binding, and Vercel environment ID |
| `SUPABASE_SECRET_KEY` | Server secret | Dedicated customer Supabase secret key | Private queue and payment RPCs | Secret-key type, exact project, sensitive Vercel destination ID |
| `STRIPE_SECRET_KEY` | Server secret | Customer Stripe connection | Checkout and refund actions | Account ID, test/live mode, restricted/secret type, destination ID |
| `STRIPE_WEBHOOK_SECRET` | Server secret | Customer Stripe webhook endpoint | Raw-body webhook verification | Endpoint identity, test/live mode, destination ID |
| `CRON_SECRET` | Server secret | Random per-environment value | Scheduled email worker authorization | Sensitive destination ID and rejected invalid-token probe |
| `TAYAR_RESEND_NN_API_KEY` | Server secret | Matching saved Resend connection | Email delivery worker | Connection ID, sender verification, destination ID |

Only variables required by saved features are created. `runtime-environment-plan.json` in each generated customer repository is the authoritative no-value manifest for that build.

## Environment rules

- Preview accepts only Stripe test-mode credentials and Preview-scoped Supabase, Resend, Vercel, and GitHub bindings.
- Production accepts only live Stripe credentials and independently verified Production bindings.
- All server secrets use Vercel `sensitive` variables with no public framework prefix.
- A deployment is not ready until every required destination ID still exists and matches the exact environment, Git branch, project, and handoff operation.
- Removing or rotating a source credential invalidates readiness until a new destination receipt is verified.

## Schedule gate

The email worker route is `GET /api/application-email-worker` and accepts only `Authorization: Bearer <CRON_SECRET>`. Vercel Cron sends this header automatically when `CRON_SECRET` is configured. The final setup chooses a schedule supported by the customer's current Vercel plan; the application must not claim near-real-time delivery when only a daily schedule is available.

## Live test boundary

The final live pass requires the customer's approval before sending an email, creating a charge, or issuing a refund. Webhook signature, replay, conflict, authorization, and failure-path tests run with provider test modes first. Production probes use non-destructive provider endpoints unless the customer explicitly approves a real transaction.
