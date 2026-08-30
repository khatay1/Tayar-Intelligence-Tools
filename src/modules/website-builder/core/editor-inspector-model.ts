import type { EditorProjectLike } from './editor-model';
import { findEditorElement, findEditorPage, findEditorSection } from './editor-model';
import type { EditorSelection } from './editor-selection';

export interface EditorInspectorField {
  key: string;
  label: string;
  value: unknown;
  kind: 'text' | 'number' | 'color' | 'select' | 'toggle';
  group: 'content' | 'design' | 'responsive' | 'settings';
  options?: string[];
}

const field = (key: string, label: string, value: unknown, kind: EditorInspectorField['kind'], group: EditorInspectorField['group'], options?: string[]): EditorInspectorField => ({ key, label, value, kind, group, options });

export function buildEditorInspectorFields<P extends EditorProjectLike>(project: P, selection: EditorSelection): EditorInspectorField[] {
  if (!selection.pageId) return [];
  const page = findEditorPage(project, selection.pageId)?.page;
  if (!page) return [];
  if (!selection.sectionId) return [field('name', 'Page name', page.name || '', 'text', 'content'), field('slug', 'Slug', page.slug || '', 'text', 'settings')];
  const section = findEditorSection(project, selection.pageId, selection.sectionId)?.section;
  if (!section) return [];
  if (!selection.elementId) {
    return [
      field('title', 'Section title', section.title || '', 'text', 'content'),
      field('backgroundColor', 'Background', section.backgroundColor || '', 'color', 'design'),
      field('sectionPaddingY', 'Vertical padding', section.sectionPaddingY ?? 48, 'number', 'design'),
      field('layoutGap', 'Gap', section.layoutGap ?? 16, 'number', 'design'),
      field('responsive.mobile.sectionPaddingY', 'Mobile vertical padding', (section.responsive as any)?.mobile?.sectionPaddingY ?? '', 'number', 'responsive'),
      field('hidden', 'Hidden', Boolean(section.hidden), 'toggle', 'settings'),
    ];
  }
  const element = findEditorElement(project, selection.pageId, selection.sectionId, selection.elementId)?.element;
  if (!element) return [];
  const style = element.style || {};
  const responsive = element.responsive || {};
  return [
    field('content', 'Content', element.content ?? '', 'text', 'content'),
    field('src', 'Source', element.src ?? '', 'text', 'content'),
    field('alt', 'Alt text', element.alt ?? '', 'text', 'content'),
    field('style.color', 'Text color', style.color ?? '', 'color', 'design'),
    field('style.backgroundColor', 'Background', style.backgroundColor ?? '', 'color', 'design'),
    field('style.fontSize', 'Font size', style.fontSize ?? '', 'number', 'design'),
    field('style.padding', 'Padding', style.padding ?? '', 'number', 'design'),
    field('responsive.tablet.fontSize', 'Tablet font size', (responsive as any)?.tablet?.fontSize ?? '', 'number', 'responsive'),
    field('responsive.mobile.fontSize', 'Mobile font size', (responsive as any)?.mobile?.fontSize ?? '', 'number', 'responsive'),
    field('responsive.mobile.hidden', 'Hide on mobile', Boolean((responsive as any)?.mobile?.hidden), 'toggle', 'responsive'),
    field('symbolId', 'Reusable component', element.symbolId || '', 'text', 'settings'),
  ];
}

export function patchForEditorInspectorField(key: string, value: unknown) {
  const parts = key.split('.');
  if (parts.length === 1) return { [key]: value };
  const root: Record<string, unknown> = {};
  let cursor = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const next: Record<string, unknown> = {};
    cursor[parts[i]] = next;
    cursor = next;
  }
  cursor[parts[parts.length - 1]] = value;
  return root;
}
