# Tayar platform Production rollout: safe preflight

**Status: BLOCKED.** This is a read-only preparation document for the Tayar platform at www.tayar.se. It does not authorize customer-app Production publishing, Production deployments, migrations, alias changes, credential changes, or paid services.

Track readiness in issue #332: https://github.com/khatay1/Tayar-Intelligence-Tools/issues/332

## Verified identities (2026-10-22)

- Serving public Production: Vercel deployment dpl_BhDGCqhxhDMBZBm6MhjSmKZGUuJo, READY, SHA ab55075ea6f8ebd09b71994a0e631efe12e96024 (2026-10-11).
- Latest inspected merged main: 07560f0b357847dcd13ac014bda5b9fb8b472ad3 (unreleased; re-pin before activation).
- PR #331 head 3f44d5e71d100cbec65b6bed75ff995ba516a1e1: Release Gate run 39835563206 passed. This does NOT prove the post-merge main gate.
- Production Supabase project: pnbllxdlskljcakyaylt. The Preview/Activation database is separate and not interchangeable with Production.

## Read-only source/history reconciliation

Supabase migration list and repository filename inventory were compared without changes:

- Remote history: 119 versions.
- Repository source: 149 migration SQL files.
- 74 direct version/name matches.
- 45 reviewed renamed-version matches from supabase/migration-source-map.json.
- 30 source files without an equal remote migration identity. Nine are explicitly quarantined in localWithoutRemoteName and need historical provenance review. The remaining 21 are new candidate sources, NOT an approved application sequence.
- No unexplained remote history or version collisions were observed.

**This does not prove live SQL body/schema equality, successful migrations, RLS behavior or restore capability. Never apply all 30 files simply because they appear pending.**

## Re-run the safe check

1. Obtain a fresh read-only Supabase migration metadata inventory for the exact production project. Do not store secrets, customer content, Auth accounts or credentials.
2. Save it outside the repository as JSON with projectRef and migrations fields. Each migration requires version and name strings. This can be constructed from a trusted read-only migration-list response.
3. From an exact pinned repository checkout run:

    node scripts/production-migration-preflight.mjs /private/path/production-migrations.json
    node scripts/production-migration-preflight-regression.mjs
    node scripts/verify-migration-source-map.mjs

The migration preflight imports the current source-map verifier and fails closed for wrong project, mismatches, duplicates, malformed rows and any pending SQL identities. It prints inventory-only diagnostics, never connects to production and never writes. A successful exit **never** authorizes deployment.

## Mandatory final release gates

1. Obtain exact post-merge main Release Gate proof and reviewed Vercel candidate build, with the same exact commit SHA.
2. Individually reconcile the nine historical unmapped migrations using byte-level source provenance and read-only schema/catalog checks, without editing remote migration history blindly.
3. Investigate the 21 newer candidate migrations and create a dependency-aware, forward-only migration plan. Test on an isolated restored copy with synthetic data, review locks/permissions/row security, and ensure a real recovery option.
4. Preserve production accounts, saved projects, published snapshots and the Syrian property website. Verify admin authentication plus create/save/load and native application-generation behavior with a safe staging setup and no paid AI/provider calls.
5. Check only names and deployment targets of production environment variables; do not reveal secret values.
6. Prove domain and deployment identity continuity, a restorable backup and verified application+database rollback steps. Reverting Vercel alone may not reverse migrations.
7. Request separate explicit approval for any live schema changes, production traffic promotion, accounts, paid providers or keys.

**Hard stop:** No automatic Production rollout, database writes, commercial service activation, or exposure of credentials from this preflight.
