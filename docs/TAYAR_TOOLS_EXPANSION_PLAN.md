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
- PDF Toolkit: pending library/security review before adding a PDF dependency.

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
