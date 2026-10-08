import type { ApplicationDefinition } from './application-model';
import { compileApplicationDataView, type ApplicationDataViewBinding } from './application-data-view';
import type { WebsiteSection } from './types';

export interface PublishedApplicationDataView { pageId: string; sectionId: string; binding: ApplicationDataViewBinding }

export function preparePublishedApplicationDataViews(definition: ApplicationDefinition, pageId: string, sections: WebsiteSection[]): PublishedApplicationDataView[] {
  if (!pageId || !Array.isArray(sections) || sections.length > 100) throw new Error('Invalid data view page.');
  const seen = new Set<string>();
  return sections.flatMap(section => {
    if (!section || !section.id || seen.has(section.id)) throw new Error('Invalid data view section identity.');
    seen.add(section.id);
    if (section.applicationDataView === undefined) return [];
    if (section.type === 'contact' || section.type === 'footer') throw new Error('Data view requires a content section.');
    const compiled = compileApplicationDataView(definition, section.applicationDataView);
    return [{ pageId, sectionId: section.id, binding: compiled.binding }];
  });
}
