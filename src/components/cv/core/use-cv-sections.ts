import { useCallback, useState } from 'react';
import { SectionConfig, SectionType } from '@/lib/cv-types';
import { moveCVSection, toggleCVSection } from './cv-sections';

export function useCVSections(sections: SectionConfig[], setSections: (sections: SectionConfig[]) => void) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const dragStart = useCallback((index: number) => setDraggedIndex(index), []);
  const dragEnd = useCallback(() => setDraggedIndex(null), []);
  const drop = useCallback((index: number) => {
    if (draggedIndex === null) return;
    setSections(moveCVSection(sections, draggedIndex, index));
    setDraggedIndex(null);
  }, [draggedIndex, sections, setSections]);
  const toggle = useCallback((id: SectionType) => {
    setSections(toggleCVSection(sections, id));
  }, [sections, setSections]);

  return { draggedIndex, dragStart, dragEnd, drop, toggle };
}
