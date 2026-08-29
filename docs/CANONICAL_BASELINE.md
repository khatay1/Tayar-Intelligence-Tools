# Canonical Baseline

## Source of truth

The GitHub `main` branch is the only source of truth for Tayar Intelligence Tools.

On 2026-08-29, the uploaded archive `Tayar-Intelligence-Tools-CANONICAL-CLEAN-TRANSLATIONS-COMPLETE (1).zip` was reviewed against the production-hardened repository. The archive was not copied over `main` wholesale because it predates later security, TypeScript, lint, billing, admin, workspace, CI, Vercel, and production-hardening work.

The latest Website Builder UI refinements from that archive were safely merged onto the newer production baseline instead:

- Collapsible Build sidebar
- Collapsible Inspector sidebar
- Operational panels moved into compact side drawers
- Sticky compact builder header
- Responsive fixed sidebars on smaller screens
- Existing P0/P1/P2, production hardening, billing, admin, workspace, publishing, security and release-gate fixes preserved

The canonical merge passed the full GitHub Release Gate: lint, project health, production build, production dependency audit, and whitespace validation.

## Working rule

Do not continue development from old ZIP copies or extracted folders.

Always start from the repository `main` branch:

```powershell
git switch main
git pull --ff-only origin main
```

Generated `dist/` output is disposable and should be recreated with `npm run build`.
