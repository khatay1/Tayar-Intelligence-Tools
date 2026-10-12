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

## Phase one — structured specification merged

PR #147 merged to `main` as
`f30ad8e37c3b1c547b212f14a3e8f5ae93f891e3`. PR Release Gate
38168336221 and main Release Gate 38168604276 both passed.

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
  generated artifacts were regenerated from source and passed consistency checks.

## Autonomous QA — coverage matrix merged

PR #148 merged to `main` as
`c59444be414f383f9f9786257ad7e02822539aad`. PR Release Gate
38219553289 and main Release Gate 38219830834 passed.

The existing requirement verifier now builds explicit coverage rows:
Requirement → Implementation → Contract Test → Result → Delivery Status. It
recomputes evidence from the current project and executes the existing form/data
view compilers; saved AI claims cannot create a passing row. Specification
operation IDs are included as traceability metadata, while test results come
only from current executable contracts.

Removed pages, invalid bindings and missing native actions produce failed tests
and block approval. Delivery reports include the matrix and use
`contract-verified`, which intentionally does not claim deployment or live
service verification. Applications cannot be marked delivered while unpublished
or while a launch-readiness check fails. Brochure compatibility is unchanged.

Focused TypeScript, ESLint, coverage-matrix and real generation/delivery
regressions passed, followed by both full gates.

## Business logic — active declarative workflow batch

PR #149 merged to `main` as `09e5406891d9af32b68cbed19352888d9f1ba524`.
PR Release Gate 38244010970 and main Release Gate 38244295671 both passed.

The existing atomic workflow engine now supports optional bounded same-record
effects on each transition: a typed literal assignment, a bounded numeric
increment, or a server transaction timestamp. Effects run in the same locked
PostgreSQL transaction as the guarded state change and the existing idempotency
receipt. They cannot target the state field, formulas, protected counters,
duplicate fields, unknown fields or arbitrary expressions/code.

Validation enforces closed shapes, field/type compatibility and a maximum of 20
effects. Existing workflows remain compatible. The AI generation contract may
use only these declared primitives and must report cross-record logic as
unsupported rather than inventing execution. TypeScript, ESLint, workflow,
schema, backend verification, release endpoint, owned source, BYO Edge,
generation/coverage and all generated-artifact consistency checks passed
locally. The PostgreSQL concurrency/effect assertion runs in Release Gate.

## Business logic — workflow audit history merged

PR #150 merged to `main` as `829cd67036cba3192937dd95ee15941bca6e68e3`.
PR Release Gate 38245758281 and main Release Gate 38246046180 passed.

Workflow receipts now carry a server transaction timestamp, are indexed by
record and time for audit history retrieval, and reject updates/deletes at the
database trigger layer. The owned workflow catalog verifier checks the new
column, index, function and immutable trigger. This strengthens the existing
private transition audit records without exposing sensitive transition details
through client access. PostgreSQL assertions verify timestamp presence,
immutability and catalog integrity in Release Gate.

## Business logic — active atomic related-record workflow batch

The existing guarded workflow transition can now apply one bounded mutation to
a related record selected by a required reference, in the same PostgreSQL
transaction as the source state change and immutable idempotency receipt. It
supports typed set, bounded increment and transaction timestamp changes; target
rows are locked and checked against their own declared read/update permissions.
Missing targets or denied permissions abort the entire operation. Workflow
states, formula outputs, counters, arbitrary expressions, fan-out and self-table
references remain unsupported and fail closed. The AI generation contract now
describes this exact executable capability.

Focused workflow, schema and real generation-handler regressions, TypeScript,
ESLint and affected generated bundle consistency passed locally. The PostgreSQL
concurrency and rollback assertions are part of Release Gate; no local isolated
PostgreSQL fixture is configured. The first PR gate identified a stale generated
Supabase Edge deployment bundle; it was regenerated from its trusted entry
source and its consistency check now passes.

PR #151 Release Gate run `38264726749` failed in Project health only because
`supabase/functions/website-byo-publish/index.ts` was stale after the workflow
model change. Regenerated it from `scripts/build-website-byo-publish-function.mjs`;
its exact bundle check now passes locally. The additive schema migrator also
recompiles affected workflow functions when workflow effects, relation fields,
or referenced-table permissions/fields change. Focused workflow/schema
regressions, TypeScript, scoped ESLint, and whitespace checks pass. The PR still
needs this generated artifact and migration fix, then a fresh Release Gate.

## Honest completion boundary

Phase one structured analysis is merged, but broader inferred-requirement depth
will continue to evolve with the generator. Phases two through seven still
require incremental implementation and evidence, especially safe isolated custom
code execution, requirement-specific test outcomes, safe repair/rollback and
diverse full reference-project verification. Final provider activation remains
phase eight.
