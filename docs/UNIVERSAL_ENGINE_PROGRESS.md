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

## Business logic — atomic related-record workflow merged

PR #151 merged to `main` as
`2fb4952b3421a335d7aa7e4a95e2b2d92d1bb5af`. PR Release Gate run
38266169172 and main Release Gate run 38266516500 both passed.

The existing guarded workflow transition can now apply one bounded mutation to
a related record selected by a required reference, in the same PostgreSQL
transaction as the source state change and immutable idempotency receipt. It
supports typed set, bounded increment and transaction timestamp changes; target
rows are locked and checked against their own declared read/update permissions.
Missing targets or denied permissions abort the entire operation. Workflow
states, formula outputs, counters, arbitrary expressions, fan-out and self-table
references remain unsupported and fail closed. The AI generation contract now
describes this exact executable capability.

Focused workflow/schema regressions, TypeScript, scoped ESLint and generated
bundle consistency passed locally. Release Gate verified the actual PostgreSQL
atomic mutation and denied-target rollback. Earlier PR gates identified stale
generated Supabase BYO, application backend-link and application-release
bundles; all were regenerated from their trusted source scripts before the
passing PR and main gates.

The additive schema migrator recompiles affected workflow functions when
workflow effects, relation fields, or referenced-table permissions/fields
change.

## Deployment and delivery — evidence reporting merged

Client delivery reports now separate the editable project definition and
current requirement contract results from build-artifact verification,
deployment health and live runtime/provider checks. A recorded published URL is
reported as a URL, not proof of healthy deployment; build and external service
status remain explicitly unverified because this report has no fresh execution
attestations. PR #152 merged to `main` as
`7ef664d5e27ee2771955880625e264979a297577`; PR Release Gate run 38267122879
and main Release Gate run 38267488592 both passed. The real
application-generation/delivery regression, TypeScript and focused ESLint
passed locally.

## Reference projects — generated-contract coverage

The regression covers seven synthetic definitions: retail, restaurant, school,
clinic, government, factory and custom research. Each model is validated and
compiled to schema SQL, then passed through the real application preparation
path with a structured project specification and a bound overview data view.
Current requirement coverage must pass for authentication, page access and
record reading; a broken table binding must fail before the project is applied.
The check also verifies RLS, owner isolation and each model's expected native
backend feature. Invalid transaction permissions and booking resources fail
closed. Release Gate now runs this focused regression. These are generated
contract fixtures, not complete end-to-end customer products or live provider
proof.

## Reference project runtime isolation — added

The Release Gate now also runs each of the seven generated reference schemas on
an isolated PostgreSQL database. It seeds records for two test owners, confirms
each authenticated owner can read only their own row, and verifies an attempted
owner reassignment is denied or rejected without changing the row. The fixtures
reset the disposable schemas after use. This proves the generated schemas apply
and their baseline tenant boundary works; it does not claim full customer
product E2E or live provider readiness. Existing transaction, workflow,
formula, booking and related PostgreSQL regressions remain the evidence for
those native capability classes.

The rollback safety regression also covers a verified publish whose project
metadata commit fails: the previous live snapshot is restored and editor
publication state stays unchanged. This is a recovery contract test, not proof
of a live provider restore.

The generated PostgreSQL schemas now also execute each reference project's
primary feature: retail/factory inventory transactions, restaurant/government
workflow transitions, school formula calculation, clinic booking and overlap
rejection, and research-sample analysis. The seven scenarios passed the full
Release Gate in PR #164. This verifies generated database behavior, not the
generated page/browser/backend integration or a complete customer-ready product.

The seven fixtures now also pass through the real saved-project HTML renderer and
private application-page bootstrap preparation. The regression verifies that
each rendered page receives its actual project definition and correctly bound
primary data view, including the declared transaction, workflow, booking or
formula field. This closes the generated HTML-to-runtime-configuration handoff
check; it does not simulate browser interaction or prove live provider access.

Release Gate boots a rendered application page with its real browser
bootstrap in headless Chrome and verifies that the generated data view reads and
displays a fixture record. It clicks a generated workflow transition, executes
it through the actual application runtime against a local mocked Supabase RPC,
and confirms the returned state is rendered in the page. It also opens the
generated inventory transaction form, loads a fixture product, stages a
quantity, submits through the actual private runtime against a mocked RPC, and
confirms the created order is rendered. The generated booking view now loads a
fixture resource, checks availability through its runtime RPC, submits a
reservation, and verifies the created row in the page. These are interaction
proofs for one workflow, transaction, and booking path, not coverage of all
seven reference projects. Formula interactions and project-specific workflow
paths remain to be exercised through generated pages.

The next evidence gap is to extend those feature interactions through generated
pages and the application runtime, then run controlled isolated activation of
the custom-code Sandbox. Production migration history and provider activation
stay separate final-stage work; these fixtures touch no production database or
credentials.


## Business logic — bounded multi-record workflows merged

PR #154 merged to `main` as
`d09a03559292e5559b0d6ff8373f572eaf88be11`. PR Release Gate run
38276567066 and main Release Gate run 38277439123 both passed.

The existing atomic workflow engine now supports up to four distinct related
tables per transition, with one row per table, stable target lock order,
per-target permission checks and transaction rollback. The AI contract and
generated runtime bundles were updated from their source generators. Release
Gate also exposed a stale application-page browser bundle; it was regenerated
from `scripts/build-application-page-browser.mjs`. PostgreSQL constraint
rollback, the other application database regressions, production build,
dependency audit and whitespace checks passed in both gates.

The Supabase Preview migration check remains blocked by migration history drift:
the connected production database has 46 recorded versions absent from the
current local migration filenames, while 58 local versions are not recorded by
their current version. Several logical migration names exist on both sides with
different timestamps. This is historical drift, not a single stale migration.
Do not rewrite database history, add no-op migration placeholders, or apply
production migrations to silence the check; reconcile the historical source
mapping before enabling preview migration validation. Production has not been
deployed from this branch.

## Custom code — isolated execution boundary

The server now defines a provider-neutral, one-shot execution contract for
untrusted custom code. Each adapter invocation must create a fresh Node 22 VM
with network access denied, persistence disabled, one vCPU, and a bounded
timeout. Requests and results must be finite JSON within strict size and depth
limits. The boundary stops the sandbox after success, failure, timeout or
oversized output and returns stable error codes without forwarding provider
errors.

Release Gate now runs regressions for the policy contract, missing-adapter
fail-closed behavior, request/output bounds, timeouts, cleanup, and a mocked
Vercel Sandbox REST adapter. The adapter requests an empty network allowlist,
ephemeral Node 22 VMs, bounded resources and lifetime, and sends no environment,
repository, mount or customer credential fields. Its HTTP contract is covered
with mocked requests and responses only. No Vercel account, credential or live
VM was used, and the adapter is not mounted into an application route.

Custom operations remain rejected during project generation until this
provider behavior is verified against a controlled activation sandbox and
explicitly wired to the server-side application runtime. No customer code can
reach this adapter today.

The Website Builder AI undo path now has a direct behavioral regression in
Release Gate. It verifies restoration of the complete captured page, site,
brand, SEO, theme, header and reusable-symbol state; confirms restored
collections are detached from the saved snapshot; and rejects stale-project or
in-progress undo attempts without applying project data. Before a valid undo,
the current project is now checkpointed so the history panel can restore an
accidentally reverted AI result.

## Honest completion boundary

Phase one structured analysis is merged, but broader inferred-requirement depth
will continue to evolve with the generator. Phases two through seven still
require incremental implementation and evidence, especially a verified provider
adapter for the custom execution boundary, safe repair/rollback, and diverse
full reference-project verification. The seven reference projects currently
have generated-contract coverage; that is not evidence that each is a complete
customer-ready product. Final provider activation remains phase eight.
