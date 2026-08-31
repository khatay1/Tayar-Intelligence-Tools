# Tayar Template Mirror Architecture

## Goal

Mirror the large 24Billions template library into Tayar without putting thousands of binary files into GitHub or Vercel.

## Storage model

- GitHub stores code, migrations and metadata logic only.
- Supabase Storage bucket `template-library` stores mirrored binaries.
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

## Import workflow

1. Discover public template download URLs.
2. Build an import batch manifest.
3. Admin invokes `template-library-sync`.
4. The worker downloads and validates each asset.
5. SHA-256 is calculated.
6. The asset is stored under:
   `24billions/<category>/<checksum-prefix>-<filename>`
7. Metadata is marked `ready`.
8. Tayar reads only `ready + public` assets.

## Why not GitHub

Putting 11,000+ Word, Excel, PDF, PPT and Power BI files inside the application repository would:

- make clones and fetches huge
- make Vercel deployments slower and more fragile
- make routine code review noisy
- make asset updates require code commits

Object storage keeps application code independent from library size.

## Redistribution record

The source row records the redistribution basis separately from public marketing copy. For the initial 24Billions mirror, the basis stored by the project is the user's explicit confirmation on 2026-08-31 that the files may be redistributed by Tayar.
