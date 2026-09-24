import type { Dispatch, SetStateAction } from 'react';
import { applyThemeToSection, normalizeTheme } from './website-builder-config';
import { repairWebsiteDesignTokens, type WebsiteDesignSystemPreset } from './website-design-system';
import type { WebsitePage, WebsiteTheme } from './website-builder-model';
import type { WebsiteSection } from './types';

interface ThemeActionsContext {
  sections: WebsiteSection[];
  theme: WebsiteTheme;
  activePageId: string;
  getCurrentPages: () => WebsitePage[];
  remember: (sections: WebsiteSection[], label?: string) => void;
  setSections: Dispatch<SetStateAction<WebsiteSection[]>>;
  setPages: Dispatch<SetStateAction<WebsitePage[]>>;
  setTheme: Dispatch<SetStateAction<WebsiteTheme>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setSelectedElementId: Dispatch<SetStateAction<string | null>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
}

export function createThemeActions({
  sections, theme, activePageId, getCurrentPages, remember,
  setSections, setPages, setTheme, setSelectedId, setSelectedElementId, setSaved,
}: ThemeActionsContext) {
  function applyThemeToCurrentPage() {
    remember(sections);
    setSections(sections.map((section, index) => applyThemeToSection(section, index, theme)));
    setSaved(false);
  }

  function applyThemeToAllPages() {
    remember(sections, 'Apply theme to all pages');
    const currentPages = getCurrentPages();
    const nextPages = currentPages.map((page) => ({
      ...page,
      sections: page.sections.map((section, index) => applyThemeToSection(section, index, theme)),
    }));
    const active = nextPages.find((page) => page.id === activePageId) || nextPages[0];
    setPages(nextPages);
    setSections(active?.sections || []);
    setSelectedId(active?.sections[0]?.id ?? null);
    setSelectedElementId(active?.sections[0]?.elements[0]?.id ?? null);
    setSaved(false);
  }

  function applyDesignSystemTheme(nextTheme: WebsiteTheme, label: string) {
    const normalized = normalizeTheme(nextTheme);
    remember(sections, label);
    const nextPages = getCurrentPages().map((page) => ({
      ...page,
      sections: page.sections.map((section, index) => applyThemeToSection(section, index, normalized)),
    }));
    const active = nextPages.find((page) => page.id === activePageId) || nextPages[0];
    setTheme(normalized);
    setPages(nextPages);
    setSections(active?.sections || []);
    setSelectedId(active?.sections[0]?.id ?? null);
    setSelectedElementId(active?.sections[0]?.elements[0]?.id ?? null);
    setSaved(false);
  }

  function applyDesignSystemPreset(preset: WebsiteDesignSystemPreset) {
    applyDesignSystemTheme(preset.theme, `Apply ${preset.name} design system`);
  }

  function repairActiveDesignSystem() {
    const repaired = repairWebsiteDesignTokens(theme, getCurrentPages());
    remember(sections, 'Repair design system tokens');
    setTheme(repaired.theme);
    setPages(repaired.pages);
    setSections((repaired.pages.find((page) => page.id === activePageId) || repaired.pages[0])?.sections || []);
    setSaved(false);
  }

  return { applyThemeToCurrentPage, applyThemeToAllPages, applyDesignSystemPreset, repairActiveDesignSystem };
}
