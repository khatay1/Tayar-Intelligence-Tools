Warning: truncated output (original token count: 8061)
Total output lines: 502

Warning: truncated output (original token count: 8002)
Total output lines: 499

# Universal engineering platform — verified checkpoint

## Current continuation checkpoint — 2026-10-14

- Latest `main` is `992bd71beb70f37f233bdcbe0481306d3a9a55fe`; PR #224 updated this checkpoint. PR #222 merged the custom-operation runtime at `9a86ee7cc5109a7cc33096b783b07b5abd798e7b` after Release Gate `38630863891` passed and Preview `dpl_DzwsUhYabVNK2LQXx3PEtKyJyYWa` became READY.
- Production remains READY at `ab55075e`, behind `main`. No Production promotion occurred. Runtime and custom-execution flags remain off unless explicitly enabled by an operator.
- PR #221's quota fix records failed isolated executions as errors while consuming reservations. Its migration is committed but not applied to Supabase; isolated PostgreSQL, PGlite and mainline Release Gate evidence passed before PR #222.
- Supabase advisor findings remain scoped for owner review: catalog checks found all 96 foreign keys indexed despite the advisor discrepancy; SECURITY DEFINER/private RLS findings were reviewed as intentional server/API boundaries. Leaked-password protection remains unavailable on the current Free plan. No live database, Auth or billing setting changed.
- Active branch `feat/generated-custom-operation-client-20261014` adds `window.tayarApplication.executeCustomOperation` to authenticated platform application pages. Calls are limited to custom operation IDs in the trusted specification, include the immutable release ID, use same-origin POST, verify the signed-in user, and check the session again after the response. Customer-owned deployments do not get this client.
- Client, application data runtime, browser session bridge and generated bundle regressions pass locally; TypeScript, scoped ESLint and generated-bundle consistency pass. The local reference-page Chrome launcher cannot start its HTTPS proxy because this container blocks `sudo`; hosted Release Gate includes that browser test. Require this branch's Release Gate and Preview to pass before merge.
- After this merge, wire declarative generated-page actions to the client and add requirement-linked executable acceptance evidence. Keep custom execution disabled until those checks exist. No Supabase migration or Production activation was performed.

## Live repository check — 2026-10-14

- `main` is `6612bb8dbbe572d23568b988acd8b079dcfa39a3`; PR #217 is merged
  after PR Release Gate `38595436276`, Vercel Preview, and main Release Gate
  `38595967134` all passed. PR #146 is merged as
  `ab55075ea6f8ebd09b71994a0e631efe12e96024`; its stale-runtime and browser
  regression failures are resolved and are not current blockers. PR #213 also
  merged as `7e8c258c`; the latest main Release Gate passed.
- Production deployment `dpl_BhDGCqhxhDMBZBm6MhjSmKZGUuJo` is READY at
  `ab55075e`, behind `main`. Promotion remains deferred until the outstanding
  platform work passes its release gate; previews are not production delivery.
- Supabase advisor snapshot on the active project (2026-10-14): no uncovered
  foreign-key notices are recorded in the phase-zero migration checkpoint.
  Remaining SECURITY DEFINER and private-table RLS notices were reviewed as
  intentional server/API boundaries; do not blanket-revoke grants or add RLS
  policies. Newly added indexes can still appear unused before representative
  workload. Leaked-password protection remains disabled on the Free plan and
  requires an owner plan decision; no billing or auth setting was changed.
- The merged custom-operation batch stores bounded custom operation source in the
  immutable private release snapshot and resolves it only by matching owner,
  project, release and operation IDs. It remains inert and cannot pass delivery
  coverage; the custom-operation route remains unmounted pending end-user
  authorization and runtime integration. Focused regressions, type checks and
  both release gates passed.
  Regenerated Vercel, BYO publish, application release and runtime artifacts
  match their sources. Production has not been promoted.

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

The seven fixtures now also pass through the real …61 tokens truncated…ared transaction, workflow, booking or
formula field. This closes the generated HTML-to-runtime-configuration handoff
check; it does not simulate browser interaction or prove live provider access.

Release Gate boots rendered application pages with their real browser
bootstrap in headless Chrome and verifies that generated data views read and
display fixture records. It now also opens each of the seven generated reference
project pages (retail, restaurant, school, clinic, government, factory, and
custom research) in Chrome and verifies the page-specific bound data view renders
a labeled fixture row. The fixture records are isolated by project and table,
including schemas that share table names. This verifies the generated page,
private bootstrap, browser runtime, and mocked read path for every reference
definition; it does not exercise each project's full workflow or prove live
provider access.

The browser regression exercises representative project workflows through
the actual private application runtime against local mocked Supabase responses.
The generated restaurant page advances a kitchen ticket queued → cooking →
ready; separate government permits are approved and rejected; and a research
sample advances received → analysed → archived. It also creates an inventory
transaction, checks availability and creates a clinic appointment inside the
clinician schedule, then rejects a second overlapping appointment without
creating another record. Generated school assessment and formula-backed rows
are saved with their computed totals kept out of editable fields. PRs #181–#184
added and passed the Release Gate for the research, restaurant, government and
clinic browser flows. These are representative paths, not full end-to-end tests
for every project type.

The remaining evidence gap is interaction coverage for additional project
behaviors and wiring the now-live-verified Vercel adapter into the server-side
application runtime behind a reviewed, bounded operation contract. Customer
execution remains disabled until that integration and its authorization,
cleanup, timeout and release regressions pass. Production migration history and
provider activation stay separate final-stage work; these fixtures touch no
production database or credentials.


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
with mocked requests and responses only. No credentials were injected into
the provider smoke, and the adapter is not mounted into an application route.

A controlled provider smoke has now created a non-persistent Node 22 sandbox
with one vCPU, a 30-second timeout, and deny-all network policy in the connected
Vercel project. It wrote and read a local fixture file, confirmed an external
fetch was blocked, exited successfully, and the session was stopped. This
verifies the provider can start and isolate a short-lived VM; it does not verify
the repository's REST adapter against Vercel, mount custom execution into an
application route, or activate customer code.

Custom operations remain rejected during project generation until this
provider behavior is verified against a controlled activation sandbox and
explicitly wired to the server-side application runtime. No customer code can
reach this adapter today.

An opt-in live smoke command now exercises the repository adapter and the shared
one-shot cleanup boundary: `npm run smoke:vercel-sandbox:live`. It skips without
a provider request when `VERCEL_TOKEN` is absent; `VERCEL_TEAM_ID` is optional.
Provide credentials only through the local process environment, never by
pasting them into source or command text. The smoke runs one deterministic
expression with deny-all networking and a 10-second execution limit, suppresses
provider error details, and is excluded from CI/Release Gate. It has not yet
been run against Vercel, so the repository-adapter live verification remains
open until that command completes successfully.

## Custom code — live repository adapter verified

The opt-in live smoke completed successfully on 2026-10-13 against main commit
`f999dc64d90fc4f69f177d7013497f6262fe8172` (workflow run
[38480702220](https://github.com/khatay1/Tayar-Intelligence-Tools/actions/runs/38480702220)).
The repository adapter created a deny-all, non-persistent Node 22 sandbox,
executed the deterministic fixture, validated its result, and stopped the
sandbox. This closes the live REST-adapter verification gap. It does not enable
customer execution: the adapter remains unmounted, custom operations remain
rejected during generation, and no customer code or credentials were involved.

## Custom code — published-operation gate contract added

The server now has a fail-closed orchestration contract for a future published
custom operation route. It accepts only owner/project/release/operation IDs and
bounded JSON input; source is resolved server-side from the requested immutable
release. Authorization must pass before source resolution, and a durable usage
reservation must pass before a sandbox is created. The feature defaults off,
rejects release mismatches and extra request fields, and maps provider failures
to stable public codes. Release Gate covers ordering, disabled/unauthorized/
unreserved denial, release mismatch and sandbox cleanup. The existing atomic
per-user usage meter now has a dedicated custom-execution policy and bounded
monthly limits (free 0, Pro 10, Business 50); it is seeded disabled by default.
The server quota adapter validates the tool policy and effective plan before
reserving usage, and finalizes the reservation after a sandbox attempt so
failed customer code still consumes the bounded execution allowance. Release
Gate covers reservation configuration, disabled-policy denial, finalization
and clamped duration metadata. These additions are source-only and have not
been applied to a live database. The orchestration contract remains unmounted;
generation still rejects custom operations. Runtime authentication/release
integration and the production migration remain pending.

A server-only HTTP route contract now limits operation requests to same-origin POST JSON with a 32 KiB body, rejects client-supplied owner/project/source data, and maps failures to stable no-store responses. Release Gate covers origin, method, media type, query, body-size and successful-execution paths. This route contract is not mounted: the immutable release currently carries no custom source artifact or operation authorization policy. Release storage and live-auth bindings must be implemented before any customer operation can run.

The published-operation orchestrator now distinguishes a thrown value from a successful `undefined` result, including adapters that throw `null` or another non-Error value. It still finalizes the reserved attempt before returning a stable failure. The focused regression and TypeScript check passed on PR #211; the route remains unmounted and disabled.

The Website Builder AI undo path now has a direct behavioral regression in
Release Gate. It verifies restoration of the complete captured page, site,
brand, SEO, theme, header and reusable-symbol state; confirms restored
collections are detached from the saved snapshot; and rejects stale-project or
in-progress undo attempts without applying project data. Before a valid undo,
the current project is now checkpointed so the history panel can restore an
accidentally reverted AI result.

## Honest completion boundary

### Published operation identity binding — implementation checkpoint

The execution orchestrator now requires the release resolver to return both
the requested immutable release ID and operation ID. It rejects missing or
mismatched identities, empty source, and extra artifact fields before usage
reservation or sandbox creation. This closes a concrete source-selection gap in
the orchestration contract; it does not implement persistent artifact storage,
authorization policy, or route mounting. The focused custom-operation
regression, TypeScript, scoped ESLint and whitespace checks passed locally.
PR #213 merged as `7e8c258c0a5f7f1fe62f05d93cfa6018679517c1` after its PR and
main Release Gates passed.

### Inert custom-source release artifacts — implementation checkpoint

Custom operations in the structured specification can now carry bounded source
(64 KiB); native operations cannot carry source, and custom code cannot claim
database transaction guarantees. The existing immutable application release
snapshot retains this specification. A server resolver selects source only
when owner, project, immutable release, private release bucket, and operation
IDs all match. The AI generation contract describes deterministic JSON-in/JSON-out
draft source and explicitly forbids claiming it is authorized, executed, or
deliverable. Requirement coverage adds a failing contract row for each custom
operation, so source storage alone cannot pass delivery. Execution remains
disabled pending the authorization and runtime integration work. Focused
specification, generation, coverage, resolver, type and bundle checks passed;
the PR Release Gate and post-merge main Release Gate passed.

The Release Gate identified stale generated dependencies in the Vercel
connection Edge bundle, owned application runtime template, BYO Publish Edge
bundle and application backend-link Edge bundle. Each was regenerated from its
trusted source. Focused feature regressions and the current main Release Gate
passed. The activation preflight remains intentionally not ready because
provider credentials and account configuration are deferred to phase eight.

The first PR gate caught a stale private application runtime bundle. It was
rebuilt from the trusted generator; generated-runtime consistency and the
published-runtime regression passed locally, followed by passing PR and main
Release Gates.

Phase one structured analysis is merged, but broader inferred-requirement depth
will continue to evolve with the generator. Phases two through seven still
require incremental implementation and evidence, especially authorization for
the custom execution boundary, safe repair/rollback, and verified external
service behavior. The seven reference projects have generated-contract coverage
and a browser regression exercising synthetic workflow/transaction behavior for
retail, restaurant, school, clinic, government, factory and custom-research
projects. This is not evidence that each is a complete customer-ready product.
Final provider activation remains phase eight.

## Business logic — guarded conditional workflow transitions merged

Workflow transitions accept up to ten bounded, typed predicates over
ordinary record fields. The SQL compiler checks them after record and role
authorization while the source record is locked, before related-row effects or
state changes. PR #216 passed Release Gate run `38585320340` and Vercel Preview,
then merged to `main` as `630591c59c37a6dfd9d97efc6316b91564e86a14`.
Post-merge Release Gate run `38592549651` passed all checks except a timeout in
`application-reference-page-browser-regression.mjs`; the browser made no HTTPS
requests and the PR gate passed the same tree. Only the failed workflow job
was restarted as run attempt 2 and passed. This completes the post-merge gate.
Supabase Preview remains skipped because preview branches are disabled.

## Business logic — all/any predicate groups merged

An additive `conditionMode` supports AND (default) and OR matching for bounded
workflow predicates. The workflow regression, TypeScript, focused ESLint, all
affected generated-bundle consistency checks and whitespace validation pass
locally. The trusted BYO Publish generator regenerated its transitive
application-validation dependency; the bundle check and deployment-entry
regression pass. PR #217 merged to `main` as
`6612bb8dbbe572d23568b988acd8b079dcfa39a3`. Gate run `38594651303` had checked
stale merge ref `ac8312f` and failed the old bundle; the new PR gate
`38595436276` passed on the refreshed head and main gate `38595967134` passed.

## Custom code — application actor authorization merged

PR #218 merged to `main` as `75c78de6208cf40678920bded0262bd4a2188bc0` after
Release Gate `38597169913`, Vercel Preview and main Release Gate `38597630171`
passed. Its fail-closed adapter verifies the end-user access token against the
bound customer Supabase Auth project, rejects anonymous users, and checks
role-bound actors through the existing `app_my_roles` RPC. It validates the
trusted project ref, uses only the public key and user's bearer token, applies
bounded responses/timeouts, and ignores user-editable metadata.

## Custom code — bearer token route contract merged

PR #219 merged to `main` as `ca7d2e01a4a8b37b86d81b48d71aca1173f21560` after
Release Gate `38598293618`, Vercel Preview, and main Release Gate
`38598681838` passed. The HTTP operation contract now requires a bounded JWT
Bearer token and passes it only to the authorization callback. Missing or
malformed credentials fail before execution; the token is excluded from release
loading and quota callbacks.

The generated customer runtime still does not mount this route and custom
execution remains disabled. The active composition checkpoint adapts the route
callback directly to customer Auth/RLS verification and tests the complete
HTTP-token-to-Auth/RPC path with synthetic responses. Focused route and runner
regressions, strict TypeScript, scoped ESLint and whitespace checks pass locally.
Remaining activation work requires immutable runtime identity, platform quota
custody and sandbox credentials to be integrated without exposing Tayar secrets
to customer code. Production remains unpromoted.
