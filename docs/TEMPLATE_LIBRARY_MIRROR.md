# Tayar Template Library Architecture

## Current architecture

Tayar delivers mirrored template binaries from Cloudflare R2. GitHub stores application code, migrations and operational scripts. Supabase stores searchable template metadata and source records, but is no longer the binary delivery path for the 24Billions library.

The legacy Supabase template import pipeline has been retired. The following Edge Functions intentionally return `410 Gone` and must not be used for new imports:

- `template-library-discover`
- `template-library-drive-discover`
- `template-library-sync`
- `template-library-audit`
- `template-library-repair`
- `template-library-delete-invalid`

The old browser importer and audit-console scripts have also been removed so an admin session cannot accidentally restart the retired Supabase Storage workflow.

## Storage model

- GitHub: code, migrations, metadata logic and guarded operational scripts only.
- Cloudflare R2: template binaries, normally under the existing `24billions/` object keys.
- Supabase database: template catalog metadata, source provenance and import history.
- Supabase Storage `template-library`: no longer used for the 24Billions binary library after cutover.

`template_sources` records provider/source information and redistribution basis.
`template_assets` records one row per catalog asset, including its storage path and checksum.
`template_import_runs` records historical import batches and failures.

Each mirrored asset should retain enough metadata to verify provenance and integrity, including source page URL, original download URL, original filename, category, format, MIME type, byte size, SHA-256 checksum, Tayar object path and publication state.

## R2 delivery

Production builds template URLs from the public R2 base URL. The normal production endpoint is `https://templates.tayar.se`; `VITE_TEMPLATE_LIBRARY_BASE_URL` is only a public URL override and must never contain credentials.

R2 credentials must remain server/local-shell secrets. Never expose `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, Supabase service-role credentials or other private keys through Vite/browser variables.

## Supported operational workflow

Use only the guarded R2/Supabase maintenance scripts exposed in `package.json`:

```text
npm run templates:r2:plan
npm run templates:r2:migrate
npm run templates:supabase:purge:plan
npm run templates:supabase:purge
```

### R2 plan and migration

`templates:r2:plan` performs a dry-run style plan. `templates:r2:migrate` is the explicit execution path. The migration utility may fetch original approved source URLs, validates expected SHA-256 values, uploads to R2 and verifies objects before considering them available.

Required local variables for R2 migration are:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
```

Secrets must never be pasted into chat, committed to Git, or placed in variables prefixed with `VITE_`.

### Supabase purge

The Supabase purge utility exists only as a guarded cleanup/recovery tool. It must not be used as an importer.

Always run the plan first:

```text
npm run templates:supabase:purge:plan
```

The execute path requires the script's explicit confirmation safeguards. It is scoped to the intended template-library location and must never touch `published-sites` or unrelated buckets.

After the R2 cutover, the 24Billions binary content in Supabase Storage is expected to remain empty. A future migration must not repopulate it unless the architecture is deliberately changed and reviewed first.

## Security rules

- Do not restore browser-driven bulk importers.
- Do not restore the retired Supabase discovery/sync/audit/repair endpoints without a new architecture review.
- Do not accept arbitrary download hosts in any future migration worker.
- Validate redirects and final source hosts before fetching remote assets.
- Validate file size/type and checksum before publishing an object.
- Keep service-role and R2 credentials server-side only.
- Prefer dry-run/plan modes before destructive or bulk operations.
- Keep catalog metadata independent from binary storage so storage providers can change without rewriting the library UI.

## Why not GitHub or Vercel for binaries

Putting thousands of Word, Excel, PDF, PowerPoint or Power BI files in the application repository would make clones and fetches large, slow deployments, create noisy reviews and tie asset updates to code releases. Object storage keeps application code independent from library size.

## Redistribution record

Source and licensing/redistribution evidence must remain recorded separately from public marketing copy. Only assets with a confirmed right to redistribute should be made public through Tayar.
