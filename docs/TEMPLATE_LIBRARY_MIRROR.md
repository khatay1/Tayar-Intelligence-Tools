# Tayar Template Library Architecture

## Goal

Mirror the large 24Billions template library into Tayar without putting thousands of binary files into GitHub, Vercel or Supabase Storage.

## Storage model

- GitHub stores code, migrations and metadata logic only.
- Cloudflare R2 stores mirrored binaries under `24billions/` and serves them from a public HTTPS custom domain.
- Supabase keeps the searchable metadata and original-source manifest; it is not in the binary delivery path after cutover.
- `template_sources` records provider and redistribution basis.
- `template_assets` records one row per mirrored file.
- `template_import_runs` records bulk import batches and failures.

Each mirrored asset keeps:

- source page URL
- original download URL
- original filename
- category and format
- MIME type
- byte size
- SHA-256 checksum
- Tayar storage path
- import status
- public/private state

## Security

The sync worker is admin-only and never accepts arbitrary hosts.

Allowed source hosts are currently limited to:

- 24billions.com
- www.24billions.com
- approved Google Drive delivery hosts used by the source library

Every redirect is validated again to reduce SSRF risk.

Per-request limits:

- 10 files
- 50 MB per file
- 120 MB total imported bytes
- 5 redirects maximum

The Storage bucket allows up to 50 MB per object.

## Discovery workflow

The separate `template-library-discover` worker scans one approved 24Billions page at a time and returns candidate file/download URLs. It is intentionally non-recursive so a malformed page cannot turn into an uncontrolled crawler. Source roots are stored in `source-catalog.ts` and can be processed in batches.

## Import workflow

1. Discover public template download URLs.
2. Build an import batch manifest.
3. Admin invokes `template-library-sync`.
4. The migration runner downloads each asset directly from its original 24Billions/Google Drive URL.
5. SHA-256 is calculated.
6. The asset is stored in R2 under:
   `24billions/<category>/<checksum-prefix>-<filename>`
7. Metadata is marked `ready`.
8. Tayar reads only `ready + public` assets and builds binary URLs from `VITE_TEMPLATE_LIBRARY_BASE_URL`.

## Supabase-to-R2 cutover

The safe cutover does not download binary objects from Supabase:

1. Create an R2 bucket, expose objects only through its public custom domain, and create an R2 API token restricted to that bucket.
2. Configure a public custom domain for the bucket, for example `https://templates.tayar.se`.
3. Keep credentials only in the local shell; never use an `R2_*` secret in a browser/Vite variable.
4. Export the required variables and run `npm run templates:r2:plan`.
5. Run `npm run templates:r2:migrate`. The runner uses original Google Drive URLs, validates every SHA-256 value, uploads the same object keys, and verifies each object with R2 HEAD. Re-running it is safe.
6. Deploy once and test catalog downloads and image previews. Production defaults to `https://templates.tayar.se`; `VITE_TEMPLATE_LIBRARY_BASE_URL` remains available only as a public URL override.
7. Run `npm run templates:supabase:purge:plan`.
8. Only after R2 and production verification, run `npm run templates:supabase:purge -- --confirm=<printed-confirmation>`.

Required local variables for the migration:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
```

The service-role and R2 secrets must never be pasted into chat, committed, or added as `VITE_*` values. The purge tool is locked to Supabase project `pnbllxdlskljcakyaylt`, bucket `template-library`, prefix `24billions/`, and the audited count and byte size. It performs a dry run unless both `--execute` and the printed confirmation are supplied. It never touches `published-sites` or deletes `template_assets` rows.

## Why not GitHub

Putting 11,000+ Word, Excel, PDF, PPT and Power BI files inside the application repository would:

- make clones and fetches huge
- make Vercel deployments slower and more fragile
- make routine code review noisy
- make asset updates require code commits

Object storage keeps application code independent from library size.

## Redistribution record

The source row records the redistribution basis separately from public marketing copy. For the initial 24Billions mirror, the basis stored by the project is the user's explicit confirmation on 2026-08-31 that the files may be redistributed by Tayar.
