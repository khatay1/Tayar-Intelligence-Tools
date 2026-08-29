# Canonical Baseline

## Source of truth

The GitHub `main` branch is the only source of truth for Tayar Intelligence Tools.

On 2026-08-29, the uploaded archive `Tayar-Intelligence-Tools-CANONICAL-CLEAN-TRANSLATIONS-COMPLETE (1).zip` was reviewed against the production-hardened repository.

The archive is **not** used as a wholesale replacement for `main` because it predates later security, TypeScript, lint, billing, admin, workspace, CI, Vercel, and production-hardening work.

A later attempt to adopt its compact Website Builder sidebar/drawer layout was reverted because it degraded the builder design. The stable production-hardened Website Builder layout is the canonical UI baseline again.

All later security, billing, admin, workspace, publishing, TypeScript, P1/P2, service-worker, Vercel, and release-gate fixes remain preserved.

## Working rule

Do not continue development from old ZIP copies or extracted folders.

Always start from the repository `main` branch:

```powershell
git switch main
git pull --ff-only origin main
```

Generated `dist/` output is disposable and should be recreated with `npm run build`.


## Production release note — 2026-08-29

The Admin AI default-model fix is part of the canonical production baseline. The production AI engine resolves models in this order: per-tool user setting, administrator default model, then the safe Gemini fallback.


## Admin AI model manager — 2026-08-29

The canonical Admin AI interface now includes a dark model manager. Administrators can add custom Gemini model IDs to the managed catalog, choose any managed model as the default, and remove custom models after switching away from them. The production AI engine reads this catalog server-side.
