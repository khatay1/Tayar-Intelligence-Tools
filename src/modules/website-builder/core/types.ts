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
export type ElementAnimation = 'none' | 'fade' | 'fade-up' | 'fade-down' | 'fade-left' | 'fade-right' | 'zoom-in' | 'zoom-out';
export type ElementContainerLayout = 'stack' | 'row';
export type ElementContainerAlign = 'start' | 'center' | 'end' | 'stretch';
export type WebsiteFormFieldType = 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox';

export interface WebsiteFormField {
  id: string;
  name: string;
  label: string;
  type: WebsiteFormFieldType;
  placeholder?: string;
  required: boolean;
  options?: string[];
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
  maxWidth?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  order?: number;
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
}

export interface WebsiteElementContainer {
  id: string;
  name: string;
  layout: ElementContainerLayout;
  gap: number;
  align: ElementContainerAlign;
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
  containerId?: string;
  symbolId?: string;
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
