# Tayar Coding Assistance — UI Registry

## Goal

Build a Tayar-native component workflow with browse, preview, code, dependency information, license safety, and AI adaptation.

## Deployment rule

Development happens on branches prefixed with `internal-`. `vercel.json` disables automatic Vercel deployments for `internal-*` branches. Remove or change this workflow only when the feature is ready for release.

## Source policy

Only import component code when the original source license permits redistribution.

Currently verified:

- `shadcn-ui/ui` — MIT — allowed with upstream notice preserved for substantial copied portions.
- `magicuidesign/magicui` — MIT — allowed with upstream notice preserved for substantial copied portions.
- `kokonut-labs/kokonutui` — MIT — allowed with upstream notice preserved for substantial copied portions.
- `nolly-studio/cult-ui` — MIT — allowed with upstream notice preserved.
- `TheOrcDev/8bitcn-ui` — MIT — allowed with upstream notice preserved.
- `karthikmudunuri/eldoraui` — MIT — allowed with upstream notice preserved.
- `ui-layouts/uilayouts` — MIT — allowed with upstream notice preserved.
- `arihantcodes/spectrum-ui` — Apache-2.0 — allowed with upstream notice preserved.
- `shadcnspace/shadcnspace` — MIT — allowed with upstream notice preserved.
- `DavidHDev/react-bits` — current Commons Clause restriction — blocked from registry redistribution.
- `animmasterlib.dev` — paid/private distribution. No public redistribution license found during review; blocked from Tayar bundling. Planned path: user-provided private licensed pack import only.

The registry source catalog is the enforcement point. A component cannot be registered from a blocked source.

## Current capability

- Coding Assistance is promoted from Coming Soon to Beta.
- Component search and category filters.
- Visual previews.
- Preview / Code / Info tabs.
- Dependency display.
- Copy code.
- Structured “Use with AI” adaptation prompt.
- Source and license visibility.
- Source-level redistribution guard.
- Runtime loading of approved upstream registry manifests from shadcn/ui, KokonutUI, Magic UI, Cult UI, 8bitcn, Eldora UI, UI Layouts, Spectrum UI and Shadcn Space.
- Every approved public source is pinned to a reviewed immutable Git commit; the registry never follows a moving `main` branch at runtime.
- Current verified manifests expose roughly 1,490 redistributable UI components/blocks before future sources are added.
- Large result sets render in incremental batches instead of mounting the full registry list at once.
- On-demand component source fetching; third-party code is not executed inside the registry browser.
- Full upstream MIT license text is prepended when remote source is loaded/copied.
- Network/path/payload size guards for upstream source loading.
- Source filter, component/block filter, category filter, search, and browser-local favorites.
- AI payload now carries both NPM and registry dependency requirements with the licensed source.
- Direct authenticated AI adaptation through Tayar's existing AI service, with bounded source context and no automatic code execution/application.
- AI source is explicitly treated as untrusted data to reduce prompt-injection risk from third-party code comments.
- When an active Tayar project is available, Coding Assistance reads a bounded, read-only project snapshot, detects framework/package metadata, and reports missing component dependencies.
- The bounded active-project snapshot is included in AI adaptation context, with project source explicitly treated as untrusted data.
- Structured AI patch planning returns validated create/replace operations and a before/after change preview.
- Patch planning blocks deletes, environment/credential files, lockfiles, package.json writes, unsafe paths, duplicate operations, and oversized payloads.
- Safe Apply is enabled only for recognized `content.files` project stores and requires explicit in-UI confirmation after review.
- Apply re-reads the project and checks both the file-store fingerprint and row `updated_at` to reject stale/racing writes.
- Each successful apply stores a bounded per-file rollback checkpoint; rollback is allowed only while the file-store fingerprint still matches the applied state.
- Safe Apply blocks unresolved npm dependencies, unresolved registry dependencies, and blind replacement of files absent from the bounded AI snapshot.

## Next implementation layers

1. Expand the approved upstream catalog with additional MIT/Apache registries after per-source license verification.
2. Add generated local snapshots for offline/fast browsing and change detection.
3. Add package/registry dependency install planning with conflict/version warnings.
4. Add a controlled package.json dependency editor instead of raw package.json AI writes.
5. Add AI variants, similar-component search, and full-page templates.
6. Add registry audits that prevent duplicate IDs, missing license metadata, and restricted sources.

## Verification

The internal branch is checked on GitHub with TypeScript and the dedicated Coding Assistance smoke suite. This verification does not deploy the application to Vercel.
