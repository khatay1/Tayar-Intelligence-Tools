# Universal API integration foundation

The capability view in `universal-api-registry.ts` reuses existing Tayar schema
features and `EDITOR_INTEGRATION_PROVIDERS`; it does not install another provider
runtime. The actual AI generation request receives its credential-free capability
context. Native booking, records, transactions, inventory, workflows and reports
are preferred over external services. Project-specific schema, authorization and
acceptance tests still apply; a listed native primitive does not prove a generated
project works.

`planUniversalIntegrations` accepts explicit candidate capability IDs after
requirements analysis and returns internal reuse, an existing adapter preparation,
or unsupported. Every decision keeps activation deferred. Model inference is not
an authorization or readiness check. `prepareUniversalIntegrationDraft` produces a
disabled, disconnected existing-adapter configuration with required fields and
validation issues; private field values are rejected. The existing project secret
workflow, signed webhook runtime, email worker and Stripe checkout remain the
execution owners. No third-party source is generated or executed.

External entries expose source, authentication, protocol, usage-limit review
links, required secret fields, alternatives and evidence level. Account pricing,
terms, scopes, provider consent and reliability are deliberately not certified.
No connected-service or live-test claims are made. The current reviewed adapter
surface does not implement arbitrary OAuth/MCP integrations or external maps,
shipping, healthcare, education and real-estate APIs; those requests must stay
unsupported until their official adapter and policies are implemented. Existing
SSRF/secret/retry policies must not be bypassed by a directory selection.

## API Mega List review

`API_MEGA_LIST_REVIEW.json` records a SHA-256 of the README reviewed on 2026-10-18,
with reproducible deduplication statistics. The GitHub README metadata returned
blob `ab442f35438b2fa3af6dd9f7afa9c4edc16dc6f3`; the bulk content was read from the
repository's raw README. The directory includes many commercial scraping listings
and affiliate links; these are not official APIs for the named target websites.
The repository LICENSE lookup returned 404, so no upstream code or wholesale
catalog text is copied into Tayar and no license is inferred.

`reviewAPIMegaList` is an offline, bounded Markdown-table review parser. It rejects
unsafe endpoints, removes referral/tracking parameters before URL deduplication,
merges categories, excludes sponsorship sections/placements, and marks every
candidate quarantined/non-executable. It never registers services or contacts
candidate URLs. Review a downloaded README without runtime imports:

```sh
node scripts/review-api-mega-list.mjs /path/to/README.md /path/to/review.json
```

The five category headings found in this README snapshot and the unique count in
the audit are parser observations, not endorsements or the directory author's
advertised service count. `awesome-selfhosted` remains a discovery source under
the existing reuse policy; a directory mention never supplies an executable
adapter, code license, medical/privacy compliance or permission to send data.

## Validation and remaining activation work

The focused regression tests internal-first selection, environment isolation,
secret-free AI context, disabled native drafts, source references, unsupported
capabilities, sponsored exclusion, referral removal and URL deduplication. The
actual AI generation regression also checks the new request context. The focused
smoke is included in `smoke:website-builder:integrations`, used by Release Gate.
No external accounts, charges, live provider traffic, production migrations or
activation were performed. Arbitrary API adapter generation, durable approval/
cost enforcement across new providers, and real-provider acceptance remain future
work; this foundation must not be presented as those completed features.
