import { CVData, ColorTheme, SectionConfig, TemplateId } from '@/lib/cv-types';
import { CVDocument } from './cv-document';

export interface LegacyCVBuilderState {
  cv: CVData;
  template: TemplateId;
  colorTheme: ColorTheme;
  fontId: string;
  sections: SectionConfig[];
}

export function documentToLegacyCVState(document: CVDocument): LegacyCVBuilderState {
  return {
    cv: document.data,
    template: document.settings.template,
    colorTheme: document.settings.colorTheme,
    fontId: document.settings.fontId,
    sections: document.settings.sections,
  };
}

export function legacyCVStateToDocument(state: LegacyCVBuilderState): CVDocument {
  return {
    schemaVersion: 1,
    data: state.cv,
    settings: {
      template: state.template,
      colorTheme: state.colorTheme,
      fontId: state.fontId,
      sections: state.sections,
    },
  };
}
