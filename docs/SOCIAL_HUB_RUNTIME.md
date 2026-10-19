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

Before activation, apply the reviewed migration in an isolated database, configure
the scoped webhook binding through the existing service-only RPC, register the
provider subscription and complete live channel verification. Meta GET challenge
handling stays denied until a separate scoped verification token is provisioned;
the app signing secret is never reused as that token. This batch exposes a disabled
scheduler target but does not install a cron, configure provider subscriptions or
change production environment variables or databases.

`node scripts/social-hub-runtime-regression.mjs` tests the actual Node HTTP bridge
with raw UTF-8 bytes, host/path isolation, callback routing, body/encoding limits,
no-store headers and disabled/malformed deployment. The dispatch runtime regression
tests exact scheduler authorization and the existing claim/reserve/settle path. Existing endpoint and worker
regressions cover Auth, RPC, signatures, tenant scope, Vault and dedup composition.
These are isolated tests, not evidence of a connected real social account.
