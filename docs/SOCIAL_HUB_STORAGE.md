# Social Hub durable storage

Status: additive migration prepared and tested against isolated PostgreSQL. Not applied to any hosted database. No live messaging, OAuth or paid service activation is implied.

`20261018113420_social_hub_storage.sql` keeps all tables in `private`, enables RLS, and denies direct browser table access. Existing `auth.users`, `profiles` administrator checks, `team_workspaces`, `team_workspace_members`, and `projects` are reused. No separate users or membership model exists.

Customer personal scopes belong only to their owner. Team scopes use current membership: viewers read; editors handle conversations and enqueue; owner/admin manage connections and create scopes. Official Tayar scopes require the existing nonsuspended administrator role and cannot attach to a customer project/workspace. Administrator status does not grant access to customer scopes. Team removal takes effect on the next operation; OAuth consumption checks manager permissions again.

Every scope starts with `enabled=false` and `automation_enabled=false`. No browser RPC enables it. Deploying the migration does not activate channels. The application feature flag and channel/provider verification are additional required gates.

## Browser RPC contracts

| RPC | Arguments | Result |
| --- | --- | --- |
| `list_social_hub_scopes` | none | scope JSON array |
| `create_social_hub_scope` | `p_kind`, optional UUID `p_workspace_id`, `p_project_id` | scope UUID |
| `get_social_hub_inbox` | UUID `p_scope_id` | `{scope,connections,conversations,messages,notes,outbox}` |
| `mutate_social_hub_conversation` | UUID `p_conversation_id`, optional `p_status`, `p_assigned_to`, `p_note`, `p_set_assignment=false` | void |
| `enqueue_social_hub_message` | UUID `p_conversation_id`, `p_text`, `p_idempotency_key` | stable outbox UUID |

Inbox snapshots bound conversations to 100, messages to 500, notes to 200 and outbox rows to 100. They omit connection secret references and worker claim tokens. This is an initial bounded snapshot contract, not complete historical pagination or real-time notification delivery. Conversation status supports `open`, `pending`, `resolved`, `archived`, `human_required`. Messages contain both `occurred_at` and `created_at`.

Client wrappers are SECURITY INVOKER and call narrowly granted private routines. Those routines use a fixed empty search path and check authoritative scope access. No anon RPC grants exist. There are no broadly accessible SECURITY DEFINER routines in `public`.

## Server-only contracts

`save_social_hub_connection(p_record jsonb,p_expected_version integer=null)` accepts the Connect camelCase record: `id`, `tenantId` (scope UUID), `ownerUserId`, `channel`, `accountId`, `ownership`, `status`, `permissionsVerified`, `tokenRef`, `scopes`, `expiresAt`, `version`. The opaque UUID `tokenRef` references existing Supabase Vault custody; a connected record must have a matching staged scope/connection credential. Plaintext credentials are not stored in social tables. Initial inserts require version 1; updates require matching old version and new version old+1. Active channel/account IDs are globally exclusive across official and customer scopes. Verification of actual provider ownership remains the Connect adapter's responsibility. Saving resets webhook verification; the trusted provider verification step must establish it separately. Revoking connections cancels queued requests and marks in-flight requests for review.

`get_social_hub_connection(p_id,p_scope_id)` returns server snake_case persistence, including `secret_ref`, `owner_user_id`, and joined `ownership`. It is not callable by browser roles.

`save_social_hub_oauth_state(p_state_hash,p_scope_id,p_user_id,p_channel,p_expires_at,p_metadata)` stores only a SHA-256 state hash, with a maximum 15 minute lifetime. `p_metadata` is server-only OAuth context, not credentials. `consume_social_hub_oauth_state(p_state_hash,p_scope_id,p_user_id)` atomically returns the snake_case row with `metadata`, once only and before expiry. Wrong tenant/user, reuse, expiry, or removed manager yields no consumed state.

`ingest_social_hub_message(p_scope_id,p_connection_id,p_event_id,p_external_conversation_id,p_external_message_id,p_sender_name,p_text,p_occurred_at,p_attachment_refs='[]')` accepts already verified and destination-bound normalized webhook data. It creates/updates a conversation and inserts one inbound message. Duplicate event/message IDs do not duplicate messages. Composite foreign keys prevent mixing scopes, connections and conversations. Attachment references are provider metadata; the migration does not fetch or trust arbitrary URLs.

`claim_social_hub_outbox(p_limit=10)` claims due requests with SKIP LOCKED, creates one-use UUID claim tokens, and rechecks scope enabled/connection verified/expiry. `settle_social_hub_outbox(p_id,p_claim_token,p_outcome,p_provider_message_id=null,p_error_code=null,p_retry_after_seconds=null)` accepts `accepted`, `rejected`, `review`. Provider acceptance does not mean delivery. Only a positively rejected `rate_limited` result can request delayed retry, bounded to 1–86400 seconds and five attempts. Expired sending leases become `review`, never automatically resend. Stale/wrong claim tokens cannot settle another worker's job. Channel policy, user consent, messaging windows, and cost approval are enforced by the channel worker before provider dispatch.

`social_hub_store_credential(p_scope_id,p_connection_id,p_access_token)` creates a secret through existing `vault.create_secret` and returns an opaque UUID. `read_social_hub_credential(p_scope_id,p_connection_id,p_secret_ref)` resolves only a matching live enabled/verified/unexpired connection. `social_hub_revoke_credential(p_scope_id,p_connection_id,p_secret_ref)` deletes only the matching custody mapping and Vault secret, disconnecting only a connection still bound to that reference. Scope deletion cleans up its Vault secrets. All three RPCs are service-only. Failed connection CAS must revoke its staged secret. Stale unbound staged credentials require periodic server cleanup before live rollout.

## Verification

Native PostgreSQL CI, dedicated disposable local database only:

```bash
TAYAR_SOCIAL_HUB_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/tayar_social_hub_test node scripts/social-hub-postgres-regression.mjs --postgres
```

Optional isolated PostgreSQL WASM verification with pinned scratch dependency (no project package change):

```bash
npm install --prefix /tmp/tayar-social-fixture --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.3.14
TAYAR_PGLITE_MODULE=/tmp/tayar-social-fixture/node_modules/@electric-sql/pglite/dist/index.js node scripts/social-hub-postgres-regression.mjs
```

The regression verifies real SQL execution, anonymous denial, private-table denial, official/customer isolation, owner/editor/viewer permissions, scope foreign keys, cross-scope active-account exclusivity, redacted secrets, webhook deduplication, valid assignment, idempotency conflict handling, claim ownership, bounded rate-limit retry, ambiguous expired lease review, one-use user-bound OAuth, connection CAS, RLS and RPC grants. Vault calls use a clearly marked SQL fixture so the test verifies custody authorization and deletion, not Vault encryption. It does not claim live provider verification, hosted Supabase advisors, production migrations, notifications or channel delivery.

Before production activation: review migration against actual schema, run hosted advisors in an authorized nonproduction project, complete channel/consent policies and vault binding, verify real provider OAuth/webhooks/delivery in a sandbox, then separately authorize hosted migration and feature activation. No real customer credentials are needed for the isolated checks above.
