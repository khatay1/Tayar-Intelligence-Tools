# Social Hub implementation checkpoint

The feature is disabled by default. `VITE_SOCIAL_HUB_ENABLED=true` controls tool
visibility; an independent server scope flag controls channel activity. Enabling
a UI flag does not verify credentials, install a database migration or start a
worker. Existing Tayar Auth, administrator checks and team memberships are reused.

Implemented and isolated-tested: official channel signature/normalization (including
bounded attachment metadata without provider URL fetching) and
outbound policy boundaries, scoped OAuth/Telegram verification, one-use state,
Vault custody adapters, durable private SQL/RPC inbox/outbox, tenant/role checks,
ambiguous-send review, and worker composition. The inbox UI reads actual RPC
snapshots, searches/filters conversations, queues replies, saves internal notes,
changes status, assigns eligible team members, tracks unread counts, pages history,
links project CRM leads and manages follow-ups. It displays provider authorization,
webhook verification, credential activity, queue state and provider delivery as
separate facts. All channel bindings still require separate webhook verification
before sending. Pending, disconnected and expired connections never display an active
credential even when no expiry is stored.

The local grounded assistant uses approved same-scope/language answers verbatim,
requires human handoff for sensitive, ambiguous or unconfirmed questions, and
produces unattended candidates only when explicitly enabled. An optional model
classifier may choose approved answer IDs after host consent and budget checks;
it cannot supply facts, execute tools or authorize sending. Automation decisions
are bounded declarative rules. Approved generic integration signals reuse the
existing dispatcher and include only event type, never conversation content.

Release Gate includes the channel/Connect/worker/assistant regressions, an actual
inbox browser fixture and a dedicated disposable native PostgreSQL database test.
The optional local SQL test uses PostgreSQL WASM; its Vault fixture verifies
custody permissions, not encryption. Browser execution is delegated to CI when
Chrome is unavailable locally; fixture compilation alone is not a browser pass.

Implemented server routes remain disabled by default and still require an approved
deployment, reviewed environment configuration, production worker scheduling,
approved business knowledge and optional AI-classifier consent. In-app unread
notification uses bounded visible-tab polling; external push notification is not
implemented. Attachment download/upload/scanning and media sending are not
implemented. Project order/booking events require a trusted deployed service-role
bridge; the browser cannot assert them. These are implementation/activation limits,
not merely missing UI switches. See the individual storage, Connect and channel
documents for exact boundaries.

No live provider credentials or production writes are used. Real Meta app review,
WhatsApp templates and consent, Telegram webhook setup, sandbox ownership,
channel receipt/delivery tests, hosted schema/advisor validation and separately
authorized production migration/activation remain mandatory before live use.
