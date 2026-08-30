import type { EditorProjectLike } from './editor-model';

export interface EditorMediaUsage {
  mediaUrl: string;
  pageId: string;
  sectionId: string;
  elementId?: string;
  field: string;
}

const MEDIA_FIELDS = ['src', 'url', 'imageUrl', 'backgroundImage', 'poster', 'videoUrl'] as const;

function extractUrl(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function collectEditorMediaUsage<P extends EditorProjectLike>(project: P): EditorMediaUsage[] {
  const usages: EditorMediaUsage[] = [];
  for (const page of project.pages) {
    for (const section of page.sections) {
      for (const field of MEDIA_FIELDS) {
        const url = extractUrl(section[field]);
        if (url) usages.push({ mediaUrl: url, pageId: page.id, sectionId: section.id, field });
      }
      for (const element of section.elements) {
        for (const field of MEDIA_FIELDS) {
          const url = extractUrl(element[field]);
          if (url) usages.push({ mediaUrl: url, pageId: page.id, sectionId: section.id, elementId: element.id, field });
        }
      }
    }
  }
  return usages;
}

export function buildEditorMediaUsageIndex<P extends EditorProjectLike>(project: P) {
  const index = new Map<string, EditorMediaUsage[]>();
  for (const usage of collectEditorMediaUsage(project)) {
    const group = index.get(usage.mediaUrl) || [];
    group.push(usage);
    index.set(usage.mediaUrl, group);
  }
  return index;
}

export function editorMediaIsInUse<P extends EditorProjectLike>(project: P, mediaUrl: string) {
  return (buildEditorMediaUsageIndex(project).get(mediaUrl)?.length || 0) > 0;
}
