import type { Language } from '@/context/PreferencesContext';

export type SectionType =
  | 'hero'
  | 'features'
  | 'about'
  | 'services'
  | 'pricing'
  | 'testimonials'
  | 'contact'
  | 'footer';

export type Device = 'desktop' | 'tablet' | 'mobile';
export type WebsiteElementType = 'heading' | 'text' | 'button' | 'image' | 'video' | 'list' | 'divider' | 'spacer' | 'accordion' | 'tabs' | 'gallery' | 'embed' | 'code' | 'countdown' | 'stats' | 'testimonials-slider';
export type SectionLayout = 'stack' | 'two-column' | 'three-column';
export type SectionLayoutAlign = 'start' | 'center' | 'end' | 'stretch';
export type SectionBackgroundMode = 'color' | 'gradient' | 'image';
export type SectionBackgroundPosition = 'center' | 'top' | 'bottom' | 'left' | 'right';
export type SectionBackgroundSize = 'cover' | 'contain' | 'auto';
export type SectionContentWidth = 'boxed' | 'full';
export type ElementBorderStyle = 'solid' | 'dashed' | 'dotted';
export type ElementShadow = 'none' | 'sm' | 'md' | 'lg' | 'xl';
export type ElementAnimation = 'none' | 'fade' | 'fade-up' | 'fade-down' | 'fade-left' | 'fade-right' | 'zoom-in' | 'zoom-out' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'blur-in' | 'flip-in' | 'bounce-in';
export type ElementAnimationTrigger = 'scroll' | 'load' | 'hover' | 'click';
export type ElementAnimationEasing = 'smooth' | 'ease' | 'linear' | 'spring';
export type ElementContainerLayout = 'stack' | 'row' | 'grid';
export type ElementContainerAlign = 'start' | 'center' | 'end' | 'stretch';
export type ElementContainerJustify = 'start' | 'center' | 'end' | 'between';
export type WebsiteFormFieldType = 'text' | 'email' | 'tel' | 'url' | 'number' | 'date' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file';
export type WebsiteFormConditionOperator = 'equals' | 'not-equals' | 'contains' | 'not-empty' | 'empty';

export interface WebsiteFormCondition {
  fieldName: string;
  operator: WebsiteFormConditionOperator;
  value?: string;
}

export interface WebsiteFormValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  accept?: string[];
  maxFileSizeMb?: number;
}

export interface WebsiteFormField {
  id: string;
  name: string;
  label: string;
  type: WebsiteFormFieldType;
  placeholder?: string;
  required: boolean;
  options?: string[];
  helpText?: string;
  validation?: WebsiteFormValidation;
  conditions?: WebsiteFormCondition[];
  width?: 'full' | 'half';
}

export interface WebsiteFormAutomation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: 'submission-created';
  action: 'email' | 'webhook';
  destination: string;
}

export interface ElementStyle {
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontWeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  padding?: number;
  borderRadius?: number;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  height?: number;
  minHeight?: number;
  maxHeight?: number;
  aspectRatio?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  positionX?: number;
  positionY?: number;
  order?: number;
  flexGrow?: number;
  flexShrink?: number;
  hidden?: boolean;
  alignSelf?: 'auto' | 'start' | 'center' | 'end' | 'stretch';
  columnSpan?: number;
  lineHeight?: number;
  letterSpacing?: number;
  opacity?: number;
  rotate?: number;
  borderWidth?: number;
  borderColor?: string;
  borderStyle?: ElementBorderStyle;
  shadow?: ElementShadow;
  hoverScale?: number;
  hoverOpacity?: number;
  hoverBackgroundColor?: string;
  hoverColor?: string;
  hoverShadow?: ElementShadow;
  animation?: ElementAnimation;
  animationDuration?: number;
  animationDelay?: number;
  animationDistance?: number;
  animationEasing?: ElementAnimationEasing;
  animationIterations?: number;
  parallaxSpeed?: number;
}

export interface WebsiteElementContainer {
  id: string;
  name: string;
  layout: ElementContainerLayout;
  gap: number;
  rowGap?: number;
  columns?: number;
  wrap?: boolean;
  align: ElementContainerAlign;
  justify?: ElementContainerJustify;
  backgroundColor: string;
  padding: number;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  shadow: ElementShadow;
  layoutColumn?: number;
  columnSpan?: number;
}

export interface WebsiteElement {
  id: string;
  type: WebsiteElementType;
  content: string;
  href?: string;
  src?: string;
  style: ElementStyle;
  responsive?: Partial<Record<Device, ElementStyle>>;
  layoutColumn?: number;
  animationOnce?: boolean;
  animationTrigger?: ElementAnimationTrigger;
  containerId?: string;
  symbolId?: string;
  cmsBinding?: WebsiteCmsBinding;
}

export interface WebsiteCmsBinding {
  collectionId: string;
  fieldKey: string;
  referenceFieldKey?: string;
  entryId?: string;
  target: 'content' | 'src' | 'href';
}

export interface SectionResponsiveStyle {
  minHeight?: number;
  sectionPaddingY?: number;
  sectionPaddingX?: number;
  layoutGap?: number;
}

export interface WebsiteSection {
  id: string;
  type: SectionType;
  title: string;
  description: string;
  buttonText: string;
  buttonUrl: string;
  background: string;
  accent: string;
  image?: string;
  imagePrompt?: string;
  formFields?: WebsiteFormField[];
  formSuccessMessage?: string;
  formSuccessAction?: 'message' | 'redirect';
  formRedirectUrl?: string;
  formName?: string;
  formSpamProtection?: 'standard' | 'enhanced';
  formMinimumCompletionSeconds?: number;
  formAutomations?: WebsiteFormAutomation[];
  anchorId?: string;
  layout?: SectionLayout;
  layoutGap?: number;
  layoutAlign?: SectionLayoutAlign;
  backgroundMode?: SectionBackgroundMode;
  backgroundImage?: string;
  backgroundPosition?: SectionBackgroundPosition;
  backgroundSize?: SectionBackgroundSize;
  gradientFrom?: string;
  gradientTo?: string;
  gradientAngle?: number;
  overlayColor?: string;
  overlayOpacity?: number;
  minHeight?: number;
  sectionPaddingY?: number;
  sectionPaddingX?: number;
  sectionRadius?: number;
  responsive?: Partial<Record<Device, SectionResponsiveStyle>>;
  contentWidth?: SectionContentWidth;
  containers?: WebsiteElementContainer[];
  elements: WebsiteElement[];
}

export interface WebsiteBrand {
  name: string;
  industry: string;
  style: string;
  colors: {
    primary: string;
    secondary: string;
  };
  tone: string;
}

export interface WebsiteSEO {
  title: string;
  description: string;
  keywords: string[];
}

export interface WebsiteProject {
  version: 2;
  siteName: string;
  language: Language;
  sections: WebsiteSection[];
  brand: WebsiteBrand;
  seo: WebsiteSEO;
  updatedAt: string;
}
