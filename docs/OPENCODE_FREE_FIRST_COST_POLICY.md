# Tayar OpenCode: free-first, optional premium at scale

**Current default: FREE-ONLY. Commercial AI provider costs are not activated.**

Tayar may serve many customers with local OpenCode and Ollama without paying
commercial model API fees. This is **not** a promise of zero CPU/GPU, electricity,
storage, bandwidth, maintenance, or hosting costs.

## Phased operation (not triggered automatically by customer count)

1. **Start, free-first:** pilot and customer requests use local Ollama under
   trusted isolation. Paid/cloud provider routing and automatic paid fallback
   remain disabled. Deployments and billing arrangements are a separate choice.
2. **Growth:** optimize caching, batching, smaller local models, resource caps
   and tenant quotas first. Track actual operating costs; customer count alone
   never upgrades a provider or launches a paid workload.
3. **Optional premium:** when economics and workload justify it, an authorized
   operator can provision an explicitly priced paid model option. The affected
   tenant must opt in explicitly. Publish per-request estimates and maximum
   tenant monthly budget. Never backfill a charge or silently retry on paid AI.
4. **Enterprise:** individually negotiated capacity, quotas, model, security
   and provider contracts, opt-in per tenant, no shared hidden billed default.

## What is implemented now

`server/opencode-spend-gate.mjs` exports:
- `FREE_ONLY_OPENCODE_POLICY`, with disabled paid routing and zero budget.
- `chooseFreeLocalOpenCode`, selecting only local Ollama with zero *model API*
  charge and rejecting paid/automatic provider fallback.
- `reserveOptionalOpenCodeSpend`, an **internal source-only future gate**.
  It denies all paid requests unless it receives a trusted operator-enabled
  premium policy, a tenant's explicit time-bounded consent, an exact approved
  provider+model, a strict per-request and monthly budget, and a **server-side
  atomic reservation** receipt. No ledger or paid provider is connected;
  successful mocked tests do not spend money.

Never pass approvals, budgets, pricing quotes or ledger implementations from
browser payloads. The ledger must verify the authenticated tenant, actual
outstanding spend, idempotency and budget transactionally. The existing AI
quota reservation infrastructure may be reused after scope review. Merely
checking flags is not authorization. The future provider dispatch must require
an independently validated reservation and settlement/refund handling.

No OpenCode model, provider API, subscription, billed worker, new secret,
database migration or user-visible premium package is activated by this PR.

## Focused offline test

`node scripts/opencode-spend-gate-regression.mjs`

The test proves zero-fee defaults, fail-closed denied routes, opt-in and
budget conditions, mandatory atomic ledger, and reservation verification.
It uses a mock ledger, not financial billing.

## Future activation gates

- Verify platform economics and model/provider costs with up-to-date prices.
- Require owner-approved commercial scope and technical budget cap.
- Connect authenticated consent, atomic transaction ledger and billing
  reconciliation under separate audited PR, with negative and concurrency
  tests and human review.
- Opt in tenant-by-tenant; leave the free local route available.
