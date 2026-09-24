import type { Dispatch, SetStateAction } from 'react';
import type { Language } from '@/context/PreferencesContext';
import { PAGE_LANGUAGE_LABELS, languageCodeLabel, normalizePageLanguage, normalizeSlug } from './project-identifiers';
import { createPage, cloneSectionWithFreshIds } from './website-builder-rendering';
import type { WebsiteSection } from './types';
import type { BillingFeature, WebsitePage } from './website-builder-model';

interface PageManagementContext {
  pages: WebsitePage[];
  activePage: WebsitePage | null;
  activePageId: string;
  homePageId: string;
  sections: WebsiteSection[];
  language: Language;
  setPages: Dispatch<SetStateAction<WebsitePage[]>>;
  setActivePageId: Dispatch<SetStateAction<string>>;
  setHomePageId: Dispatch<SetStateAction<string>>;
  setSections: Dispatch<SetStateAction<WebsiteSection[]>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
  clearEditorDragState: () => void;
  selectEditorTarget: (sectionId: string | null, elementId?: string | null, containerId?: string | null, formFieldId?: string | null) => void;
  remember: (current: WebsiteSection[], label?: string) => void;
  requirePageCapacity: (extraPages?: number) => boolean;
  requireBillingFeature: (feature: BillingFeature, label: string) => boolean;
  l: (text: string) => string;
}

export function createPageManagementHandlers({
  pages,
  activePage,
  activePageId,
  homePageId,
  sections,
  language,
  setPages,
  setActivePageId,
  setHomePageId,
  setSections,
  setSaved,
  clearEditorDragState,
  selectEditorTarget,
  remember,
  requirePageCapacity,
  requireBillingFeature,
  l,
}: PageManagementContext) {
  function switchPage(pageId: string) {
    const target = pages.find((page) => page.id === pageId);
    if (!target || target.id === activePageId) return;
    clearEditorDragState();
    setPages((current) => current.map((page) =>
      page.id === activePageId ? { ...page, sections } : page
    ));
    setActivePageId(target.id);
    setSections(target.sections);
    selectEditorTarget(
      target.sections[0]?.id ?? null,
      target.sections[0]?.elements[0]?.id ?? null,
    );
    setSaved(false);
  }

  function addPage() {
    if (!requirePageCapacity(1)) return;
    remember(sections, 'Add page');
    const base = `page-${pages.length + 1}`;
    const used = new Set(pages.map((page) => page.slug));
    let slug = base;
    let suffix = 2;
    while (used.has(slug)) slug = `${base}-${suffix++}`;
    const page = { ...createPage(`Page ${pages.length + 1}`, slug), language: language };
    clearEditorDragState();
    setPages((current) => [
      ...current.map((item) =>
        item.id === activePageId
          ? { ...item, sections }
          : item
      ),
      page,
    ]);
    setActivePageId(page.id);
    setSections(page.sections);
    selectEditorTarget(
      page.sections[0]?.id ?? null,
      page.sections[0]?.elements[0]?.id ?? null,
    );
    setSaved(false);
  }

  function duplicateActivePage() {
    if (!activePage) return;
    if (!requirePageCapacity(1)) return;
    remember(sections, 'Duplicate page');
    const used = new Set(pages.map((page) => normalizeSlug(page.slug)));
    const base = `${normalizeSlug(activePage.slug)}-copy`;
    let slug = base;
    let suffix = 2;
    while (used.has(slug)) slug = `${base}-${suffix++}`;
    const clonedSections = activePage.sections.map((section) => cloneSectionWithFreshIds(section));
    const page: WebsitePage = {
      ...activePage,
      id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${activePage.name} Copy`,
      slug,
      sections: clonedSections,
      showInNavigation: false,
      canonicalUrl: '',
    };
    clearEditorDragState();
    setPages((current) => [
      ...current.map((item) =>
        item.id === activePageId
          ? { ...item, sections }
          : item
      ),
      page,
    ]);
    setActivePageId(page.id);
    setSections(clonedSections);
    selectEditorTarget(
      clonedSections[0]?.id ?? null,
      clonedSections[0]?.elements[0]?.id ?? null,
    );
    setSaved(false);
  }

  function duplicatePageAsTranslation(language: Language) {
    if (!activePage) return;
    if (!requireBillingFeature('multilingual', 'Multilingual pages')) return;
    if (!requirePageCapacity(1)) return;
    const currentLanguage = normalizePageLanguage(activePage.language, language);
    if (language === currentLanguage) return;
    const groupKey = activePage.translationKey?.trim() || `translation-${activePage.id}`;
    if (pages.some((page) => page.translationKey === groupKey && normalizePageLanguage(page.language, language) === language)) {
      window.alert(`${l('A')} ${l(PAGE_LANGUAGE_LABELS[language])} ${l('version already exists in this translation group.')}`);
      return;
    }
    const used = new Set(pages.map((page) => normalizeSlug(page.slug)));
    const base = `${normalizeSlug(activePage.slug)}-${language}`;
    let slug = base;
    let suffix = 2;
    while (used.has(slug)) slug = `${base}-${suffix++}`;
    const clonedSections = activePage.sections.map((section) => cloneSectionWithFreshIds(section));
    const page: WebsitePage = {
      ...activePage,
      id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${activePage.name} · ${languageCodeLabel(language)}`,
      slug,
      sections: clonedSections,
      language,
      translationKey: groupKey,
      canonicalUrl: '',
    };
    clearEditorDragState();
    setPages((current) => current
      .map((item) =>
        item.id === activePage.id
          ? {
              ...item,
              sections,
              translationKey: groupKey,
            }
          : item
      )
      .concat(page));
    setActivePageId(page.id);
    setSections(clonedSections);
    selectEditorTarget(
      clonedSections[0]?.id ?? null,
      clonedSections[0]?.elements[0]?.id ?? null,
    );
    setSaved(false);
  }

  function updateActivePageMeta(changes: Partial<Pick<WebsitePage, 'name' | 'slug' | 'showInNavigation' | 'seoTitle' | 'seoDescription' | 'socialImage' | 'canonicalUrl' | 'language' | 'translationKey' | 'noIndex'>>) {
    remember(sections, 'Edit page settings');
    setPages((current) => current.map((page) => {
      if (page.id !== activePageId) return page;
      return {
        ...page,
        sections,
        ...changes,
        slug: changes.slug !== undefined ? normalizeSlug(changes.slug) : page.slug,
      };
    }));
    setSaved(false);
  }

  function movePage(pageId: string, direction: 'up' | 'down') {
    remember(sections, 'Move page');
    setPages((current) => {
      const withLiveActivePage = current.map((page) =>
        page.id === activePageId
          ? { ...page, sections }
          : page
      );
      const index = withLiveActivePage.findIndex((page) => page.id === pageId);
      if (index === -1) return current;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= withLiveActivePage.length) {
        return withLiveActivePage;
      }
      const next = [...withLiveActivePage];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaved(false);
  }

  function makeActivePageHome() {
    if (!activePage) return;
    remember(sections, 'Set home page');
    setHomePageId(activePage.id);
    setSaved(false);
  }

  function deleteActivePage() {
    if (pages.length <= 1) return;
    remember(sections, 'Delete page');
    const remaining = pages.filter((page) => page.id !== activePageId);
    const next = remaining[0];
    clearEditorDragState();
    setPages(remaining);
    if (activePageId === homePageId) setHomePageId(next.id);
    setActivePageId(next.id);
    setSections(next.sections);
    selectEditorTarget(
      next.sections[0]?.id ?? null,
      next.sections[0]?.elements[0]?.id ?? null,
    );
    setSaved(false);
  }

  return { switchPage, addPage, duplicateActivePage, duplicatePageAsTranslation, updateActivePageMeta, movePage, makeActivePageHome, deleteActivePage };
}
