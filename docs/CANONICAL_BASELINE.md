# Canonical Baseline

This clean baseline was prepared from Git commit `9ff2ee4261ae32edaea11ad95d9ea35d1d687733` (public-site polish) and is the source tree to continue building on.

## Removed as unnecessary or obsolete

- Duplicate outer copy of the project from `final.zip`
- `.git/` metadata from the uploaded archive
- `dist/` build output
- `.bolt/` generator metadata
- Empty `db-data.sql`
- Unused `public/icon-512.webp`
- Legacy `scripts/upgrade-website-builder-ai.ps1`
- Dead/unreachable UI/source files: old `Dashboard.tsx`, `GlassCard.tsx`, `GlobalSearch.tsx`, `AISettings.tsx`, placeholder `image-service.ts`, and unused `errors.ts`

## Production cleanup applied

- Removed verbose authentication/onboarding debug logs
- Removed noisy AI provider payload/model logs
- Email Edge Function no longer logs recipient/subject; it fails closed unless a provider is configured or explicit development mode is enabled
- Auth profile is refreshed after auth-state changes so plan/profile state is available without a manual reload
- `.env.example` now reflects environment variables actually used by the codebase
- PWA manifest no longer contains shortcuts that the current hash router does not honor
- Sitemap no longer lists noindex authentication hash pages
- `.gitignore` excludes generated/cache metadata consistently

## Continue from here

Use this directory as the only project root for future work. Generated `dist/` output is disposable and should be recreated with `npm run build`.
