# Website Builder Pro review — 2026-09-19

Baseline: `bf33d578f77169fb097f1ed8055c8ff1a6e49d72` (remote main).
This is a code review, not proof of complete production capability or competitor parity.

| Area | Existing implementation | Next complete delivery batch |
| --- | --- | --- |
| Visual Editor Pro | Free positioning, zoom/pan, multi-selection, alignment/distribution, responsive overrides, history, reusable components, real-browser regression | Precision and no-op safety (this batch); then instance-local component geometry and nested-layout behavior with browser coverage |
| AI Quality + Design Systems | Native transactions, validation, patch review, themes, linked components, responsive/accessibility repair | Native repair no-op safety (this batch); then unify legacy/native repair semantics, reusable design tokens and consistent manual/AI application |
| CMS / Dynamic Content | Static page/section/element model; no collection schema or data-binding model found in the builder | Collections, typed fields, entry editor, binding, dynamic routes, preview/publish parity, persistence and access control as one end-to-end feature |
| Localization + Domains + Staging | Page languages/translation groups, canonical URLs, translated output, unlisted previews, release archives and rollback | Verified domain provisioning and HTTPS state, explicit staging-to-live promotion, linked locale route coverage; a production URL field is not domain provisioning |
| Collaboration Pro | Separate Team Workspace tool with invitations/roles and project access RPC integration | In-editor presence/comments and safe concurrent editing with permissions, reconnect handling and multi-session tests; team access alone is not simultaneous editing |

## Delivered in this batch

- Extracted DOM-independent arrangement calculation used by the actual editor.
- Alignment retains zoom-aware coordinates and position limits, rejects invalid or duplicate measurements, and skips no-op history writes.
- Arrangement settles active transform transitions before measuring, preventing rapid repeated alignment from recording intermediate animation positions.
- Equal-gap distribution preserves its first and last anchors, including overlapping items with unequal sizes.
- Native responsive repair changes only missing overrides, preserves explicit settings and empty records, and does not resynchronize untouched linked components.
- Native site restyling synchronizes linked components only when their styles change, protecting unrelated image content.
- Added 16 behavioral regression scenarios to `health:project`, including undo/redo and atomic failure.
- Extended the real-builder browser suite from 9 to 11 scenarios with alignment and no-op Undo coverage.

## Validation and boundaries

Local lint, project health, production build, coding-assistance smoke and production dependency audit passed before the browser-suite extension. Final Release Gate must pass on the release commit before main advances. The build retains the existing large-chunk warning.

No CMS, live co-editing, domain provisioning, database migration or production infrastructure change is introduced by this batch. Native design command improvements do not replace the separate legacy AI repair fallback. These remaining capabilities require complete follow-up batches; they are not reported as shipped.
