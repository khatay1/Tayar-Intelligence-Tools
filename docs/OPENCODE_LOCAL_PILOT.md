# OpenCode local-only integration: internal read-only pilot

Status: **source-only, OFF by default**. This is an executable HTTP adapter plus
mocked contract regressions, **not** a deployed coding agent, launched OpenCode
process, or customer-facing route.

## Reuse rather than replace

Keep Tayar's current builder, application runtime, Coding Assistance Safe Apply,
rollback, tenant policy, isolated custom-code runner and Release Gate. This pilot
only enables a trusted server-side caller to ask a locally configured OpenCode
instance to inspect an isolated workspace and return a planning answer.

The module at `server/opencode-local-planner.mjs` exports
`planWithLocalOpenCode({config,prompt,fetcher})`.
It calls OpenCode's documented `POST /session`,
`POST /session/:id/message`, `GET /session/:id/diff`, then
`DELETE /session/:id`. Tests mock these routes; no paid AI request is made.

## Strict pilot requirements

1. This module is not mounted to a browser endpoint and does not spawn an
   OpenCode process. The internal caller must authorize the tenant and resource.
2. Provision a fresh, disposable isolated development workspace **per task
   and tenant**. The OpenCode process must not inherit Tayar/cloud/customer
   credentials, mount production host directories or share workspace state.
3. Enforce **at the runtime/network layer** that OpenCode and its Ollama model
   server have no public internet egress, no cloud credentials and cannot
   access host/container control sockets. The `sandboxed` and `offline`
   flags are operator assertions, not proof of this boundary.
4. Bind OpenCode only to literal `127.0.0.1` on an explicit port. No domain,
   TLS proxy, authorization headers or external API origin is accepted by
   this pilot. A deployment requiring remote OpenCode needs a separate,
   authenticated, audited boundary.
5. Install OpenCode in the isolated environment under a **reviewed pinned
   version**, and use a locally installed Ollama model. Set OpenCode's provider
   configuration to a loopback-only Ollama URL, with agent permissions denying
   all writes, shell, network, subagents and external tools by default. OpenCode
   supports multiple providers: selecting provider ID `ollama` alone does
   **not** guarantee zero external spend if a provider proxy/cloud model is
   configured. External egress blocking is mandatory.
6. Pass `{enabled:true,sandboxed:true,offline:true,
   baseUrl:"http://127.0.0.1:4096",providerID:"ollama",
   modelID:"<locally-installed-model>"}` only from server policy.
   Never trust flags, prompt, model IDs, tenant identity, or URLs from browser
   requests. Explicit enabling is required, without adding any `VITE_*`
   secrets or commercial API credentials.
7. The adapter selects `plan` and limits tools to read/grep/glob with a
   deny-all default, checks the selected provider/model in the returned
   assistant message, demands an empty diff, caps request and response sizes,
   rejects redirects and tries to remove the session even on errors.
   Permission and diff checks are **defense in depth**, not sandbox isolation.
   Outputs are untrusted suggestions and must never be auto-applied.
8. Keep production deployment, billing, outbound API calls, file edits and
   credentials disabled. Real operation requires isolated live tests,
   capability validation and owner review before adding a controlled write
   or test-execution agent.

## Local offline contract test

```sh
node scripts/opencode-local-planner-regression.mjs
```

The standard `npm run smoke:code-assistant` also runs this regression in
Release Gate. It uses mock fetch responses, not an actual model instance.
There is no added dependency and no incurred model inference fee.

## Next gate (not completed)

Prepare a physically isolated execution host, prove egress and tenant
separation, start pinned OpenCode + Ollama in that host, run a real read-only
session on a disposable repository, then add a guarded patch proposal
artifact. Tayar's existing Safe Apply / release checks remain authoritative.
Do not expose a direct shell/write endpoint or merge the new agent into
customer production workflows before these tests.
