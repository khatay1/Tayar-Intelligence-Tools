import type { EditorValidationResult } from './editor-transaction';
import {
  resolveEditorProjectLimits,
  type EditorProjectLike,
  type EditorProjectLimits,
} from './editor-model';

function hasDuplicateIds(values: Array<{ id: string }>) {
  const ids = new Set<string>();
  for (const value of values) {
    if (!value.id || ids.has(value.id)) return true;
    ids.add(value.id);
  }
  return false;
}

export function validateEditorProject<P extends EditorProjectLike>(
  project: P,
  limits: EditorProjectLimits = {},
): EditorValidationResult {
  const resolved = resolveEditorProjectLimits(limits);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(project.pages) || project.pages.length === 0) {
    errors.push('Project must contain at least one page');
    return { ok: false, errors, warnings };
  }

  if (project.pages.length > resolved.maxPages) {
    errors.push(`Project exceeds page limit (${resolved.maxPages})`);
  }

  if (hasDuplicateIds(project.pages)) {
    errors.push('Project contains duplicate or blank page IDs');
  }

  if (project.homePageId && !project.pages.some((page) => page.id === project.homePageId)) {
    errors.push('Home page ID does not reference an existing page');
  }


  const symbols = Array.isArray(project.symbols) ? project.symbols : [];
  if (symbols.length > resolved.maxSymbols) {
    errors.push(`Project exceeds reusable component limit (${resolved.maxSymbols})`);
  }
  if (hasDuplicateIds(symbols)) {
    errors.push('Project contains duplicate or blank symbol IDs');
  }
  const symbolIds = new Set(symbols.map((symbol) => symbol.id));
  for (const symbol of symbols) {
    if (!symbol.element || typeof symbol.element !== 'object' || !symbol.element.id) {
      errors.push(`Symbol ${symbol.id || '(unknown)'} is missing its element template`);
    }
  }

  const globalSectionIds = new Set<string>();
  const globalElementIds = new Set<string>();
  const globalContainerIds = new Set<string>();
  const globalFormFieldIds = new Set<string>();

  for (const page of project.pages) {
    if (!Array.isArray(page.sections) || page.sections.length === 0) {
      errors.push(`Page ${page.id || '(unknown)'} must contain at least one section`);
      continue;
    }

    if (page.sections.length > resolved.maxSectionsPerPage) {
      errors.push(`Page ${page.id} exceeds section limit (${resolved.maxSectionsPerPage})`);
    }

    if (hasDuplicateIds(page.sections)) {
      errors.push(`Page ${page.id} contains duplicate or blank section IDs`);
    }

    for (const section of page.sections) {
      if (globalSectionIds.has(section.id)) errors.push(`Duplicate section ID across project: ${section.id}`);
      globalSectionIds.add(section.id);
      if (!Array.isArray(section.elements) || section.elements.length === 0) {
        errors.push(`Section ${section.id || '(unknown)'} must contain at least one element`);
        continue;
      }

      if (section.elements.length > resolved.maxElementsPerSection) {
        errors.push(`Section ${section.id} exceeds element limit (${resolved.maxElementsPerSection})`);
      }

      if (hasDuplicateIds(section.elements)) {
        errors.push(`Section ${section.id} contains duplicate or blank element IDs`);
      }
      for (const element of section.elements) {
        if (globalElementIds.has(element.id)) errors.push(`Duplicate element ID across project: ${element.id}`);
        globalElementIds.add(element.id);
        if (element.symbolId && !symbolIds.has(element.symbolId)) {
          errors.push(`Element ${element.id} references missing symbol ${element.symbolId}`);
        }
      }

      const containers = Array.isArray(section.containers) ? section.containers : [];
      if (containers.length > resolved.maxContainersPerSection) {
        errors.push(`Section ${section.id} exceeds container limit (${resolved.maxContainersPerSection})`);
      }
      if (hasDuplicateIds(containers)) {
        errors.push(`Section ${section.id} contains duplicate or blank container IDs`);
      }
      for (const container of containers) {
        if (globalContainerIds.has(container.id)) errors.push(`Duplicate container ID across project: ${container.id}`);
        globalContainerIds.add(container.id);
      }

      const containerIds = new Set(containers.map((container) => container.id));
      for (const element of section.elements) {
        if (element.containerId && !containerIds.has(element.containerId)) {
          warnings.push(`Element ${element.id} references missing container ${element.containerId}`);
        }
      }

      const formFields = Array.isArray(section.formFields) ? section.formFields : [];
      if (formFields.length > resolved.maxFormFieldsPerSection) {
        errors.push(`Section ${section.id} exceeds form-field limit (${resolved.maxFormFieldsPerSection})`);
      }
      if (hasDuplicateIds(formFields)) {
        errors.push(`Section ${section.id} contains duplicate or blank form-field IDs`);
      }
      for (const field of formFields) {
        if (globalFormFieldIds.has(field.id)) errors.push(`Duplicate form-field ID across project: ${field.id}`);
        globalFormFieldIds.add(field.id);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors: errors.slice(0, 50),
    warnings: warnings.slice(0, 50),
  };
}
