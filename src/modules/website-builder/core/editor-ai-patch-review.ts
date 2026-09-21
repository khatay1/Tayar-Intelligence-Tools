import type { Device, ElementAnimation, ElementShadow, SectionBackgroundMode, SectionBackgroundPosition, SectionBackgroundSize, SectionContentWidth, SectionLayout, SectionLayoutAlign, SectionType, WebsiteBrand, WebsiteElementType, WebsiteFormFieldType, WebsiteSEO, WebsiteSection } from './types';

export interface AIWebsitePageGeneration {
  name?: string;
  slug?: string;
  showInNavigation?: boolean;
  sections: Array<Partial<WebsiteSection> & Pick<WebsiteSection, 'type'>>;
}

export interface AIWebsiteGeneration {
  siteName?: string;
  summary?: string;
  style?: {
    tone?: string;
    primaryColor?: string;
    accentColor?: string;
  };
  brand?: WebsiteBrand;
  seo?: WebsiteSEO;
  pages?: AIWebsitePageGeneration[];
  sections?: AIWebsitePageGeneration['sections'];
}

export interface AIWebsitePatchChanges {
  title?: string;
  description?: string;
  buttonText?: string;
  buttonUrl?: string;
  background?: string;
  accent?: string;
  image?: string;
  imagePrompt?: string;
  name?: string;
  slug?: string;
  showInNavigation?: boolean;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  seoKeywords?: string[];
  headerEnabled?: boolean;
  showCta?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryColor?: string;
  textColor?: string;
  mutedTextColor?: string;
  fontFamily?: string;
  themeContentWidth?: number;
  themeButtonRadius?: number;
  themeSectionSpacing?: number;
  headerSticky?: boolean;
  headerMobileMenu?: boolean;
  headerLanguageSwitcher?: boolean;
  headerBrandText?: string;
  headerLogoUrl?: string;
  headerBackgroundColor?: string;
  headerTextColor?: string;
  headerActiveColor?: string;
  headerHoverColor?: string;
  headerCtaBackgroundColor?: string;
  headerCtaTextColor?: string;
  headerNavGap?: number;
  headerBrandSize?: number;
  headerNavSize?: number;
  headerBorderColor?: string;
  sectionMinHeight?: number;
  sectionPaddingY?: number;
  sectionPaddingX?: number;
  sectionLayoutGap?: number;
  sectionLayout?: SectionLayout;
  sectionLayoutAlign?: SectionLayoutAlign;
  sectionContentWidth?: SectionContentWidth;
  sectionBackgroundMode?: SectionBackgroundMode;
  sectionBackgroundImage?: string;
  sectionBackgroundPosition?: SectionBackgroundPosition;
  sectionBackgroundSize?: SectionBackgroundSize;
  sectionGradientFrom?: string;
  sectionGradientTo?: string;
  sectionGradientAngle?: number;
  sectionOverlayColor?: string;
  sectionOverlayOpacity?: number;
  sectionRadius?: number;
  sectionAnchorId?: string;
  elementColumn?: number;
  elementColumnSpan?: number;
  elementContent?: string;
  elementHref?: string;
  elementSrc?: string;
  color?: string;
  elementBackgroundColor?: string;
  fontSize?: number;
  fontWeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  padding?: number;
  borderRadius?: number;
  width?: number;
  maxWidth?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  positionX?: number;
  positionY?: number;
  hidden?: boolean;
  alignSelf?: 'auto' | 'start' | 'center' | 'end' | 'stretch';
  lineHeight?: number;
  letterSpacing?: number;
  opacity?: number;
  rotate?: number;
  elementBorderWidth?: number;
  elementBorderColor?: string;
  elementBorderStyle?: 'solid' | 'dashed' | 'dotted';
  elementShadow?: ElementShadow;
  elementHoverScale?: number;
  elementHoverOpacity?: number;
  elementHoverBackgroundColor?: string;
  elementHoverColor?: string;
  elementHoverShadow?: ElementShadow;
  elementAnimation?: ElementAnimation;
  elementAnimationDuration?: number;
  elementAnimationDelay?: number;
  elementAnimationDistance?: number;
  elementAnimationEasing?: 'smooth' | 'ease' | 'linear' | 'spring';
  elementAnimationIterations?: number;
  elementParallaxSpeed?: number;
  elementAnimationTrigger?: 'scroll' | 'load' | 'hover' | 'click';
  elementAnimationOnce?: boolean;
  containerName?: string;
  containerLayout?: 'stack' | 'row';
  containerGap?: number;
  containerAlign?: 'start' | 'center' | 'end' | 'stretch';
  containerBackgroundColor?: string;
  containerPadding?: number;
  containerBorderRadius?: number;
  containerBorderWidth?: number;
  containerBorderColor?: string;
  containerShadow?: ElementShadow;
  containerColumn?: number;
  containerColumnSpan?: number;
  formSuccessMessage?: string;
  formSuccessAction?: 'message' | 'redirect';
  formRedirectUrl?: string;
  formFieldName?: string;
  formFieldLabel?: string;
  formFieldPlaceholder?: string;
  formFieldRequired?: boolean;
  formFieldOptions?: string[];
}

export interface AIWebsitePatchOperation {
  action: 'add_page' | 'duplicate_page' | 'remove_page' | 'set_home_page' | 'move_page' | 'update_section' | 'add_section' | 'duplicate_section' | 'remove_section' | 'move_section' | 'add_container' | 'update_container' | 'remove_container' | 'assign_element_container' | 'create_symbol' | 'insert_symbol' | 'detach_symbol' | 'add_element' | 'duplicate_element' | 'remove_element' | 'move_element' | 'update_element' | 'update_form' | 'add_form_field' | 'update_form_field' | 'remove_form_field' | 'move_form_field' | 'copy_section_style' | 'copy_element_style' | 'repair_responsive' | 'repair_accessibility' | 'update_page' | 'update_theme' | 'restyle_site' | 'update_site' | 'update_seo' | 'update_header' | 'generate_image';
  pageId?: string;
  pageSlug?: string;
  sectionId?: string;
  sectionType?: SectionType;
  elementId?: string;
  elementType?: WebsiteElementType;
  device?: Device;
  beforeElementId?: string;
  afterElementId?: string;
  containerId?: string;
  formFieldId?: string;
  formFieldType?: WebsiteFormFieldType;
  beforeFormFieldId?: string;
  afterFormFieldId?: string;
  symbolId?: string;
  symbolName?: string;
  sourceSectionId?: string;
  sourceElementId?: string;
  beforePageId?: string;
  afterPageId?: string;
  beforeSectionId?: string;
  afterSectionId?: string;
  prompt?: string;
  placement?: 'section_background' | 'section_image' | 'image_element';
  page?: AIWebsitePageGeneration;
  changes?: AIWebsitePatchChanges;
  section?: Partial<WebsiteSection> & Pick<WebsiteSection, 'type'>;
}

export interface AIQualityReview {
  score: number;
  summary: string;
  findings: Array<{
    severity: 'critical' | 'warning' | 'improvement';
    title: string;
    detail: string;
  }>;
  fixPrompt: string;
}

export interface AIWebsiteAgentPlanStep {
  id: string;
  title: string;
  target?: string;
  reason?: string;
  destructive?: boolean;
}

export interface AIWebsiteAgentPlan {
  summary?: string;
  steps?: AIWebsiteAgentPlanStep[];
  warnings?: string[];
}

export interface AIWebsitePlanReview {
  summary: string;
  steps: AIWebsiteAgentPlanStep[];
  warnings: string[];
}

export interface AIWebsitePatchReviewItem {
  id: string;
  action?: AIWebsitePatchOperation['action'];
  label: string;
  target: string;
  fields: string[];
  kind: AIWebsitePatchReviewKind;
  pageId?: string;
  pageSlug?: string;
  sectionId?: string;
  elementId?: string;
  containerId?: string;
}

export type AIWebsitePatchReviewKind = 'add' | 'update' | 'remove';

export interface AIWebsiteCanvasPreview {
  global: boolean;
  sectionKinds: Record<string, AIWebsitePatchReviewKind>;
  elementKinds: Record<string, AIWebsitePatchReviewKind>;
  containerKinds: Record<string, AIWebsitePatchReviewKind>;
}

export interface AIWebsitePatchReview {
  summary: string;
  operations: AIWebsitePatchReviewItem[];
  selectedOperationIds: string[];
  warnings: string[];
  confidence: number | null;
  destructiveCount: number;
}

export function humanizeAIWebsitePatchAction(action: AIWebsitePatchOperation['action']): string {
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function aiWebsitePatchReviewKind(action: string): AIWebsitePatchReviewKind {
  if (action.startsWith('remove_')) return 'remove';
  if (action.startsWith('add_') || action.startsWith('duplicate_') || action.startsWith('create_') || action.startsWith('insert_')) return 'add';
  return 'update';
}

export function mergeAIWebsitePatchReviewKind(
  current: AIWebsitePatchReviewKind | undefined,
  next: AIWebsitePatchReviewKind,
): AIWebsitePatchReviewKind {
  if (current === 'remove' || next === 'remove') return 'remove';
  if (current === 'add' || next === 'add') return 'add';
  return 'update';
}

export function aiWebsitePatchPreviewClass(kind?: AIWebsitePatchReviewKind): string {
  if (kind === 'remove') return 'ring-2 ring-red-400 ring-inset shadow-[inset_0_0_0_1px_rgba(248,113,113,0.35),0_0_24px_rgba(248,113,113,0.20)]';
  if (kind === 'add') return 'ring-2 ring-emerald-400 ring-inset shadow-[inset_0_0_0_1px_rgba(52,211,153,0.35),0_0_24px_rgba(52,211,153,0.20)]';
  if (kind === 'update') return 'ring-2 ring-violet-400 ring-inset shadow-[inset_0_0_0_1px_rgba(167,139,250,0.35),0_0_24px_rgba(167,139,250,0.20)]';
  return '';
}

export function describeAIWebsitePatchTarget(operation: AIWebsitePatchOperation): string {
  const page = operation.pageSlug || operation.pageId;
  const section = operation.sectionId || operation.sectionType;
  const element = operation.elementId || operation.elementType;
  const target = element
    ? `${page ? `${page} / ` : ''}${section ? `${section} / ` : ''}${element}`
    : section
      ? `${page ? `${page} / ` : ''}${section}`
      : operation.containerId || operation.formFieldId || operation.symbolId || page || 'Site-wide';
  return String(target).slice(0, 180);
}

export function describeAIWebsitePatchFields(operation: AIWebsitePatchOperation): string[] {
  const fields = operation.changes && typeof operation.changes === 'object'
    ? Object.keys(operation.changes)
    : operation.page
      ? ['page']
      : operation.section
        ? ['section']
        : operation.prompt
          ? ['prompt']
          : [];
  return fields.slice(0, 8);
}
