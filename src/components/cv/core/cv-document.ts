import {
  CVData,
  ColorTheme,
  DEFAULT_SECTIONS,
  SectionConfig,
  TemplateId,
  createEmptyCV,
} from '@/lib/cv-types';

export const CV_DOCUMENT_SCHEMA_VERSION = 1;

export interface CVDocumentSettings {
  template: TemplateId;
  colorTheme: ColorTheme;
  fontId: string;
  sections: SectionConfig[];
}

export interface CVDocument {
  schemaVersion: number;
  data: CVData;
  settings: CVDocumentSettings;
}

export function createCVDocument(): CVDocument {
  return {
    schemaVersion: CV_DOCUMENT_SCHEMA_VERSION,
    data: createEmptyCV(),
    settings: {
      template: 'modern',
      colorTheme: 'violet',
      fontId: 'inter',
      sections: DEFAULT_SECTIONS.map(section => ({ ...section })),
    },
  };
}

export function cloneCVDocument(document: CVDocument): CVDocument {
  return typeof structuredClone === 'function'
    ? structuredClone(document)
    : JSON.parse(JSON.stringify(document)) as CVDocument;
}

export function normalizeCVDocument(value: unknown): CVDocument {
  const fallback = createCVDocument();
  if (!value || typeof value !== 'object') return fallback;

  const source = value as Partial<CVDocument> & {
    cv?: CVData;
    template?: TemplateId;
    colorTheme?: ColorTheme;
    fontId?: string;
    sections?: SectionConfig[];
  };
  const settings = source.settings ?? {} as Partial<CVDocumentSettings>;

  return {
    schemaVersion: CV_DOCUMENT_SCHEMA_VERSION,
    data: source.data ?? source.cv ?? fallback.data,
    settings: {
      template: settings.template ?? source.template ?? fallback.settings.template,
      colorTheme: settings.colorTheme ?? source.colorTheme ?? fallback.settings.colorTheme,
      fontId: settings.fontId ?? source.fontId ?? fallback.settings.fontId,
      sections: (settings.sections ?? source.sections ?? fallback.settings.sections).map(section => ({ ...section })),
    },
  };
}

export function serializeCVDocument(document: CVDocument): Record<string, unknown> {
  return {
    schemaVersion: document.schemaVersion,
    cv: document.data,
    template: document.settings.template,
    colorTheme: document.settings.colorTheme,
    fontId: document.settings.fontId,
    sections: document.settings.sections,
  };
}
