# OpenCode V2 local-only, read-only protocol pilot

**Source-only. OFF by default. No hosted worker, model installation, or paid API.**

This follow-up corrects an upstream protocol mismatch discovered after #308.
The older `server/opencode-local-planner.mjs` uses the legacy
`/session/:id/message` interface. The inspected OpenCode **v1.19.3**
release instead exposes its new V2 HTTP protocol under `/api/`, with
different message payloads and asynchronous admission/wait. Do not point
the old adapter at this release.

The new `server/opencode-v2-local-planner.mjs` exposes
`planWithOpenCodeV2({config,prompt,fetcher})`. Its **version pin** is
`runtimeVersion: 'v1.19.3'`. This is a trusted operator declaration;
it is NOT a remote binary attestation. The sandbox builder must pin the
OpenCode artifact by verified digest and ensure the runtime version matches.

## V2 request contract (inspected upstream tag v1.19.3)
- GET `/api/health` (requires `healthy: true`).
- GET `/api/agent` (must expose a dedicated `tayar-readonly` agent
  with exactly four ordered permission rules: deny-all, then allow only
  `read`, `glob`, `grep`, for any resource).
- POST `/api/session` with `{agent,model:{providerID:'ollama',id:modelID}}`.
- POST `/api/session/:sessionID/prompt` with `{prompt:{text}}`.
- POST `/api/session/:sessionID/wait` for HTTP 204.
- GET `/api/session/:sessionID/message?limit=19&order=desc`
  and verify completed assistant, provider, model, agent, tool calls and
  bounded plain text.
- POST `/api/session/:sessionID/interrupt` on failure (best effort).
  V2 at this pinned tag has no HTTP session deletion endpoint; the sandbox
  owner MUST destroy the entire ephemeral workspace/process after the run.

## External safety prerequisites
1. No web/UI route added. Only authenticated trusted server components can
   invoke this module. Browser inputs may never choose the OpenCode origin,
   model, version, agent, or sandbox flags.
2. The host supervisor MUST provision a fresh workspace and model server
   per isolation domain, with read-only mounted project source, no customer
   or platform credentials, no Docker/socket/host mounts, and egress
   blocked by OS/network policy. The booleans are declarations, not proof.
3. OpenCode must use only a locally installed offline Ollama model.
   Force Ollama and OpenCode egress blocked. A provider name alone does
   NOT guarantee no fees when custom cloud gateways are configured.
4. Create a dedicated `tayar-readonly` agent inside that sandbox with
   the **effective** four ordered rules checked by this adapter:
   `[{action:'*',resource:'*',effect:'deny'},`
   `{action:'read',resource:'*',effect:'allow'},`
   `{action:'glob',resource:'*',effect:'allow'},`
   `{action:'grep',resource:'*',effect:'allow'}]`.
   Do not add globally overriding permission grants or tool plugins.
5. The integration does not auto-apply model output, copy code, run builds,
   launch OpenCode, install packages, or modify any production system.
   Reuse Tayar's existing Safe Apply, tenant authorization and Release Gate
   only after a separate sandboxed patch proposal and real E2E proof.

## Offline verification

`node scripts/opencode-v2-local-planner-regression.mjs`

This test has a mocked, no-network OpenCode server and is included in the
existing targeted OpenCode workflow and Coding Assistance Release Gate smoke.
It demonstrates request-shape and fail-closed guards only. No live OpenCode
or local model session has yet been executed.

Upstream reviewed contract:
https://github.com/anomalyco/opencode/blob/v1.19.3/packages/protocol/src/groups/session.ts
and `packages/schema/src/session-message.ts`, `permission.ts`.
