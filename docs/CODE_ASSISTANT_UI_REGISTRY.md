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
- `ibelick/motion-primitives` — MIT — allowed with upstream notice preserved; 33 registry items at the reviewed revision.
- `codse/animata` — MIT — allowed with upstream notice preserved; 154 published registry components are generated with Animata's own registry builder from pinned commit `de9aabb0`.
- `imskyleen/animate-ui` — MIT + Commons Clause — blocked from Tayar public registry redistribution.
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
- Runtime loading of approved upstream registry manifests from shadcn/ui, KokonutUI, Magic UI, Cult UI, 8bitcn, Eldora UI, UI Layouts, Spectrum UI, Shadcn Space and Motion Primitives.
- Every approved public source is pinned to a reviewed immutable Git commit; the registry never follows a moving `main` branch at runtime.
- Current verified manifests expose roughly 1,674 redistributable UI components/blocks including the pinned Animata snapshot before future sources are added.
- Large result sets render in incremental batches instead of mounting the full registry list at once.
- Registry dependencies are resolved recursively from the approved loaded catalog with bounded depth/item limits, preferring the component's own source and then shadcn-compatible primitives.
- Registry-provided CSS and CSS variables are preserved as metadata and included in bounded AI adaptation/patch context so animated components do not silently lose required styles.
- NPM requirements such as `react-day-picker@latest` and `recharts@2.15.4` are normalized to package names for compatibility checks while preserving their original install requirement.
- The selected project's lockfile identifies npm/pnpm/yarn/bun, and Coding Assistance can generate the correct install command for missing dependencies without editing package.json or executing commands automatically.
- Resolved dependency source is bundled into AI/Patch Plan context; only genuinely unresolved registry references remain Safe Apply blockers.
- Search results are relevance-ranked for exact/prefix/name/tag/description matches.
- AI constraints can be toggled before generation: reuse project tokens, accessibility, reduced motion, no animation library, and server-component compatibility.
- “Generate 3 options” returns validated, side-by-side adaptation directions before code or a patch is generated; choosing one feeds its precise instruction into the existing adaptation/patch workflow.
- Enabling “No animation lib” also filters catalog items that explicitly require motion, framer-motion or GSAP.
- Each selected item surfaces up to six similar components based on category, kind, source and shared tags.
- The immutable upstream catalog is cached in-memory per app session to avoid repeatedly downloading nine pinned manifests when the tool remounts.
- On-demand component source fetching; third-party code is not executed inside the registry browser.
- Full upstream MIT license text is prepended when remote source is loaded/copied.
- Network/path/payload size guards for upstream source loading.
- Source filter, component/block filter, category filter, search, and browser-local favorites.
- AI payload now carries both NPM and registry dependency requirements with the licensed source.
- Direct authenticated AI adaptation through Tayar's existing AI service, with bounded source context and no automatic code execution/application.
- AI source is explicitly treated as untrusted data to reduce prompt-injection risk from third-party code comments.
- Coding Assistance includes an in-tool project picker backed by the user's RLS-scoped `projects` rows; it can also inherit the Workspace active project.
- When a target Tayar project is selected, Coding Assistance reads a bounded, read-only project snapshot, detects framework/package metadata, and reports missing component dependencies.
- The bounded active-project snapshot is included in AI adaptation context, with project source explicitly treated as untrusted data.
- AI request budgeting stays below the current 40k-character backend request ceiling by bounding project file context to 8k characters, component source to 10k characters, and package metadata to 80 dependency entries per section.
- Structured AI patch planning returns validated create/replace operations and a before/after change preview.
- Patch planning blocks deletes, environment/credential files, lockfiles, package.json writes, unsafe paths, duplicate operations, and oversized payloads.
- Safe Apply is enabled only for recognized `content.files` project stores and requires explicit in-UI confirmation after review.
- Apply re-reads the project and checks both the file-store fingerprint and row `updated_at` to reject stale/racing writes.
- Each successful apply stores a bounded per-file rollback checkpoint; rollback is allowed only while the file-store fingerprint still matches the applied state.
- Safe Apply blocks unresolved npm dependencies, unresolved registry dependencies, and replacement of files that are absent or truncated in the bounded AI snapshot.
- Per-file truncation is tracked explicitly, so AI can never replace a file based on a partial excerpt.
- Package-manager detection reads declared project file paths directly, so yarn/bun lockfiles are detected without sending lockfile contents into AI context.

## Next implementation layers

1. Expand the approved upstream catalog with additional MIT/Apache registries after per-source license verification.
2. Add generated local snapshots for offline/fast browsing and change detection.
3. Add package/registry dependency install planning with conflict/version warnings.
4. Add a controlled package.json dependency editor instead of raw package.json AI writes.
5. Add AI variants, similar-component search, and full-page templates.
6. Add registry audits that prevent duplicate IDs, missing license metadata, and restricted sources.

## Verification

The internal branch is checked on GitHub with TypeScript and the dedicated Coding Assistance smoke suite. This verification does not deploy the application to Vercel.


## Private licensed imports

- Users can select local TS/TSX/JS/JSX and style files they already have rights to use.
- Private imports are held only in React session memory; the source is not persisted to localStorage, Supabase, GitHub, or the Tayar public registry.
- The importer rejects environment/credential/lock files, unsafe paths, unsupported extensions, more than 600 files, individual files above 400k characters, and combined imports above 20M characters.
- Users can select individual files or a whole folder; helper/hooks/lib/types/constants files are kept out of the standalone component list to reduce noise.
- For each private component, Tayar recursively bundles up to 16 selected relative/@-alias helper/style files across four import levels, so AI sees required local context without exposing the whole private pack.
- NPM imports are detected locally so project compatibility and install guidance still work.
- A rights/license confirmation checkbox is required before the file picker is enabled.
- Animated-only discovery highlights Motion Primitives, Animata, and other components detected from animation dependencies/names/tags.
