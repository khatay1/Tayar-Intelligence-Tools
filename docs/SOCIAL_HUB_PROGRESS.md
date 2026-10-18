# Social Hub implementation checkpoint

The feature is disabled by default. `VITE_SOCIAL_HUB_ENABLED=true` controls tool
visibility; an independent server scope flag controls channel activity. Enabling
a UI flag does not verify credentials, install a database migration or start a
worker. Existing Tayar Auth, administrator checks and team memberships are reused.

Implemented and isolated-tested: official channel signature/normalization and
outbound policy boundaries, scoped OAuth/Telegram verification, one-use state,
Vault custody adapters, durable private SQL/RPC inbox/outbox, tenant/role checks,
ambiguous-send review, and worker composition. The inbox UI reads actual RPC
snapshots, searches/filters conversations, queues replies, saves internal notes,
changes status and assigns to the current authorized user. It displays queue
state separately from provider delivery. All channel bindings still require
separate webhook verification before sending.

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

Still requires host composition and deployment review: mounted authenticated
Connect/assistant routes; trusted webhook target/recipient policy/rate-cost
reservation wiring; production worker scheduling; approved business knowledge
and AI classifier wiring; complete paginated history, realtime notifications,
attachment download/upload and general team-member assignment UI; CRM action
resolution; automatic reply execution and support-ticket creation. These are
implementation work, not merely missing keys. See the individual storage,
Connect and channel documents for exact boundaries.

No live provider credentials or production writes are used. Real Meta app review,
WhatsApp templates and consent, Telegram webhook setup, sandbox ownership,
channel receipt/delivery tests, hosted schema/advisor validation and separately
authorized production migration/activation remain mandatory before live use.
