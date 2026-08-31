# Tayar Tools Expansion Plan

## Goal

Expand Tayar from a small AI-tool collection into a practical productivity platform with reusable engines, templates, file utilities and AI-assisted workflows.

The benchmark is not to copy another site's code, branding, text or proprietary assets. Tayar should reuse useful product ideas and workflow patterns, then implement them independently with a stronger integrated experience.

## Product rule

Every new tool should aim for:

1. A useful free manual workflow.
2. No external API dependency when the task can run safely in the browser.
3. Saved drafts/history where it materially helps.
4. Clear export or handoff.
5. AI enhancement as an optional layer rather than a requirement.
6. Reusable engines shared across multiple tools instead of one-off implementations.

## Roadmap

### Wave 1 — Quick utilities

- Invoice Generator
- PDF Toolkit foundation
  - merge
  - split
  - rotate
  - image to PDF
  - PDF to image where browser support is reliable
- Image utilities
  - resize
  - compress
  - crop
  - format conversion
- Background removal after the image backend is ready

### Wave 2 — Document and data extraction

- Bank Statement to Excel
- Receipt/invoice data extraction
- OCR document extraction
- CSV cleanup
- Spreadsheet formatter
- PDF/table extraction

The desired Bank Statement flow is:

Upload -> detect transactions -> structured preview -> review/fix -> categorize -> export CSV/XLSX.

### Wave 3 — Templates Hub

Categories:

- Career
- Business
- Finance
- Documents
- Spreadsheets
- Social
- Websites
- Invoices
- Presentations

Each template should support actions such as:

- Use Template
- Edit manually
- Customize with Tayar AI
- Import data
- Save to My Files
- Export

### Wave 4 — Generators

- Business name generator
- Product name generator
- Social username generator
- Email/template generator
- Business document generator
- Prompt library organized by workflow

### Wave 5 — AI upgrade

Add optional Tayar AI actions to mature tools:

- Improve
- Rewrite
- Extract
- Categorize
- Detect errors
- Explain
- Generate from prompt

AI actions should use the same underlying document/tool model used by manual editing so results stay editable.

### Wave 6 — Commercial layer

- Free single-file/manual workflows
- Pro batch processing
- Higher file limits
- Saved history
- Advanced templates
- AI processing quotas
- Team sharing where appropriate

## Architecture direction

Use independent modules under `src/modules/<tool>` and register them in the central Tool Registry.

Do not place these utilities inside Website Builder.

Shared engines should eventually live under areas such as:

- `src/lib/files/`
- `src/lib/pdf/`
- `src/lib/images/`
- `src/lib/spreadsheets/`
- `src/lib/templates/`

## Progress

- Invoice Generator: shipped.
- Image Tools: shipped as a browser-local resize/compress/format converter with bounded file and pixel processing.
- CSV Cleaner: shipped as browser-local CSV cleanup/export with bounded parsing and spreadsheet formula-injection protection.
- Templates Hub: shipped with original Tayar finance, business and productivity starter templates inspired by common workflow categories, not copied files.
- Name Generator: shipped for business, product, brand, YouTube and Instagram names using local original word banks and bounded generation.
- Letter Generator: shipped with original recommendation, authorization, business inquiry, complaint, resignation and thank-you templates, with manual editing and local export.
- Prompt Library: shipped with original searchable Business, Career, Writing and Social prompt templates plus bounded local personalization.
- Batch Image Converter: shipped with local multi-file processing, explicit reorder controls, sequential bounded conversion and dependency-free ZIP creation for Download All.
- Image Cropper: shipped with local crop presets, numeric positioning, preview overlay and safe JPEG/PNG/WebP export.
- Background Remover: implemented as an authenticated server-side fal.ai workflow with explicit external-processing disclosure, bounded data-URI input and isolated Edge Function. Requires Edge Function deployment and FAL_KEY in Supabase secrets to become live.
- PDF Toolkit: deferred after security review found an open ReDoS report in the original pdf-lib parser and a malicious similarly named package; no PDF dependency will be added until the implementation path is acceptable.

## First implementation

Invoice Generator is the first Wave 1 tool because it is useful, requires no paid API, adds no dependency, and can be delivered with:

- company/customer data
- multiple invoice lines
- quantity and unit price
- per-line VAT
- automatic subtotal/VAT/total
- local draft saving
- live preview
- Print / Save PDF
