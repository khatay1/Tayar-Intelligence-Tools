# Application completion checkpoint — 2026-10-11

This checkpoint continues the customer application work after the Stripe order-ledger merge at `a6e4b95b`. PR #144 integrated that baseline. This follow-up closes the remaining agreed source features; customer credentials and live deployments remain deferred to the final activation step.

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

## Follow-up source completion

- Reports can group declared categorical fields and select day/week/month/year calendar periods in an IANA time zone, with offsets -120–0 and optional comparison against the previous complete period. Current periods can be incomplete.
- Group results are capped at 100 with explicit truncation; totals still include every readable row. Null categories and previous-only categories are retained. Exact decimal changes use integer arithmetic rather than JavaScript floating-point values.
- Authorized JSON downloads re-fetch reports with the pinned account identity; downloaded definitions and decimals contain no credentials.
- A booking can reserve a primary resource and up to four additional resource types. Multiple types use distinct referenced tables, each with its own GiST exclusion constraint. One insert/update reserves all resources atomically.
- Working hours support up to 366 unique date exceptions, including closures and special opening periods. Both the client and database guard use the same schedule semantics.
- An explicit nonblocking waiting status retains a request without reserving the interval. Confirmation is a manual authorized update and must pass every resource exclusion and working-hours check. No automatic promotion or FIFO guarantee is claimed.
- A selected-interval availability control uses an authenticated, pinned RPC. A private, exact-verified SECURITY DEFINER function checks declared create permission, resource read permission, permanent-user identity and working hours, then returns only occupied/free. It can detect conflicts hidden by booking RLS without returning booking identities or counts. Saving remains authoritative against races. Availability probes accept intervals up to 24 hours.
- Additive edits regenerate availability functions when resource-table permissions change. Changing a deployed booking rule itself still requires a reviewed migration.
- Source guidance and the editor/public controls retain these declarations in English, Arabic and Swedish.

## Completion gate

Local TypeScript, focused ESLint and application regressions passed. The new PostgreSQL and Chromium scenarios are included in the existing release gate. Merge is conditional on that gate passing; the pull request records the final run and commit.

The payment/order audit found the required domain ledger already present: immutable server-priced order quotes, private durable Checkout linkage, idempotent webhook transitions, and atomic full/partial refund reservations. Generic analytics do not replace that ledger. Double-entry accounting, invoices and tax filing were not part of the accepted source-completion scope.

## Final activation sequence

1. Follow `docs/customer-runtime-key-handoff-plan.md` to connect customer accounts and transfer Preview credentials through the existing secure handoff. No credential values belong in chat, source, snapshots or reports.
2. Deploy Preview and verify customer sign-in, denied permissions, writes, files, notification delivery, Checkout, webhook replay, authorized refunds, report isolation and multi-resource/waiting bookings.
3. Independently verify Production bindings, transfer Production secrets, deploy and activate the supported worker schedule, then rotate temporary copies and verify final readiness.

No real email, charge, refund, customer deployment or production cron was performed during source completion. Preview/Production end-to-end verification awaits the final credential connection agreed with the user.

Recurring appointments remain individually editable/cancellable. Whole-series editing, automatic waitlist promotion, full live availability calendars and arbitrary recurrence patterns are outside this delivered implementation. Social-channel integration remains the separate later plan.
