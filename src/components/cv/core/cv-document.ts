import {
  CVData,
  ColorTheme,
  SectionConfig,
  TemplateId,
  createEmptyCV,
} from '@/lib/cv-types';
import { normalizeCVSections } from './cv-sections';

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
      sections: normalizeCVSections(),
    },
  };
}

export function cloneCVDocument(document: CVDocument): CVDocument {
  return typeof structuredClone === 'function'
    ? structuredClone(document)
    : JSON.parse(JSON.stringify(document)) as CVDocument;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeCVData(value: unknown, fallback: CVData): CVData {
  if (!isObject(value)) return fallback;
  const source = value as Partial<CVData>;
  return {
    ...fallback,
    ...source,
    personal: isObject(source.personal) ? { ...fallback.personal, ...source.personal } : fallback.personal,
    experience: Array.isArray(source.experience) ? source.experience : fallback.experience,
    education: Array.isArray(source.education) ? source.education : fallback.education,
    skills: Array.isArray(source.skills) ? source.skills : fallback.skills,
    languages: Array.isArray(source.languages) ? source.languages : fallback.languages,
    projects: Array.isArray(source.projects) ? source.projects : fallback.projects,
    certificates: Array.isArray(source.certificates) ? source.certificates : fallback.certificates,
    awards: Array.isArray(source.awards) ? source.awards : fallback.awards,
  };
}

export function normalizeCVDocument(value: unknown): CVDocument {
  const fallback = createCVDocument();
  if (!isObject(value)) return fallback;

  const source = value as Partial<CVDocument> & {
    cv?: unknown;
    template?: TemplateId;
    colorTheme?: ColorTheme;
    fontId?: string;
    sections?: SectionConfig[];
  };
  const settings = isObject(source.settings) ? source.settings as Partial<CVDocumentSettings> : {};
  const rawSections = settings.sections ?? source.sections;

  return {
    schemaVersion: CV_DOCUMENT_SCHEMA_VERSION,
    data: normalizeCVData(source.data ?? source.cv, fallback.data),
    settings: {
      template: settings.template ?? source.template ?? fallback.settings.template,
      colorTheme: settings.colorTheme ?? source.colorTheme ?? fallback.settings.colorTheme,
      fontId: typeof (settings.fontId ?? source.fontId) === 'string' ? (settings.fontId ?? source.fontId)! : fallback.settings.fontId,
      sections: normalizeCVSections(Array.isArray(rawSections) ? rawSections : undefined),
    },
  };
}

export function serializeCVDocument(document: CVDocument): Record<string, unknown> {
  return {
    schemaVersion: CV_DOCUMENT_SCHEMA_VERSION,
    cv: document.data,
    template: document.settings.template,
    colorTheme: document.settings.colorTheme,
    fontId: document.settings.fontId,
    sections: normalizeCVSections(document.settings.sections),
  };
}
