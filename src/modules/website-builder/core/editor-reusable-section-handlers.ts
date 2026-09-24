import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { deleteReusableSectionInCloud, listReusableSectionsInCloud, saveReusableSectionInCloud } from '../services/reusableSectionService';
import { SECTION_LABELS, normalizeSection } from './defaults';
import { REUSABLE_SECTIONS_KEY } from './website-builder-config';
import { cloneSectionWithFreshIds } from './website-builder-rendering';
import type { WebsiteSection } from './types';
import type { ReusableSectionTemplate } from './website-builder-model';

interface ReusableSectionContext {
  user: { id: string } | null;
  sections: WebsiteSection[];
  selectedSection: WebsiteSection | null;
  reusableSections: ReusableSectionTemplate[];
  reusableRefreshSequenceRef: MutableRefObject<number>;
  reusableOperationSequenceRef: MutableRefObject<number>;
  activeUserIdRef: MutableRefObject<string | null>;
  setReusableError: Dispatch<SetStateAction<string>>;
  setReusableBusy: Dispatch<SetStateAction<boolean>>;
  setReusableSections: Dispatch<SetStateAction<ReusableSectionTemplate[]>>;
  setSections: Dispatch<SetStateAction<WebsiteSection[]>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setSelectedElementId: Dispatch<SetStateAction<string | null>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
  remember: (sections: WebsiteSection[], label?: string) => void;
  l: (text: string) => string;
}

export function useReusableSectionHandlers({
  user, sections, selectedSection, reusableSections,
  reusableRefreshSequenceRef, reusableOperationSequenceRef, activeUserIdRef,
  setReusableError, setReusableBusy, setReusableSections, setSections,
  setSelectedId, setSelectedElementId, setSaved, remember, l,
}: ReusableSectionContext) {
  const loadLocalReusableSections = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(REUSABLE_SECTIONS_KEY) || '[]');
      if (!Array.isArray(stored)) return [];
      return stored
        .filter((item) => item && item.section && item.title)
        .slice(0, 30) as ReusableSectionTemplate[];
    } catch {
      return [];
    }
  }, []);

  const refreshReusableSections = useCallback(async () => {
    const refreshUserId = user?.id ?? null;
    const refreshSequence = ++reusableRefreshSequenceRef.current;
    const refreshIsCurrent = () =>
      reusableRefreshSequenceRef.current === refreshSequence &&
      activeUserIdRef.current === refreshUserId;

    setReusableError('');

    if (!refreshUserId) {
      if (refreshIsCurrent()) {
        setReusableSections(loadLocalReusableSections());
        setReusableBusy(false);
      }
      return;
    }

    setReusableBusy(true);

    const { data, error } = await listReusableSectionsInCloud(refreshUserId);

    if (!refreshIsCurrent()) return;

    if (error) {
      setReusableError('Could not load reusable sections.');
      setReusableBusy(false);
      return;
    }

    const items: ReusableSectionTemplate[] = (data || [])
      .map((item) => {
        const content = item.content as { section?: WebsiteSection } | null;
        if (!content?.section) return null;
        return {
          id: item.id,
          cloudId: item.id,
          title: item.title || SECTION_LABELS[content.section.type],
          section: normalizeSection(content.section),
          updatedAt: item.updated_at,
        } as ReusableSectionTemplate;
      })
      .filter((item): item is ReusableSectionTemplate => Boolean(item));

    setReusableSections(items);
    setReusableBusy(false);
  }, [user?.id, loadLocalReusableSections, reusableRefreshSequenceRef, activeUserIdRef, setReusableError, setReusableBusy, setReusableSections]);

  async function saveSelectedSectionAsReusable() {
    if (!selectedSection) return;
    const title = window.prompt('Template name', selectedSection.title || SECTION_LABELS[selectedSection.type])?.trim();
    if (!title) return;

    setReusableError('');
    const savedSection = JSON.parse(JSON.stringify(selectedSection)) as WebsiteSection;
    const operationUserId = user?.id ?? null;

    if (!operationUserId) {
      const item: ReusableSectionTemplate = {
        id: `local-template-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        section: savedSection,
        updatedAt: new Date().toISOString(),
      };
      const next = [item, ...reusableSections].slice(0, 30);
      setReusableSections(next);
      localStorage.setItem(REUSABLE_SECTIONS_KEY, JSON.stringify(next));
      setReusableBusy(false);
      return;
    }

    const operationSequence = ++reusableOperationSequenceRef.current;
    const operationIsCurrent = () =>
      reusableOperationSequenceRef.current === operationSequence &&
      activeUserIdRef.current === operationUserId;

    setReusableBusy(true);
    let refreshStarted = false;

    try {
      const { error } = await saveReusableSectionInCloud(operationUserId, title, savedSection);

      if (!operationIsCurrent()) return;

      if (error) {
        setReusableError('Could not save this reusable section.');
        return;
      }

      refreshStarted = true;
      await refreshReusableSections();
    } finally {
      if (operationIsCurrent() && !refreshStarted) {
        setReusableBusy(false);
      }
    }
  }


  function insertReusableSection(template: ReusableSectionTemplate) {
    remember(sections);
    const section = cloneSectionWithFreshIds(template.section, sections);
    setSections((current) => [...current, section]);
    setSelectedId(section.id);
    setSelectedElementId(section.elements[0]?.id ?? null);
    setSaved(false);
  }

  async function deleteReusableSection(template: ReusableSectionTemplate) {
    if (!window.confirm(`${l('Delete reusable section')} “${template.title}”?`)) return;
    setReusableError('');

    const operationUserId = user?.id ?? null;

    if (!operationUserId || !template.cloudId) {
      const next = reusableSections.filter((item) => item.id !== template.id);
      setReusableSections(next);
      localStorage.setItem(REUSABLE_SECTIONS_KEY, JSON.stringify(next));
      return;
    }

    const operationSequence = ++reusableOperationSequenceRef.current;
    const operationIsCurrent = () =>
      reusableOperationSequenceRef.current === operationSequence &&
      activeUserIdRef.current === operationUserId;

    setReusableBusy(true);
    let refreshStarted = false;

    try {
      const { error } = await deleteReusableSectionInCloud(operationUserId, template.cloudId);

      if (!operationIsCurrent()) return;

      if (error) {
        setReusableError('Could not delete this reusable section.');
        return;
      }

      refreshStarted = true;
      await refreshReusableSections();
    } finally {
      if (operationIsCurrent() && !refreshStarted) {
        setReusableBusy(false);
      }
    }
  }
  return { refreshReusableSections, saveSelectedSectionAsReusable, insertReusableSection, deleteReusableSection };
}
