import type { ApplicationDefinition } from './application-model';
import { compileApplicationCreateForm, type ApplicationCreateFormBinding } from './application-form-runtime';
import type { WebsiteSection } from './types';

export interface PublishedApplicationForm {
  pageId: string;
  section: WebsiteSection;
  binding: ApplicationCreateFormBinding;
}

/** Called after private-page authorization. Return only fields needed by the
 * browser compiler; never return integration settings or submitted values. */
export function preparePublishedApplicationForms(definition: ApplicationDefinition, pageId: string, sections: WebsiteSection[]): PublishedApplicationForm[] {
  const forms: PublishedApplicationForm[] = [];
  const sectionIds = new Set<string>();
  if (!pageId || !Array.isArray(sections) || sections.length > 100) throw new Error('Invalid application form page.');
  for (const section of sections) {
    if (!section || typeof section.id !== 'string' || !section.id || sectionIds.has(section.id)) throw new Error('Invalid application form section.');
    sectionIds.add(section.id);
    if (section.applicationFormBinding === undefined) continue;
    const binding = section.applicationFormBinding;
    compileApplicationCreateForm(definition, section, binding);
    forms.push({ pageId, section: {
      id: section.id, type: 'contact', title: '', description: '', buttonText: '', buttonUrl: '',
      background: '', accent: '', elements: [],
      formFields: section.formFields?.map(field => ({
        id: field.id, name: field.name, label: field.label, type: field.type, required: field.required,
        options: field.options, validation: field.validation,
      })),
      formSuccessAction: 'message', formAutomations: [],
    }, binding: JSON.parse(JSON.stringify(binding)) as ApplicationCreateFormBinding });
  }
  return forms;
}
