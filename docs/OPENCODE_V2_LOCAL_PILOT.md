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

## Local server authentication

The V2 CLI at v1.19.3 calls `Daemon.password()` when starting `serve`.
It creates/reuses a private password in its state directory and passes it
to the server authorization middleware. Loopback does not bypass Basic auth.
The trusted sandbox supervisor must supply that worker-specific password as
`config.serverPassword` (16–256 printable ASCII characters). The adapter
requires it before making any request and sends `Basic opencode:<password>`
as a base64 Authorization header on every request, including interruption.
It never places the password in URLs, prompts, returned plans, or error messages.
Redirects are rejected, and a failed authentication stops before inference.

Read the password only inside the disposable isolation domain using its
private state permissions; do not reuse a real user's persistent daemon state,
platform secrets, or provider keys. Do not expose this field through a browser,
VITE variable, public endpoint, checked-in config, or logs. The module does not
read ambient environment credentials or automatically discover a host daemon.

Reviewed upstream v1.19.3 sources: `packages/cli/src/services/daemon.ts`,
`packages/cli/src/commands/handlers/serve.ts`, `packages/server/src/auth.ts`,
and `packages/server/src/middleware/authorization.ts` in
https://github.com/anomalyco/opencode/tree/v1.19.3 .

## V2 request contract (inspected upstream tag v1.19.3)
- GET `/api/health` (requires `healthy: true`).
- GET `/api/agent?location[directory]=<trusted-workspace>` (must resolve the trusted workspace and expose a dedicated `tayar-readonly` agent
  with exactly four ordered permission rules: deny-all, then allow only
  `read`, `glob`, `grep`, for any resource).
- POST `/api/session` with `{agent,model:{providerID:'ollama',id:modelID},location:{directory:workspaceDirectory}}` and verify the returned location.
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
2. The host supervisor MUST assign a trusted `workspaceDirectory` under `/workspace/<opaque-id>` and provision a fresh workspace and model server
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

## Artifact admission before extraction

`server/opencode-offline-runtime-admission.mjs` pins the immutable upstream
release archives supported by the pilot and hashes already-downloaded local
files before extraction. The current pins are OpenCode v1.19.3 and Ollama
v0.40.6 for baseline Linux amd64/x64 or Linux arm64. Paths must remain below
the dedicated runtime/model roots, be regular non-symlink files, have no
group/world write bits, and match exact byte length and SHA-256.

The local Ollama model is separately operator-approved through a small
`tayar-local-model/v1` manifest. The manifest's expected hash comes from trusted
deployment policy; it binds the exact model ID, blob size, blob digest and
content-addressed blob path. This prevents a matching friendly model name from
silently selecting different bytes. Only a narrow runtime environment map is
accepted: fixed loopback Ollama, `/tmp` home, bounded PATH, the exact model root,
`OLLAMA_NO_CLOUD=1`, optional loopback-only `NO_PROXY`, and a validated disposable
OpenCode password. Commercial provider keys, proxy variables, extra keys and
non-loopback Ollama listeners are refused. Secret values are absent from the
returned admission receipt.

Admission does not download or start anything and returns
`inferenceExecuted:false`. Passing it proves file identity only. The supervisor
must still extract safely, enforce the Docker/host confinement contract, start
both loopback services, run the authenticated V2 request, compare the project
tree before/after, terminate all processes and destroy the workspace.

`server/opencode-offline-proof-supervisor.mjs` now owns that bounded lifecycle.
It admits the pinned artifacts before creating a sandbox, verifies a non-root,
no-network, read-only, credential-free confinement receipt, starts only the
operator adapter's fixed local runtime, calls the authenticated V2 planner and
hashes every regular project file before admission and after the runtime has
stopped. Runtime stop and sandbox destruction run on both success and failure; passwords and process
handles are excluded from the returned proof receipt. The adapter remains an
operator-only dependency bound when the supervisor is constructed: proof
requests cannot provide commands, images, paths, environment variables or a
replacement sandbox adapter.

The regression uses a lifecycle fixture and therefore still does **not** claim
real model inference. A qualifying isolated host must supply the adapter and
the already-admitted archives/model, then retain the returned
`tayar-opencode-offline-proof/v1` receipt. Only that real run may set and report
`inferenceExecuted:true`.

Release digest sources:
- https://github.com/anomalyco/opencode/releases/tag/v1.19.3
- https://github.com/ollama/ollama/releases/tag/v0.40.6

## Offline verification

`node scripts/opencode-v2-local-planner-regression.mjs`

This test has a mocked OpenCode transport and an authenticated loopback HTTP
protocol fixture using native fetch (success, 401, rejected redirect, and
authenticated failure interruption). It is included in the
existing targeted OpenCode workflow and Coding Assistance Release Gate smoke.
It demonstrates request-shape, HTTP authentication and fail-closed guards only.
The HTTP fixture is not an OpenCode process or model. No live OpenCode
or local model session has yet been executed.

Upstream reviewed contract:
https://github.com/anomalyco/opencode/blob/v1.19.3/packages/protocol/src/groups/session.ts
and `packages/schema/src/session-message.ts`, `permission.ts`.
