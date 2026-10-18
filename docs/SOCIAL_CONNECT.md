# Social Connect custody foundation

`server/social-connect.ts` is a server-only service boundary, not a mounted endpoint. It reuses the existing trusted-server guard and the website OAuth pattern (32 random bytes, SHA-256-only durable state, nine-minute expiry, atomic consume). It does not create another user or authentication system.

## Implemented and tested in isolation

- Meta authorization URLs and server code exchange for Facebook Pages/Messenger, Instagram professional accounts through **Facebook Login**, and WhatsApp through a configured Facebook Login for Business / Embedded Signup configuration.
- OAuth state binds the existing Tayar tenant, user, selected account, ownership kind, channel and exact callback URL. The callback requires the same authenticated user and tenant, consumes state once, and rechecks fresh existing permissions. Changing tenant, channel, callback or expiry fails closed.
- Meta token introspection checks app identity, validity, required granted scopes and token/data-access expiry. Facebook/Instagram selections must appear in the authorized user's Pages edge with MANAGE or MESSAGING tasks; Instagram must match the selected Page's professional account. WhatsApp's selected phone-number ID must be returned by the selected WABA's authorized `phone_numbers` edge.
- Telegram bot token verification uses only `https://api.telegram.org/bot<TOKEN>/getMe`, checks bot identity and binds it to the token's bot ID. Telegram does not provide a user OAuth flow for Bot API Connect.
- Credentials enter the injected tenant+connection-bound vault; browser-safe results exclude both tokens and token references. New connection metadata sets `webhookVerified: false` explicitly. Verified account access alone does not enable messaging.
- Local disconnect atomically disables metadata before deleting vault custody. Disconnected metadata may have a null secret reference after Vault cleanup; the durable adapter accepts that state and continues to report it accurately. Status reports expiry and required reauthorization. Reconnect/rotation is the renewal mechanism; no unsupported refresh-token flow is claimed.
- Provider hosts/paths are constructed by the server, redirects are rejected, requests time out, response reading is bounded, and provider-supplied pagination URLs are never followed. All exported operations replace adapter/provider exceptions with a generic error, avoiding leaked token-bearing error messages.

Run:

```sh
node scripts/social-connect-regression.mjs
npx tsc --noEmit --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --lib es2023,dom server/social-connect.ts server/social-connect-store.ts
```

The regression uses deterministic fake provider responses and fake durable/vault ports. It checks all four channel Connect flows, denied and stale authorization, tenant isolation, one-use state, expiry, app/scope/account mismatches, callback substitution, oversized responses, secret redaction, duplicate-account rejection, custody cleanup and disconnect. These are not live channel tests.

## Required host contracts before mounting

1. Resolve `SocialActor` from the existing authenticated Tayar session. Never accept tenant/user identity from an untrusted JSON body or OAuth query. `authorize` must freshly check current scope membership, a connection-management permission, the Social Hub feature flag and platform-admin permission for official accounts. Official and customer scopes must remain distinct. Repeat checks are intentional around external I/O/custody writes.
2. Use `createSocialConnectPersistence` from `server/social-connect-store.ts` with a trusted service-role client after applying the reviewed Social Hub migration. Its store implements the durable `SocialConnectStore` port. State consume must be an atomic scoped update/delete. State and connection secret references must be inaccessible for writes by browser roles. `saveConnection` is insert-only when expectedVersion is null and compare-and-swap otherwise. Enforce unique active `(channel, accountId)` globally, so the same bot/Page/number cannot attach to two customer/official scopes. An insert conflict must not replace another tenant's connection.
3. The persistence adapter implements `SocialConnectVault` through narrowly scoped service-only Supabase Vault RPCs, reusing the existing Vault custody model. References must be opaque UUIDs, scoped reads must require the same tenant and connection, and revoke must be idempotent. Never store access tokens in connection metadata, OAuth-state metadata, audit events or browser responses. If metadata insertion fails after vault creation the service deletes the new custody. Operators need orphan-custody cleanup for crash recovery and retryable cleanup after interrupted disconnect; disabling metadata occurs first.
4. Mount only authenticated, CSRF-protected JSON POST routes for begin/Telegram/disconnect and a GET callback. Require same-origin requests, expected content type, bounded bodies, no-store responses and sanitized errors. Apply endpoint authorization/rate limits and use the existing auth system; this source service is not that transport layer. Telegram tokens necessarily appear in the official Bot API request path: HTTP-client/proxy telemetry must redact that path and authorization headers. Do not log requests or vault arguments.
5. Configure an exact HTTPS application origin and same-origin `/api/` callback, a reviewed Meta app ID/secret, explicit supported Graph API version, and the WhatsApp Embedded Signup config ID. Register the exact callback with Meta. Requests are bounded to ten Pages/phone-number pages; selections beyond that bound fail closed and require a future explicit account-picker pagination flow.
6. Set up and independently verify webhook subscriptions and app signatures/Telegram webhook secret before enabling message sends. The Connect service never marks webhook verification complete. Outbound workers must independently enforce stored credential expiry and live binding status; do not rely on the status display having been read first. Credential lease use must be denied for disconnected/expired bindings.

## Deferred activation / honest limits

No production migration, paid-service activation, real customer credentials, mounted Connect route, provider app review, live authorization or webhook subscription occurred in this batch. `server/social-connect-store.ts` provides the service-role RPC store and Supabase Vault adapter; the corresponding reviewed migration must be applied in an isolated environment before activation. It must be instantiated only on the trusted server. UI can show “setup required” until those dependencies exist; it must not advertise a live connection.

Meta business/app review, required access levels, business verification and account eligibility are external prerequisites. WhatsApp Embedded Signup still requires a configured approved app, eligible WABA/phone number and number registration as appropriate. Reading the WABA/phone edge verifies authorized access; this implementation does not register a number or claim production WhatsApp readiness. The account selection is explicit before beginning authorization and is checked against provider-returned assets after authorization; an interactive account picker is a separate host UI concern.

Instagram here uses Facebook Login with Page access tokens and the Facebook Graph host. It is not the separate Instagram Login flow that uses `instagram_business_manage_messages` and `graph.instagram.com`. Do not mix the two token types or permission families.

Disconnect removes local access and custody, not the user's global Meta app grant or Telegram bot itself. Users can revoke those separately in the platform's official settings. Reconnect currently creates a new connection after disconnect rather than rotating an active record in place. Network verification performed during Connect is not continuous liveness monitoring.

Provider references reviewed 2026-10-18:

- [Meta Embedded Signup official Postman workspace](https://www.postman.com/meta/whatsapp-business-platform/documentation/du6gzjv/embedded-signup)
- [Meta WhatsApp Cloud API official Postman workspace](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api)
- [Meta Messenger/Instagram conversations official Postman workspace](https://www.postman.com/meta/messenger-platform-api/folder/22794852-255610cd-47f5-4f4d-b3fa-71aec360be9a)
- [Meta Page management](https://developers.facebook.com/documentation/pages-api/manage-pages)
- [Telegram Bot API / getMe](https://core.telegram.org/bots/api#getme)
