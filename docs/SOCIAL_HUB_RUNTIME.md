# Social Hub server routes

The Vercel Node routes now compose the existing Connect endpoint and RPC-backed
webhook worker. They preserve raw request bytes (`bodyParser: false`), check the
configured host and path, reject encoded bodies and return no-store responses.
They are disabled until `SOCIAL_HUB_ENABLED=true` and the database scope is enabled.

- `/api/social-connect?action=…` authenticates the existing Tayar bearer token,
  checks current scope management permission and uses durable Connect rate limits.
- `/api/social-connect-callback` returns the code/state only to the same-origin
  popup opener; the authenticated POST callback consumes the one-use state.
- `/api/social-webhook?id=<opaque-route-id>` resolves a SHA-256 route binding,
  retrieves the scoped Vault signing secret, verifies the original request bytes
  and commits messages with durable dedup before acknowledging.
- `/api/social-assistant` uses the existing signed-in session and persisted approved
  knowledge to suggest a reply. It additionally requires `SOCIAL_ASSISTANT_ENABLED`
  and configured public Supabase key; see `SOCIAL_ASSISTANT_ENGINE.md`.
- `/api/social-dispatch` is a GET-only scheduler target. It accepts only an exact
  Bearer scheduler secret, discovers at most three due job IDs server-side and
  sends them through the existing claim, consent, quota, cost and settlement fence.
  With `SOCIAL_AUTOMATION_ENABLED=true`, it first consumes at most three persisted
  `message.received` events. The existing local rule planner and approved-answer
  matcher select actions; one fenced SQL transaction rechecks current rules,
  permissions and scope before writing notes, human handoffs or the existing outbox.

Server configuration: `SOCIAL_HUB_ORIGIN` (exact HTTPS app origin), `SUPABASE_URL`
and `SUPABASE_SECRET_KEY` or existing `SUPABASE_SERVICE_ROLE_KEY`. Meta additionally
requires `SOCIAL_META_APP_ID`, `SOCIAL_META_APP_SECRET`, an explicitly reviewed
`SOCIAL_META_GRAPH_VERSION`, `SOCIAL_META_CALLBACK_URL` exactly equal to
`<SOCIAL_HUB_ORIGIN>/api/social-connect-callback`, and the approved WhatsApp config
ID where applicable. Telegram does not require Meta configuration. No secret uses
a `VITE_` prefix. Dispatch additionally requires `SOCIAL_DISPATCH_ENABLED=true`
and a distinct `SOCIAL_DISPATCH_CRON_SECRET` of at least 32 non-whitespace
characters. No cron is installed by this change; activation remains an explicit
deployment step. Rebuild the runtime with `node scripts/build-social-hub-runtime.mjs`.

Managers can configure up to 20 disabled-by-default rules and enable/stop scope
automation from Social Hub. Only new events after activation and rule configuration
can act. Reply rules require an exact case-insensitive, trimmed approved question,
an unchanged approved answer and no sensitive content. Human handoff takes priority.
The local rule planner never calls a model or a generic external webhook. Knowledge,
scope, rule and manager revocation are rechecked at dispatch reservation. Global
automation disable also blocks already queued automatic provider calls.

Supported automation actions are follow-up/review notes, `human_required` status and
approved reply queueing for incoming messages. Notes are visible in the inbox and
do not send push notifications. Order/booking and outside-hours triggers
and live channel verification remain separate unfinished work.

Managers may also configure disabled-by-default rules for `conversation.assigned`
and `human.requested`. Database triggers capture only real value changes while
scope automation and a matching rule are enabled. These events carry identifiers
without message text and can create review notes or request human handoff, never
queue a provider reply. The existing worker lease, replay fence, scope/rule/manager
reauthorization and immediate stop apply. An unchanged assignment creates no event.

Project-backed customer scopes can link a conversation to an existing lead in the
project's Website Builder CRM. Only scope managers receive the bounded CRM candidate
list or may change the link; editors can continue inbox work without receiving CRM
contact details. A lead from another project is rejected in the database. The link
does not create a new lead or mutate CRM fields.

The inbox can create a disabled scope from the signed-in owner's most recent 100
active Website Builder projects. It preserves the selected project's workspace;
the existing checked creation RPC remains authoritative and rejects an unrelated
project or a workspace editor. No customer backend is provisioned by this action.

CRM reads and links also recheck the project's current owner/workspace, deletion
state and existing project-manager role. A transferred/deleted project's candidate
list and stored CRM references are redacted from the old scope, while unrelated
inbox operations retain their existing scope permissions. Internal pre-guard RPC
implementations are revoked from client and service roles.

Follow-ups are private Social Hub work items in the same scope. Editors can create
and complete them, and may only assign them to eligible members of that scope.
Entering `human_required` creates one open handoff follow-up atomically; repeated
handoffs do not duplicate open work. These items are distinct from Tayar product
support tickets and do not notify an external ticketing system.

Before activation, apply the reviewed migration in an isolated database, configure
the scoped webhook binding through the existing service-only RPC, and provision a
distinct Meta GET verification token with the service-only
`configure_social_hub_webhook_challenge` RPC. Register the provider subscription
and complete live channel verification. Challenge handling stays denied when this
token is absent; the app signing secret is never reused as that token. This exposes a disabled
scheduler target but does not install a cron, configure provider subscriptions or
change production environment variables or databases.

`node scripts/social-hub-runtime-regression.mjs` tests the actual Node HTTP bridge
with raw UTF-8 bytes, host/path isolation, callback routing, body/encoding limits,
no-store headers and disabled/malformed deployment. The dispatch runtime regression
tests exact scheduler authorization and the existing claim/reserve/settle path. Existing endpoint and worker
regressions cover Auth, RPC, signatures, tenant scope, Vault and dedup composition.
These are isolated tests, not evidence of a connected real social account.

The selected conversation loads its own 50-message history pages instead of relying
on the global 500-message inbox snapshot. The server resolves the cursor inside the
authorized conversation and orders by occurrence time plus message UUID, preserving
timestamp ties without offset pagination. Visible conversations refresh their latest
page every 15 seconds; larger bursts reset pagination to avoid hiding a gap. Loaded
history stays in component memory and is discarded on user/scope/conversation change.
