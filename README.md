# Tayar Intelligence Tools

Canonical source tree for the Tayar Intelligence Tools platform. This baseline includes the polished public site, authenticated workspace, AI/document tools, Team Workspace, secure billing scaffolding, Supabase migrations/functions, and Website Builder V1.

## Local setup

```bash
npm ci
cp .env.example .env
npm run dev
```

Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` before using authenticated/cloud features. Edge-function secrets belong in Supabase secrets, not in the browser `.env`.

## Quality commands

```bash
npm run health:project
npm run typecheck
npm run lint
npm run build
```

`health:project` runs the project-wide cleanup checks plus the Website Builder launch checks and public-site polish checks.

## Supabase

Apply migrations with:

```bash
npx supabase@latest db push
```

Deploy Edge Functions when their code changes. Stripe functions additionally require Stripe secrets described in `.env.example`.

## Source-of-truth rule

Build new work on this root only. Do not copy old Sprint folders, `dist`, `.git`, `.bolt`, or generated ZIPs into the project source tree. See `docs/CANONICAL_BASELINE.md`.

## Applying this baseline over an existing Git clone

Copy this clean tree over the clone, then run `powershell -ExecutionPolicy Bypass -File scripts/apply-canonical-cleanup.ps1`. The script removes only known legacy/generated paths and never touches `.git`. Review with `git status` before committing.
