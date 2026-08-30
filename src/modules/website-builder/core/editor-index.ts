import type {
  EditorContainerLike,
  EditorElementLike,
  EditorFormFieldLike,
  EditorPageLike,
  EditorProjectLike,
  EditorSectionLike,
  EditorSymbolLike,
} from './editor-model';

export interface EditorIndexedPage {
  page: EditorPageLike;
  pageIndex: number;
}

export interface EditorIndexedSection extends EditorIndexedPage {
  section: EditorSectionLike;
  sectionIndex: number;
}

export interface EditorIndexedElement extends EditorIndexedSection {
  element: EditorElementLike;
  elementIndex: number;
}

export interface EditorIndexedContainer extends EditorIndexedSection {
  container: EditorContainerLike;
  containerIndex: number;
}

export interface EditorIndexedFormField extends EditorIndexedSection {
  field: EditorFormFieldLike;
  fieldIndex: number;
}

export interface EditorProjectIndex {
  pages: Map<string, EditorIndexedPage>;
  sections: Map<string, EditorIndexedSection>;
  elements: Map<string, EditorIndexedElement>;
  containers: Map<string, EditorIndexedContainer>;
  formFields: Map<string, EditorIndexedFormField>;
  symbols: Map<string, { symbol: EditorSymbolLike; symbolIndex: number }>;
  counts: {
    pages: number;
    sections: number;
    elements: number;
    containers: number;
    formFields: number;
    symbols: number;
  };
}

export function createEditorProjectIndex<P extends EditorProjectLike>(project: P): EditorProjectIndex {
  const pages = new Map<string, EditorIndexedPage>();
  const sections = new Map<string, EditorIndexedSection>();
  const elements = new Map<string, EditorIndexedElement>();
  const containers = new Map<string, EditorIndexedContainer>();
  const formFields = new Map<string, EditorIndexedFormField>();
  const symbols = new Map<string, { symbol: EditorSymbolLike; symbolIndex: number }>();

  project.pages.forEach((page, pageIndex) => {
    const pageRef = { page, pageIndex };
    pages.set(page.id, pageRef);
    page.sections.forEach((section, sectionIndex) => {
      const sectionRef = { ...pageRef, section, sectionIndex };
      sections.set(section.id, sectionRef);
      section.elements.forEach((element, elementIndex) => {
        elements.set(element.id, { ...sectionRef, element, elementIndex });
      });
      (section.containers || []).forEach((container, containerIndex) => {
        containers.set(container.id, { ...sectionRef, container, containerIndex });
      });
      (section.formFields || []).forEach((field, fieldIndex) => {
        formFields.set(field.id, { ...sectionRef, field, fieldIndex });
      });
    });
  });

  (project.symbols || []).forEach((symbol, symbolIndex) => {
    symbols.set(symbol.id, { symbol, symbolIndex });
  });

  return {
    pages,
    sections,
    elements,
    containers,
    formFields,
    symbols,
    counts: {
      pages: pages.size,
      sections: sections.size,
      elements: elements.size,
      containers: containers.size,
      formFields: formFields.size,
      symbols: symbols.size,
    },
  };
}
