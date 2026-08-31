# 24Billions Reference Map

This document records public product patterns observed on 24billions.com that are useful as competitive reference for Tayar.

## Rule

Tayar may reproduce generic functionality and workflow ideas, but does not copy proprietary source code, paid files, branded assets, or third-party template bundles whose redistribution license is unclear.

## Public patterns mapped to Tayar

### Template categories

Observed categories include accounting, HR, sales tracking, inventory management, marketing, project management, personal finance, budgeting, balance sheets, profit and loss, leads management, planners, resumes, recommendation letters, invoices and other business documents.

Tayar implementation:
- Templates Hub with original editable starter data.
- Later XLSX/DOCX/PDF generation after dependency and export-engine review.
- AI customization creates new content from user intent rather than reproducing third-party files.

### File-tool UX

Observed patterns include:
- multiple-file upload
- drag/reorder
- combined output vs separate outputs
- browser-local processing messaging
- bulk download / ZIP
- PDF to image
- image to PDF
- background removal
- bank statement extraction

Tayar implementation:
- prefer local processing where practical
- explicit size/page/pixel limits
- no silent upload
- deterministic Blob/Object URL cleanup
- reviewed ZIP creation dependency only

### Career and content utilities

Observed categories include social username ideas, YouTube/vlog channel-name ideas, resume skill examples, self-introduction/interview guidance, prompt collections and recommendation letters.

Tayar implementation direction:
- Name Generator
- Career Coach
- Prompt Library
- Letter Generator
- integrate with existing CV Builder and Writer instead of duplicate AI engines

## Third-party dependency review

### JSZip 3.10.1

Candidate use:
- local "Download All as ZIP" for batch tools.

Decision:
- acceptable candidate under the MIT license option if pinned to the exact version.
- known path traversal advisory affects versions before 3.8.0.
- Tayar should use ZIP creation only unless archive extraction gets a separate security review.

### PDF libraries

Status:
- deferred pending security and maintenance review.
- never vendor unknown or minified PDF code copied from another website.
