import { CVData, SectionConfig, SectionType } from '@/lib/cv-types';
import { CVDocument } from './cv-document';
import { moveCVSection, toggleCVSection } from './cv-sections';

export function withCVData(document: CVDocument, data: CVData): CVDocument {
  return { ...document, data };
}

export function withCVSections(document: CVDocument, sections: SectionConfig[]): CVDocument {
  return { ...document, settings: { ...document.settings, sections } };
}

export function reorderCVDocumentSection(document: CVDocument, fromIndex: number, toIndex: number): CVDocument {
  return withCVSections(document, moveCVSection(document.settings.sections, fromIndex, toIndex));
}

export function toggleCVDocumentSection(document: CVDocument, id: SectionType): CVDocument {
  return withCVSections(document, toggleCVSection(document.settings.sections, id));
}

export function cvDocumentTitle(document: CVDocument): string {
  return document.data.personal.fullName.trim() || 'Untitled Resume';
}
