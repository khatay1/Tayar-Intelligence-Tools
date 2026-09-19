# Website Builder Pro review — 2026-09-19

Baseline: `f9013e9258ab8f53cb5941718312b6bb8d9a20f1` (remote main).
This is a code review, not proof of complete production capability or competitor parity.

| Area | Existing implementation | Next complete delivery batch |
| --- | --- | --- |
| Visual Editor Pro | Free positioning, zoom/pan, multi-selection, alignment/distribution, responsive overrides, history, reusable components, real-browser regression | Precision and no-op safety (this batch); then instance-local component geometry and nested-layout behavior with browser coverage |
| AI Quality + Design Systems | Native transactions, validation, patch review, themes, linked components, responsive/accessibility repair | Native repair no-op safety (this batch); then unify legacy/native repair semantics, reusable design tokens and consistent manual/AI application |
| CMS / Dynamic Content | Project-scoped collections, typed fields, drafts, entry editing, element bindings, dynamic page expansion, publish validation and preview/export/publish parity | Reference fields, collection import/export and server-side high-volume querying |
| Localization + Domains + Staging | Page languages/translation groups, canonical URLs, translated output, unlisted previews, release archives and rollback | Verified domain provisioning and HTTPS state, explicit staging-to-live promotion, linked locale route coverage; a production URL field is not domain provisioning |
| Collaboration Pro | Separate Team Workspace tool with invitations/roles and project access RPC integration | In-editor presence/comments and safe concurrent editing with permissions, reconnect handling and multi-session tests; team access alone is not simultaneous editing |

## Delivered in this batch

- Extracted DOM-independent arrangement calculation used by the actual editor.
- Undo snapshots preserve the exact pre-mutation active sections; arrangement snapshots additionally use the committed canvas coordinates that the user saw before the command.
- Alignment retains zoom-aware coordinates and position limits, rejects invalid or duplicate measurements, and skips no-op history writes.
- Arrangement settles active transform transitions before measuring, and reads committed document offsets from the canvas, preventing rapid repeated alignment from recording intermediate animation or stale state positions; immediate duplicate arrangement commands are ignored until the commit finishes.
- Equal-gap distribution preserves its first and last anchors, including overlapping items with unequal sizes.
- Native responsive repair changes only missing overrides, preserves explicit settings and empty records, and does not resynchronize untouched linked components.
- Native site restyling synchronizes linked components only when their styles change, protecting unrelated image content.
- Added 16 behavioral regression scenarios to `health:project`, including undo/redo and atomic failure.
- Extended the real-builder browser suite from 9 to 11 scenarios with alignment and no-op Undo coverage.

## Validation and boundaries

Local lint, project health, production build, coding-assistance smoke and production dependency audit passed before the browser-suite extension. Final Release Gate must pass on the release commit before main advances. The build retains the existing large-chunk warning.

Native design command improvements do not replace the separate legacy AI repair fallback. Live co-editing, domain provisioning and production infrastructure remain separate follow-up batches; they are not reported as shipped.

## CMS / Dynamic Content batch

- Added bounded project-scoped collections with text, rich text, number, boolean, date, image and URL fields.
- Added draft-aware entry editing, collection/field/entry deletion and validation for required values, duplicate slugs and dangling bindings.
- Elements can bind content, image/video source or button links to fixed entries or a dynamic page context.
- A page can act as a collection template; non-draft entries become concrete static pages with unique IDs and slugs.
- The same expanded page set is used by share previews, production ZIP, client handoff, sitemap and live publish.
- CMS data is included in project snapshots, autosave fingerprints, manual history and recovery, inheriting the existing project access/RLS boundary without a new public table or service-role path.
- Added nine pure behavioral regressions and a twelfth real-browser scenario for collection and entry editing.
