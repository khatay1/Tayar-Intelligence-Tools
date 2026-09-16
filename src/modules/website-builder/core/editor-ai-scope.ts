import type { WebsiteSection } from './types';
import { normalizeSlug } from './project-identifiers';
import type { AIWebsitePatchOperation } from './editor-ai-patch-review';

export interface AIEditScopePage {
  id: string;
  slug: string;
  sections: WebsiteSection[];
}

export interface AIEditScopeTarget {
  kind: AIEditScope;
  pageId: string;
  sectionId: string | null;
  elementId: string | null;
}

export function aiOperationMatchesEditScope(
  operation: AIWebsitePatchOperation,
  scope: AIEditScopeTarget,
  pages: AIEditScopePage[],
): boolean {
  if (scope.kind === 'site') return true;

  const pageForSection = (sectionId?: string) => sectionId
    ? pages.find((page) => page.sections.some((section) => section.id === sectionId))
    : undefined;
  const sectionForNestedTarget = () => {
    for (const page of pages) {
      const section = page.sections.find((candidate) =>
        candidate.elements.some((element) => element.id === operation.elementId) ||
        (candidate.containers || []).some((container) => container.id === operation.containerId) ||
        (candidate.formFields || []).some((field) => field.id === operation.formFieldId));
      if (section) return { page, section };
    }
    return undefined;
  };
  const explicitPage = operation.pageId
    ? pages.find((page) => page.id === operation.pageId)
    : operation.pageSlug
      ? pages.find((page) => normalizeSlug(page.slug) === normalizeSlug(operation.pageSlug || ''))
      : undefined;
  const sectionPage = pageForSection(operation.sectionId);
  const nestedTarget = sectionForNestedTarget();
  const targetPage = explicitPage || sectionPage || nestedTarget?.page;

  if (scope.kind === 'page') {
    const siteWideActions = new Set<AIWebsitePatchOperation['action']>([
      'add_page', 'duplicate_page', 'remove_page', 'set_home_page', 'move_page',
      'update_theme', 'restyle_site', 'update_site', 'update_seo', 'update_header', 'create_symbol',
    ]);
    return !siteWideActions.has(operation.action) && targetPage?.id === scope.pageId;
  }

  const targetSectionId = operation.sectionId || nestedTarget?.section.id;
  if (scope.kind === 'section') {
    const sectionGrowthActions = new Set<AIWebsitePatchOperation['action']>([
      'add_section', 'duplicate_section', 'move_section', 'add_page', 'duplicate_page',
    ]);
    return !sectionGrowthActions.has(operation.action) && Boolean(scope.sectionId && targetSectionId === scope.sectionId);
  }

  const elementOnlyActions = new Set<AIWebsitePatchOperation['action']>([
    'update_element', 'remove_element', 'move_element', 'assign_element_container',
    'detach_symbol', 'copy_element_style', 'repair_responsive', 'repair_accessibility', 'generate_image',
  ]);
  return elementOnlyActions.has(operation.action) && Boolean(scope.elementId && operation.elementId === scope.elementId);
}

export interface AIWebsiteAgentReviewFinding {
  severity: 'critical' | 'warning' | 'improvement';
  title: string;
  detail: string;
  target?: string;
}

export interface AIWebsiteAgentReview {
  score?: number;
  summary?: string;
  findings?: AIWebsiteAgentReviewFinding[];
  followUpPrompt?: string;
}

export interface AIWebsitePatch {
  summary?: string;
  warnings?: string[];
  confidence?: number;
  operations?: AIWebsitePatchOperation[];
}

export type AIBuilderStage = 'idle' | 'planning' | 'building' | 'styling' | 'ready' | 'error';
export type AIEditScope = 'site' | 'page' | 'section' | 'element';

export interface AIBuilderMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function buildAIConversationContext(messages: AIBuilderMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages
    .filter((message) => message.id !== 'ai-welcome' && message.content.trim())
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 900),
    }));
}

export const AI_BUILDER_STAGE_ORDER: Array<Exclude<AIBuilderStage, 'idle' | 'error'>> = ['planning', 'building', 'styling', 'ready'];
