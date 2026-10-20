# OpenCode local-only pilot (source-only, disabled)

The Tayar server-side adapter in `server/opencode-local-agent.ts` can talk to an **already running** OpenCode headless HTTP server. This PR deliberately does **not** install OpenCode, download a model, launch a server, configure a paid provider, create a public endpoint, modify customer apps, or trigger production deployments.

## What is implemented

- `createLocalOpenCodeAgent({ enabled, endpoint, serverPassword, workspaceDirectory, modelId, isolatedWorkspaceConfirmed, fetcher? })` exports `probe()` and `run({ task, approved })`.
- Disabled unless `enabled: true`, `isolatedWorkspaceConfirmed: true`, and a separately issued server-approved task are supplied by trusted code.
- **Only** `http://127.0.0.1:<port>/` is permitted for OpenCode, with required HTTP Basic Auth. The workspace header is restricted to `/workspace/<sandbox-id>` and must be allocated by a trusted isolated worker.
- Before starting a task it checks `/global/health` and `/config`. Only a configured `ollama` provider, an exact configured model ID, and an Ollama base URL on `http://127.0.0.1:<port>/v1` pass.
- For one task it creates an OpenCode session, sends a `build` prompt, reads bounded session diffs, and deletes the session. On prompt failure it attempts abort and delete. Tool flags disable shell, subagents and web-fetch/search at prompt level; this is defense in depth, not a secure sandbox.
- No retry loop, implicit fallback, SDK dependency, API credential forwarding, or background job is added. Model and workspace output remain isolated from other Tayar users.

## Local setup for a disposable pilot (not production)

1. Have the **sandbox worker** allocate a dedicated ephemeral VM with an empty `/workspace/<sandbox-id>` folder, no Tayar or customer credentials, no shared home folder, and **network egress denied** except local Ollama and OpenCode processes. Never run untrusted agent code in the Tayar API process or Vercel production function.
2. Install a reviewed, pinned OpenCode release and Ollama **inside** the sandbox image. Set OpenCode config (`opencode.json`) to a locally installed Ollama model, e.g. provider `ollama` with `options.baseURL: "http://127.0.0.1:11434/v1"` and `models: {"your-local-model": {...}}`.
3. Start `opencode serve --hostname 127.0.0.1 --port 4096` with a **random** `OPENCODE_SERVER_PASSWORD` (at least 16 printable ASCII characters). Supply the secret to the trusted bridge only, never to a VITE_* value, chat, Git history, or generated site.
4. The sandbox controller may construct the adapter with `enabled: true`, `isolatedWorkspaceConfirmed: true`, `endpoint: "http://127.0.0.1:4096/"`, `workspaceDirectory: "/workspace/<sandbox-id>"`, its secret password and exact installed Ollama `modelId`. Only its authenticated, authorized, manually approved operation may invoke `run()`.
5. Review file differences and subject them to Tayar's existing tests, release gate and approval flow; do not automatically publish or merge. Discard the VM on completion.

The adapter is a **foundation**, not an activated Tayar feature: no isolated worker provisioning, UI, tenant authorization endpoint, or live OpenCode/Ollama E2E test is included yet. `isolatedWorkspaceConfirmed` and `approved` are **trusted caller claims**, not security controls on their own. The caller must prove both server-side. The OpenCode process itself has filesystem/shell authority within its host, so real sandboxing and OS/network limits are essential. Even a loopback Ollama endpoint could theoretically proxy paid models; only a verified offline runtime and network policy can substantiate a zero-paid-API claim. Compute/storage resources may still cost money.

## Test

`node --experimental-strip-types --no-warnings scripts/opencode-local-agent-regression.mjs`

The regression uses an injected in-memory fetch mock and never makes a network call. It checks disabled behavior, credential/localhost/workspace guards, explicit approval, the Ollama-only provider gate, message structure and cleanup under failures/oversized replies. It is wired into Release Gate; it does **not** establish production readiness.

Upstream docs: https://opencode.ai/docs/server/ , https://opencode.ai/docs/providers/ , https://opencode.ai/docs/permissions/ . OpenCode is MIT licensed; when copying substantial upstream material, retain the upstream copyright/license notices. This integration calls the public API and copies no OpenCode source.
