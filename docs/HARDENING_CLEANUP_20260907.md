# Hardening & Cleanup Checkpoint — 2026-09-07

This document records the production hardening pass performed on the `hardening-cleanup-20260907` branch and the corresponding Supabase production project.

## Completed

### Account and privileged Edge Function guards

- `requireUser()` now rejects authenticated sessions whose profile no longer exists.
- Suspended accounts remain blocked from normal protected operations.
- `ai-engine`, `create-checkout-session`, and `billing-portal` were redeployed with the hardened account guard.
- `delete-account` intentionally uses authenticated-user semantics so suspended users retain the right to delete their own account; cross-user deletion has independent administrator checks.

### AI and paid-provider controls

- `ai-engine` remains the supported Gemini/text/image AI entrypoint.
- Legacy `gemini-flash` is explicitly retired with HTTP 410 and JWT protection.
- `background-remover` requires JWT authentication, account validation, origin validation, per-user rate limiting, tool-plan/quota validation, provider URL validation, and usage logging.
- Email delivery now has per-user rate limiting, including a stricter contact-form bucket.

### Billing and Stripe

- Checkout and billing portal require a valid non-suspended Tayar account.
- Production Stripe webhook remains public by design and authenticates using Stripe signature verification rather than Supabase JWT.
- `stripe-webhook-test` is retired and JWT-protected.
- Public plan catalog no longer performs a live Stripe API request for every anonymous catalog read. It consumes the public price snapshot maintained by Admin billing controls.

### Admin and database permissions

- Browser grants on server-only AI/rate-limit/Stripe tables are absent.
- Signup-policy helper RPCs are no longer callable by `anon` or normal authenticated users.
- Effective-plan helper RPCs that accept arbitrary user IDs are service-role only.
- Admin table grants were reduced to the operations the application actually needs.
- Exposed SECURITY DEFINER functions were checked for fixed `search_path`; none of the exposed functions are missing it.
- `anon` and `authenticated` cannot create objects in the `public` schema.
- Intended Admin and Team Workspace SECURITY DEFINER RPCs retain internal authorization checks.

### Website public ingestion

- Legacy lead submission now has validation, public rate limiting, and storage caps.
- Current form, lead, event, and page-view ingestion paths use the shared public limiter.
- Public rate limiting fingerprints project, request network/client information, and the provided client key rather than trusting a client-controlled session ID alone.

### RLS and indexes

- Duplicate indexes were removed where an equivalent retained index exists.
- Missing foreign-key indexes were added for administrative and audit relationships.
- Multiple permissive SELECT policies were consolidated on `ai_usage`, `projects`, and `subscriptions` without changing the intended own/team/admin access model.
- Template source/asset policies were separated into explicit anonymous read, authenticated read, and administrator write policies.
- The corresponding Supabase performance warning for multiple permissive policies is cleared.
- Remaining unused-index notices are informational and must not be removed blindly without real workload evidence.

### Template Library / 24Billions cleanup

- Cloudflare R2 is the binary delivery architecture.
- Supabase Storage `template-library` is expected to remain empty after cutover.
- Legacy browser importer and audit-console scripts were removed.
- Legacy Admin template audit UI was removed.
- The old discovery/sync/audit/repair/delete-invalid Edge Functions are retired with HTTP 410 and JWT protection.
- JWT settings for retired endpoints are pinned in `supabase/config.toml` to prevent accidental reopening during a future CLI deploy.

### Extension cleanup

- `citext` was moved from `public` to the `extensions` schema.
- The dependent `account_blocks.email` column continues to use the relocated type.

## Production verification

At the end of this pass:

- `template-library` Supabase Storage: 0 objects / 0 bytes.
- Only `public-plan-catalog` and production `stripe-webhook` intentionally run with `verify_jwt = false`.
- AI, billing, admin, account, email, background-removal, retired template, and test endpoints require JWT as appropriate.
- Browser grants on server-only AI/Stripe/rate-limit tables: 0.
- Exposed SECURITY DEFINER functions without a fixed `search_path`: 0.
- Public/authenticated direct access to signup-policy and arbitrary-user effective-plan helper RPCs: blocked.

## Intentionally retained advisor notices

Some SECURITY DEFINER warnings remain because the functions are deliberate application RPCs. They were audited for the relevant authorization/rate-limit checks and fixed `search_path`. Server-only tables with RLS enabled but no policies are also intentional because the browser roles have no table grants.

## One manual Auth setting remains

Supabase Auth **Leaked Password Protection** is still disabled. The current connected management tool does not expose an Auth configuration write operation, so this cannot be safely changed from the automated hardening session. Enable Leaked Password Protection in the Supabase Dashboard Auth password/security settings before final production sign-off.

## Merge/deploy status

This checkpoint is intentionally kept off `main` until explicitly approved. No Vercel deployment is required merely to preserve this branch. Supabase database migrations and selected Edge Function hardening changes described above have already been applied to production and verified.
