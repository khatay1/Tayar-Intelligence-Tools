# Universal engineering platform — verified checkpoint

## Durable rules

Extend the existing application engine; do not create sector-specific engines.
Customer credentials and live provider activation stay last. Social Hub remains
deferred on `deferred/social-hub-foundation-20261011` and must be preserved.
Generated code, a successful build, passing tests, deployment and verified live
services are distinct delivery states.

## Phase zero — complete on 2026-10-11

- PR #146 merged to `main` as
  `ab55075ea6f8ebd09b71994a0e631efe12e96024` after Release Gate
  38165046959 passed. The subsequent main Release Gate 38165264856 also passed.
- The stale owned runtime and dependent BYO Edge bundle were regenerated from
  their trusted source. The application data-view browser regression now waits
  for an explicit terminal result, detects crashes/timeouts and cleans up the
  Chromium process group safely. Real CI Chrome passed the en/ar/sv assertions.
- Source migration `20261011183711_phase_zero_advisor_hardening.sql` added the
  16 verified foreign-key indexes and converted the constant scheduler readiness
  function to SECURITY INVOKER while preserving ACL, RLS and disabled scheduling.
  The live Supabase migration record is version `20261011184736` with the same
  logical migration name. Embedded and native PostgreSQL regressions passed.
- After the migration, the uncovered-FK advisor notice count is zero. Remaining
  SECURITY DEFINER notices were reviewed rather than blanket-revoked: their
  exposed callers have explicit grants, fixed search paths and application
  authorization/published-site guards. RLS-without-policy tables remain private
  server-only tables. Newly created indexes can appear as unused until workload.
- Supabase leaked-password protection remains disabled because the organization
  is on the Free plan and the supported feature requires an owner plan decision.
  No billing, Auth configuration, customer credential or secret change occurred.
- Vercel production deployment `dpl_BhDGCqhxhDMBZBm6MhjSmKZGUuJo` is READY from
  the exact merged SHA above. `https://www.tayar.se/` and its manifest returned
  200; an invalid published-site API path returned the expected 400. These probes
  do not claim that unconfigured customer services are live.

## Phase one — active batch

Branch: `feature/universal-project-specification-20261011`.

Implemented a domain-neutral `ProjectSpecification` attached to the existing
`ApplicationRequirementManifest`. It references the existing generated schema,
roles and requirement IDs rather than creating a parallel generator. The closed,
bounded contract records actors, entity scope/sensitivity, explicit or inferred
requirements, observable acceptance criteria, operations and dependencies,
business rules, tenancy, deferred integration scopes, privacy/retention and
unresolved decisions.

The validator rejects unknown fields/IDs, duplicates, missing table
classifications or requirement coverage, dependency cycles, missing sensitive
data plans, contradictory tenancy and unresolved conflicts. Custom execution and
organization/branch isolation fail closed until their isolated executor and
membership policies exist. Descriptive rules and acceptance criteria are never
treated as implementation or test evidence.

Agent-mode application generation now requires this specification and validates
it before mutating editor state. Legacy/manual projects and ordinary brochure
generation remain backward compatible. The AI request performs the analysis in
the existing single generation call and is explicitly forbidden from inventing
credentials, sector assumptions or unsupported native behavior.

Verified locally after this change:

- TypeScript and focused ESLint passed.
- Domain-neutral specification regression passed across retail, restaurant,
  school, clinic, government, factory and a custom research record model.
- Real generation-handler regression passed: a valid specification persisted;
  a missing specification and claimed custom execution were rejected atomically.
- Application foundation, release upload/endpoint, backend link, published
  runtime, owned source/runtime binding and BYO Edge regressions passed.
- Application runtime, backend-link, release, owned runtime and BYO publish
  generated artifacts were regenerated from source. Release Gate is required
  once after the stable commit and before merge.

## Honest completion boundary

Phase one is not complete until this batch passes Release Gate and merges.
Phases two through seven still require incremental implementation and evidence,
especially isolated custom code execution, generalized atomic workflows,
requirement-to-test coverage results, safe repair/rollback and diverse full
reference-project verification. Final provider activation remains phase eight.
