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
- `DavidHDev/react-bits` — current Commons Clause restriction — blocked from registry redistribution.

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

## Next implementation layers

1. Add upstream MIT component ingestion with preserved license notices.
2. Normalize imported React/Tailwind component metadata.
3. Add project-aware dependency detection.
4. Add safe patch/diff/apply against user projects.
5. Add AI variants, similar-component search, and full-page templates.
6. Add registry audits that prevent duplicate IDs, missing license metadata, and restricted sources.
