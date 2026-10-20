# OpenCode offline sandbox isolation proof (Issue #310)

Source-only, opt-in security evidence. This step does **not** install or
launch OpenCode/Ollama and does not expose a tenant/customer endpoint.

Run the cheap standalone contract on Node 22:
```sh
node scripts/opencode-sandbox-isolation-smoke.mjs
```

In a **disposable Docker-enabled CI** environment only, use:
```sh
docker pull node:22-alpine
IMAGE_ID="$(docker image inspect node:22-alpine --format '{{.Id}}')"
node scripts/opencode-sandbox-isolation-smoke.mjs --docker-image "$IMAGE_ID"
```

The floating Docker tag is downloaded on the CI **host**, then the
container is run strictly by its local immutable image content ID.
This is **not** provenance/signature verification and the Node fixture
image is **not** the eventual reviewed OpenCode+Ollama image.

The test creates a disposable text fixture. Its Docker invocation enforces
`--network=none`, read-only root and fixture mount, nonroot UID, dropped
capabilities, no-new-privileges, restricted memory/processes/CPU, and an
ephemeral `/tmp`. No secrets or customer volumes are injected. The
in-container proof exercises outbound TCP denial, denied writes to the
root/workspace, lack of a Docker socket and expected UID. The parent also
verifies the fixture stayed unchanged and removes the container on error.
This is a *real OS confinement smoke* when run with Docker, not a proof
that an OpenCode process or local LLM works.

Next: inspect and digest-pin the actual OpenCode v1.19.3 image and local
Ollama model, start both in the **same** no-egress namespace, prove a
live read-only V2 session, then build trusted tenant orchestration. Keep
the bridge disabled until this is done. Model API fees can be zero, but
CPU/GPU/storage usage may not be free.
