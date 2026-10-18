# Optional Social Assistant classifier integration

`server/social-assistant-engine.ts` is an unmounted, server-only composition over
Tayar's existing `/functions/v1/ai-engine`. It adds no SDK, provider credential,
provider/model choice, paid-service activation or direct provider endpoint.
The engine retains its current JWT authentication, rate limiter, billing usage
reservation and administrator-managed provider/fallback routing. The classifier
uses existing `ai-chat` routing with 128 output tokens and no HTTP retries.

The endpoint accepts only scope, conversation and message UUIDs. A trusted host
must verify the existing session and current scope membership, official-account
admin permission where applicable, inbox read permission, exact message ownership
and feature flag; it loads message, approved FAQ and settings from server storage.
It must never accept knowledge, text, tenant permissions or consent from a
browser request. Missing/disabled/denied contexts return no message data.

Local approved-answer matching runs first. External classification requires
explicit current server-held consent covering all managed routes (including
fallbacks), a reviewed/de-identified classification text, and a durable atomic
per-tenant/message budget reservation. Names and identifiers must be removed by
the host review step. Defensive guards refuse common medical/financial/sensitive
terms, emails, phone/long number patterns and credential-like values; regexes do
not prove that arbitrary text is free of sensitive data. Without reviewed text,
classification remains local. Medical/customer health data must never be supplied
to this classifier, regardless of consent.

Only the reviewed text and eligible approved FAQ IDs/questions reach the engine.
Answer bodies, tenant IDs, account IDs and conversation identifiers remain local.
The model can select one listed answer ID or abstain. Unknown IDs, additional
properties, malformed/oversized output, provider failures and budget denial retain
human handoff. Answers are returned verbatim from approved tenant knowledge. A
fresh host context recheck after model latency invalidates revoked approval,
changed text, reassignment, changed answer or disabled settings.

This handler always returns suggestions or handoff; even an exact local match
cannot automatically emit a message. It has no send/outbox/tool/payment capability.
Manual sending and any separately approved automation must pass their own current
channel policies, consent, permissions and idempotency gates.

## Host work still required

No route, database RPC or production deployment is installed by this module.
The host interface needs actual persisted consent/knowledge/context reads and a
durable tenant/message budget reservation before mounting. Existing AI billing
reserves usage per authenticated user; it does not replace the additional tenant
reservation. A failed/ambiguous call must not release its reservation into an
unbounded retry loop. An eventual cross-origin Edge deployment also needs the
existing project's CORS/deployment composition. No live AI or social account calls
were made during validation.

Run `node scripts/social-assistant-engine-regression.mjs` for isolated request,
authorization-denial, explicit consent, redaction, sensitive-content refusal,
budget, fixed destination, existing engine routing, answer allowlist, revocation,
oversized output and no-automatic-send checks.
