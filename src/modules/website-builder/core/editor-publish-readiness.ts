import type { EditorProjectLike } from './editor-model';
import { validateEditorProject } from './editor-validation';

export type EditorReadinessSeverity = 'blocker' | 'warning';

export interface EditorReadinessIssue {
  code: string;
  severity: EditorReadinessSeverity;
  message: string;
  pageId?: string;
  sectionId?: string;
  elementId?: string;
}

export interface EditorPublishReadiness {
  canPublish: boolean;
  score: number;
  blockers: EditorReadinessIssue[];
  warnings: EditorReadinessIssue[];
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function addIssue(
  bucket: EditorReadinessIssue[],
  issue: EditorReadinessIssue,
) {
  if (!bucket.some((candidate) => candidate.code === issue.code && candidate.pageId === issue.pageId && candidate.sectionId === issue.sectionId && candidate.elementId === issue.elementId)) {
    bucket.push(issue);
  }
}

export function checkEditorPublishReadiness<P extends EditorProjectLike>(
  project: P,
): EditorPublishReadiness {
  const blockers: EditorReadinessIssue[] = [];
  const warnings: EditorReadinessIssue[] = [];
  const validation = validateEditorProject(project);

  for (const error of validation.errors || []) {
    addIssue(blockers, { code: 'STRUCTURE_INVALID', severity: 'blocker', message: error });
  }
  for (const warning of validation.warnings || []) {
    addIssue(warnings, { code: 'STRUCTURE_WARNING', severity: 'warning', message: warning });
  }

  const seenSlugs = new Set<string>();
  for (const page of project.pages) {
    const pageName = text(page.name);
    const slug = text(page.slug);
    if (!pageName) {
      addIssue(warnings, {
        code: 'PAGE_NAME_MISSING',
        severity: 'warning',
        message: 'Page has no display name',
        pageId: page.id,
      });
    }
    if (!slug) {
      addIssue(blockers, {
        code: 'PAGE_SLUG_MISSING',
        severity: 'blocker',
        message: 'Page requires a slug before publishing',
        pageId: page.id,
      });
    } else if (seenSlugs.has(slug)) {
      addIssue(blockers, {
        code: 'PAGE_SLUG_DUPLICATE',
        severity: 'blocker',
        message: `Duplicate page slug: ${slug}`,
        pageId: page.id,
      });
    } else {
      seenSlugs.add(slug);
    }

    for (const section of page.sections) {
      for (const element of section.elements) {
        const type = text(element.type).toLowerCase();
        if (type === 'image') {
          const alt = text(element.alt) || text(element.altText);
          if (!alt) {
            addIssue(warnings, {
              code: 'IMAGE_ALT_MISSING',
              severity: 'warning',
              message: 'Image is missing alternative text',
              pageId: page.id,
              sectionId: section.id,
              elementId: element.id,
            });
          }
        }
        if (type === 'button') {
          const label = text(element.content) || text(element.label) || text(element.text);
          if (!label) {
            addIssue(blockers, {
              code: 'BUTTON_LABEL_MISSING',
              severity: 'blocker',
              message: 'Button requires a visible label',
              pageId: page.id,
              sectionId: section.id,
              elementId: element.id,
            });
          }
        }
      }

      for (const field of section.formFields || []) {
        if (!text(field.label) && !text(field.name)) {
          addIssue(warnings, {
            code: 'FORM_LABEL_MISSING',
            severity: 'warning',
            message: 'Form field should have an accessible label',
            pageId: page.id,
            sectionId: section.id,
          });
        }
      }
    }
  }

  const seoTitle = text(project.seo?.title);
  const seoDescription = text(project.seo?.description);
  if (!seoTitle) {
    addIssue(warnings, {
      code: 'SEO_TITLE_MISSING',
      severity: 'warning',
      message: 'Global SEO title is missing',
    });
  }
  if (!seoDescription) {
    addIssue(warnings, {
      code: 'SEO_DESCRIPTION_MISSING',
      severity: 'warning',
      message: 'Global SEO description is missing',
    });
  }

  const score = Math.max(0, Math.min(100, 100 - blockers.length * 20 - warnings.length * 5));
  return {
    canPublish: blockers.length === 0,
    score,
    blockers: blockers.slice(0, 50),
    warnings: warnings.slice(0, 100),
  };
}
