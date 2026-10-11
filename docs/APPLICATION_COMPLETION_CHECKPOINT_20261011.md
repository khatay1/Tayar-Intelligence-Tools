# Application completion checkpoint — 2026-10-11

This checkpoint continues the customer application work after the Stripe order-ledger merge at `a6e4b95b`. Source changes are prepared for review; customer credentials and live deployments remain deferred to the final activation step.

## Completed in the current source branch

- Durable email runtime packaging, customer secret staging, and final activation preflight.
- Atomic Stripe refund reservation, immutable server-priced order quotes, customer payment routes and published checkout/refund controls.
- Booking working hours, duration limits, time zones and database-enforced overlap protection.
- Daily/weekly recurring booking creation: 2–52 occurrences, intervals 1–12, at most 366 days, consistent local time across DST, and rejection of missing/ambiguous times.
- One bulk INSERT per booking series, deterministic occurrence receipts, lost-response recovery and pinned account identity. Any database conflict rolls back the entire series.
- Declared count/sum/min/max/average reports over all readable rows, independent of search and pagination. SQL functions use SECURITY INVOKER and authenticated-only execution. PostgreSQL numeric totals remain decimal text in the browser.
- Native recurrence/report editing, published controls in Arabic/Swedish/English, AI definition guidance, customer schema/source exports and strict report catalog verification.
- Disabling recurrence now disables its hidden inputs, so an invalid repeat count cannot prevent a normal single booking.

## Validation performed

- TypeScript check, focused ESLint, application schema/data-view/AI regressions, owned source compilation and generated bundle consistency.
- Chromium browser interaction across English, Arabic and Swedish: series controls/conflict recovery, large decimal reports, safe text rendering, stale-total clearing and account-switch cleanup.
- Real embedded PostgreSQL via PGlite: report owner isolation, exact decimals, anon/service-role denial and SECURITY DEFINER tamper refusal; booking overlap, RLS-hidden conflicts, full bulk-insert rollback and working-hours trigger/catalog checks.
- Embedded PostgreSQL serializes connections; the existing native PostgreSQL concurrency test remains the CI check for simultaneous clients. The new report test also runs against a separate native PostgreSQL database in the release gate.

## Remaining sequence

1. Verify and integrate the prepared source branch through the release gate.
2. Implement the remaining financial reporting requirements: grouping/time-period comparisons and domain-specific ledgers beyond basic aggregates. Basic reports must not be described as a complete accounting system.
3. Complete customer Preview end-to-end validation after final credential connection: sign-in, permissions, record writes, files, notifications, checkout, webhook replay and authorized refunds.
4. Follow `docs/customer-runtime-key-handoff-plan.md` for the final approved Preview and Production credential transfer, deployment and activation. No real email, charge, refund or production cron was performed during this checkpoint.

Recurring appointments remain individually editable/cancellable. Whole-series editing, live availability calendars and arbitrary recurrence patterns are not implemented. Social-channel integration remains a separate later plan.
