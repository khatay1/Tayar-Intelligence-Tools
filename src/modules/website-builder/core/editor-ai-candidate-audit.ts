import { normalizeSlug } from './project-identifiers';
import type { AIWebsitePatchChanges } from './editor-ai-patch-review';
import type { AIWebsiteAgentReviewFinding } from './editor-ai-scope';
import type { WebsiteSEO, WebsiteSection } from './types';
import type { WebsiteHeaderConfig, WebsitePage, WebsiteSymbol } from './website-builder-model';

const validHex = (value?: string) => /^#[0-9a-fA-F]{6}$/.test(value || '');

export const updateSectionContent = (section: WebsiteSection, changes: AIWebsitePatchChanges): WebsiteSection => {
  const next: WebsiteSection = {
    ...section,
    title: typeof changes.title === 'string' ? changes.title.trim() : section.title,
    description: typeof changes.description === 'string' ? changes.description.trim() : section.description,
    buttonText: typeof changes.buttonText === 'string' ? changes.buttonText.trim() : section.buttonText,
    buttonUrl: typeof changes.buttonUrl === 'string' ? changes.buttonUrl.trim() : section.buttonUrl,
    background: validHex(changes.background) ? changes.background! : section.background,
    accent: validHex(changes.accent) ? changes.accent! : section.accent,
    image: typeof changes.image === 'string' ? changes.image.trim() || undefined : section.image,
    imagePrompt: typeof changes.imagePrompt === 'string' ? changes.imagePrompt.trim() || undefined : section.imagePrompt,
  };

  return {
    ...next,
    elements: section.elements.map((element) => {
      if (changes.title !== undefined && element.type === 'heading') {
        return { ...element, content: next.title };
      }
      if (changes.description !== undefined && element.type === 'text') {
        return { ...element, content: next.description };
      }
      if (element.type === 'button') {
        return {
          ...element,
          content: changes.buttonText !== undefined ? next.buttonText : element.content,
          href: changes.buttonUrl !== undefined ? next.buttonUrl : element.href,
          style: changes.accent !== undefined
            ? { ...element.style, backgroundColor: next.accent }
            : element.style,
        };
      }
      return element;
    }),
  };
};

export const validateAIProjectIntegrity = (candidatePages: WebsitePage[], expectedHomePageId: string, candidateSymbols: WebsiteSymbol[]): string[] => {
  const errors: string[] = [];
  if (!candidatePages.length) return ['The project must keep at least one page.'];
  const pageIds = new Set<string>();
  const sectionIds = new Set<string>();
  const elementIds = new Set<string>();

  for (const page of candidatePages) {
    if (!page.id || pageIds.has(page.id)) errors.push(`Duplicate or missing page id: ${page.id || 'unknown'}.`);
    pageIds.add(page.id);
    if (!Array.isArray(page.sections) || page.sections.length === 0) {
      errors.push(`${page.name || page.id}: page must contain at least one section.`);
      continue;
    }

    for (const section of page.sections) {
      if (!section.id || sectionIds.has(section.id)) errors.push(`Duplicate or missing section id: ${section.id || 'unknown'}.`);
      sectionIds.add(section.id);
      if (!Array.isArray(section.elements) || section.elements.length === 0) {
        errors.push(`${page.name}: section ${section.id || section.type} must keep at least one editable element.`);
        continue;
      }

      const containerIds = new Set<string>();
      for (const container of section.containers || []) {
        if (!container.id || containerIds.has(container.id)) errors.push(`${page.name}: duplicate or missing container id in ${section.id}.`);
        containerIds.add(container.id);
      }

      for (const element of section.elements) {
        if (!element.id || elementIds.has(element.id)) errors.push(`Duplicate or missing element id: ${element.id || 'unknown'}.`);
        elementIds.add(element.id);
        if (element.containerId && !containerIds.has(element.containerId)) {
          errors.push(`${page.name}: element ${element.id} points to missing container ${element.containerId}.`);
        }
      }
    }
  }

  if (!candidatePages.some((page) => page.id === expectedHomePageId)) errors.push('The selected home page no longer exists.');

  const symbolIds = new Set<string>();
  for (const symbol of candidateSymbols) {
    if (!symbol.id || symbolIds.has(symbol.id)) errors.push(`Duplicate or missing reusable component id: ${symbol.id || 'unknown'}.`);
    symbolIds.add(symbol.id);
  }
  for (const page of candidatePages) {
    for (const section of page.sections) {
      for (const element of section.elements) {
        if (element.symbolId && !symbolIds.has(element.symbolId)) errors.push(`${page.name}: element ${element.id} points to missing reusable component ${element.symbolId}.`);
      }
    }
  }
  return [...new Set(errors)].slice(0, 20);
};

export const auditAIWebsiteCandidate = (
  candidatePages: WebsitePage[],
  candidateSeo: WebsiteSEO,
  candidateHeader: WebsiteHeaderConfig,
): { score: number; findings: AIWebsiteAgentReviewFinding[]; fixPrompt?: string } => {
  const findings: AIWebsiteAgentReviewFinding[] = [];
  const pageSlugs = new Set(candidatePages.map((page) => normalizeSlug(page.slug)));
  const addFinding = (finding: AIWebsiteAgentReviewFinding) => {
    const duplicate = findings.some((current) =>
      current.title === finding.title && current.target === finding.target);
    if (!duplicate && findings.length < 12) findings.push(finding);
  };

  candidatePages.forEach((page) => {
    const pageTarget = page.id;
    const hasHeading = page.sections.some((section) => section.elements.some((element) =>
      element.type === 'heading' && element.content.trim()));
    if (!hasHeading) {
      addFinding({
        severity: 'warning',
        title: 'Page has no clear heading',
        detail: `${page.name} needs an editable heading to establish content hierarchy.`,
        target: pageTarget,
      });
    }
    if (!(page.seoDescription?.trim() || candidateSeo.description.trim())) {
      addFinding({
        severity: 'warning',
        title: 'SEO description is missing',
        detail: `${page.name} has no page or global meta description.`,
        target: pageTarget,
      });
    }

    page.sections.forEach((section) => {
      section.elements.forEach((element) => {
        const target = element.id;
        if (element.type === 'image' && !element.src?.trim()) {
          addFinding({
            severity: 'warning',
            title: 'Image source is missing',
            detail: `${page.name} contains an image element without usable media.`,
            target,
          });
        } else if (element.type === 'image' && !element.content.trim()) {
          addFinding({
            severity: 'warning',
            title: 'Image alt text is missing',
            detail: `${page.name} contains an image without an accessible description.`,
            target,
          });
        }
        if (element.type === 'button' && !element.content.trim()) {
          addFinding({
            severity: 'warning',
            title: 'Button label is missing',
            detail: `${page.name} contains a call to action without a readable label.`,
            target,
          });
        }
        if (element.type === 'button' && element.href?.startsWith('page:')) {
          const destination = normalizeSlug(element.href.slice(5));
          if (!pageSlugs.has(destination)) {
            addFinding({
              severity: 'critical',
              title: 'Button links to a missing page',
              detail: `${page.name} links to page:${destination}, but that page does not exist.`,
              target,
            });
          }
        }
        const desktopX = Math.abs(Number(element.style.positionX) || 0);
        const desktopY = Math.abs(Number(element.style.positionY) || 0);
        const mobileOverride = element.responsive?.mobile;
        if ((desktopX > 320 || desktopY > 320) &&
          mobileOverride?.positionX === undefined && mobileOverride?.positionY === undefined) {
          addFinding({
            severity: 'warning',
            title: 'Large position offset lacks a mobile override',
            detail: `${page.name} contains a freely positioned element that may leave the mobile viewport.`,
            target,
          });
        }
      });
    });
  });

  if (candidateHeader.enabled && candidateHeader.showCta && !candidateHeader.ctaLabel.trim()) {
    addFinding({
      severity: 'warning',
      title: 'Header CTA label is missing',
      detail: 'The header call to action is enabled without a readable label.',
      target: 'header',
    });
  }
  if (candidateHeader.enabled && candidateHeader.showCta && !candidateHeader.ctaHref.trim()) {
    addFinding({
      severity: 'warning',
      title: 'Header CTA destination is missing',
      detail: 'The header call to action is enabled but does not lead anywhere.',
      target: 'header',
    });
  }
  if (!candidateSeo.title.trim()) {
    addFinding({
      severity: 'critical',
      title: 'Global SEO title is missing',
      detail: 'The website needs a global title before it is ready to publish.',
      target: 'seo',
    });
  }

  const criticalCount = findings.filter((finding) => finding.severity === 'critical').length;
  const warningCount = findings.filter((finding) => finding.severity === 'warning').length;
  const score = Math.max(0, 100 - (criticalCount * 25) - (warningCount * 6));
  const visibleFindings = findings.slice(0, 6);
  const fixPrompt = visibleFindings.length
    ? `Fix these verified issues with targeted native edits while preserving unrelated work: ${visibleFindings.map((finding) => `${finding.title} (${finding.target || 'site'})`).join('; ')}.`.slice(0, 500)
    : undefined;
  return { score, findings: visibleFindings, fixPrompt };
};
