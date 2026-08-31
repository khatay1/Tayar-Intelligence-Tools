import { BUSINESS_TEMPLATES } from './templates/business';
import { FINANCE_TEMPLATES } from './templates/finance';
import { PRODUCTIVITY_TEMPLATES } from './templates/productivity';
import { TayarTemplate } from './template-types';

export const TAYAR_TEMPLATES: TayarTemplate[] = [
  ...FINANCE_TEMPLATES,
  ...BUSINESS_TEMPLATES,
  ...PRODUCTIVITY_TEMPLATES,
];

export function searchTemplates(query: string, category: string) {
  const normalized = query.trim().toLowerCase();

  return TAYAR_TEMPLATES.filter((template) => {
    if (category !== 'all' && template.category !== category) return false;
    if (!normalized) return true;

    return [
      template.name,
      template.description,
      template.category,
      ...template.tags,
    ].some((value) => value.toLowerCase().includes(normalized));
  });
}
