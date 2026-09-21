import { createDefaultContactFormFields } from './defaults';
import type { AIEditScopeTarget } from './editor-ai-scope';
import type { Device, WebsiteSEO } from './types';
import type { WebsiteHeaderConfig, WebsitePage, WebsiteSymbol, WebsiteTheme } from './website-builder-model';
export interface AIEditableSnapshotInput {
  pages: WebsitePage[];
  siteName: string;
  activePageId: string;
  homePageId: string;
  selectedId: string | null;
  selectedElementId: string | null;
  device: Device;
  seo: WebsiteSEO;
  headerConfig: WebsiteHeaderConfig;
  theme: WebsiteTheme;
  symbols: WebsiteSymbol[];
  scope?: AIEditScopeTarget;
}

export function buildAIEditableSnapshotData({
  pages,
  siteName,
  activePageId,
  homePageId,
  selectedId,
  selectedElementId,
  device,
  seo,
  headerConfig,
  theme,
  symbols,
  scope,
}: AIEditableSnapshotInput) {
  const scopedPages = pages
    .filter((page) => !scope || scope.kind === 'site' || page.id === scope.pageId);

  return {
    siteName,
    activePageId,
    homePageId,
    editScope: scope,
    selection: {
      pageId: activePageId,
      sectionId: selectedId,
      elementId: selectedElementId,
      device,
    },
    seo: {
      title: seo.title,
      description: seo.description,
      keywords: seo.keywords.slice(0, 20),
    },
    header: {
      enabled: headerConfig.enabled,
      sticky: headerConfig.sticky,
      mobileMenu: headerConfig.mobileMenu,
      languageSwitcher: headerConfig.languageSwitcher,
      brandText: headerConfig.brandText,
      logoUrl: headerConfig.logoUrl,
      showCta: headerConfig.showCta,
      ctaLabel: headerConfig.ctaLabel,
      ctaHref: headerConfig.ctaHref,
      backgroundColor: headerConfig.backgroundColor,
      textColor: headerConfig.textColor,
      activeColor: headerConfig.activeColor,
      hoverColor: headerConfig.hoverColor,
      ctaBackgroundColor: headerConfig.ctaBackgroundColor,
      ctaTextColor: headerConfig.ctaTextColor,
      navGap: headerConfig.navGap,
      brandSize: headerConfig.brandSize,
      navSize: headerConfig.navSize,
      borderColor: headerConfig.borderColor,
    },
    theme: {
      primaryColor: theme.primaryColor,
      secondaryColor: theme.secondaryColor,
      backgroundColor: theme.backgroundColor,
      textColor: theme.textColor,
      mutedTextColor: theme.mutedTextColor,
      fontFamily: theme.fontFamily,
      contentWidth: theme.contentWidth,
      buttonRadius: theme.buttonRadius,
      sectionSpacing: theme.sectionSpacing,
    },
    symbols: symbols.slice(0, 50).map((symbol) => ({
      id: symbol.id,
      name: symbol.name,
      type: symbol.element.type,
      content: symbol.element.content,
    })),
    pages: scopedPages.map((page) => ({
      id: page.id,
      name: page.name,
      slug: page.slug,
      showInNavigation: page.showInNavigation,
      seoTitle: page.seoTitle || '',
      seoDescription: page.seoDescription || '',
      canonicalUrl: page.canonicalUrl || '',
      noIndex: page.noIndex === true,
      sections: page.sections
        .filter((section) => !scope || scope.kind === 'site' || scope.kind === 'page' || section.id === scope.sectionId)
        .map((section) => ({
        id: section.id,
        type: section.type,
        title: section.title,
        description: section.description,
        buttonText: section.buttonText,
        buttonUrl: section.buttonUrl,
        background: section.background,
        accent: section.accent,
        image: section.image,
        imagePrompt: section.imagePrompt,
        backgroundMode: section.backgroundMode,
        backgroundImage: section.backgroundImage,
        backgroundPosition: section.backgroundPosition,
        backgroundSize: section.backgroundSize,
        gradientFrom: section.gradientFrom,
        gradientTo: section.gradientTo,
        gradientAngle: section.gradientAngle,
        overlayColor: section.overlayColor,
        overlayOpacity: section.overlayOpacity,
        sectionRadius: section.sectionRadius,
        anchorId: section.anchorId,
        layout: section.layout,
        layoutAlign: section.layoutAlign,
        contentWidth: section.contentWidth,
        minHeight: section.minHeight,
        sectionPaddingY: section.sectionPaddingY,
        sectionPaddingX: section.sectionPaddingX,
        layoutGap: section.layoutGap,
        responsive: section.responsive || {},
        containers: (section.containers || []).slice(0, 30).map((container) => ({
          id: container.id,
          name: container.name,
          layout: container.layout,
          gap: container.gap,
          rowGap: container.rowGap,
          columns: container.columns,
          wrap: container.wrap,
          align: container.align,
          justify: container.justify,
          backgroundColor: container.backgroundColor,
          padding: container.padding,
          borderRadius: container.borderRadius,
          borderWidth: container.borderWidth,
          borderColor: container.borderColor,
          shadow: container.shadow,
          layoutColumn: container.layoutColumn,
          columnSpan: container.columnSpan,
        })),
        form: section.type === 'contact' ? {
          successMessage: section.formSuccessMessage || '',
          successAction: section.formSuccessAction || 'message',
          redirectUrl: section.formRedirectUrl || '',
          fields: (section.formFields || createDefaultContactFormFields()).slice(0, 20).map((field) => ({
            id: field.id,
            name: field.name,
            label: field.label,
            type: field.type,
            placeholder: field.placeholder || '',
            required: field.required,
            options: field.options || [],
          })),
        } : undefined,
        elements: section.elements
          .filter((element) => !scope || scope.kind !== 'element' || element.id === scope.elementId)
          .slice(0, 20)
          .map((element) => ({
          id: element.id,
          type: element.type,
          content: element.content,
          href: element.href,
          src: element.src,
          layoutColumn: element.layoutColumn,
          containerId: element.containerId,
          symbolId: element.symbolId,
          animationOnce: element.animationOnce,
          style: element.style,
          responsive: element.responsive || {},
        })),
      })),
    })),
  };
}
