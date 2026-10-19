# Optional Social Assistant classifier integration

`server/social-assistant-engine.ts` is a server-only composition over
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

## Persisted host and route

`server/social-assistant-store.ts` now supplies the concrete host using the caller's
verified Tayar JWT and authenticated, scope-checked PostgreSQL RPCs. Each request
gets its own Supabase client. `/api/social-assistant` accepts only scope,
conversation and message UUIDs. It requires both `SOCIAL_HUB_ENABLED=true` and
`SOCIAL_ASSISTANT_ENABLED=true`, an exact HTTPS `SOCIAL_HUB_ORIGIN`, `SUPABASE_URL`
and a public `SUPABASE_PUBLISHABLE_KEY` or legacy `SUPABASE_ANON_KEY`. It does not
use a service key for assistant reads or reservations.

The additive assistant migration creates private RLS-protected settings, approved
knowledge, message review and reservation tables. Existing scope managers can
configure settings and approve business answers from the inbox panel; editors can
request suggestions, and viewers cannot. Official scopes retain platform-admin
authorization. Every context binds the exact scope, conversation and inbound
message, and suspended users are refused. Changing settings deletes existing
message reviews, so renewed external consent needs a fresh review.

External classification requires manager consent, a separately reviewed redacted
question tied to the message's current text hash, an unexpired review by a current
manager, and a positive daily tenant allowance. Settings default off with a zero
allowance. Row locks serialize the daily reservation; a message reserves at most
once, including after a failed or ambiguous AI call. Existing AI-engine user billing
remains in force as well. Knowledge and language are loaded from storage, never
accepted from the suggestion request. The UI can copy a suggestion into a draft;
the user still sends through the existing outbox policy gates.

The migration has only been tested in disposable databases. No production migration,
live AI call or real social account was used. The native PostgreSQL test covers
manager/editor/viewer/tenant isolation, approval revocation, human-assignment refusal,
daily quota and reservation replay. The browser fixture verifies suggestion-to-draft
behavior without automatic sending.

Run `node scripts/social-assistant-engine-regression.mjs` for isolated request,
authorization-denial, explicit consent, redaction, sensitive-content refusal,
budget, fixed destination, existing engine routing, answer allowlist, revocation,
oversized output and no-automatic-send checks.
