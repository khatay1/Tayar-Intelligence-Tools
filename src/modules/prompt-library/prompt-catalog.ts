import { BUSINESS_PROMPTS } from './prompts/business';
import { CAREER_PROMPTS } from './prompts/career';
import { CREATIVE_PROMPTS } from './prompts/creative';
import { PromptTemplate } from './prompt-types';

export const TAYAR_PROMPTS: PromptTemplate[] = [
  ...BUSINESS_PROMPTS,
  ...CAREER_PROMPTS,
  ...CREATIVE_PROMPTS,
];

export function searchPrompts(query: string, category: string) {
  const normalized = query.trim().toLowerCase();

  return TAYAR_PROMPTS.filter((prompt) => {
    if (category !== 'all' && prompt.category !== category) return false;
    if (!normalized) return true;

    return [
      prompt.title,
      prompt.description,
      prompt.category,
      ...prompt.tags,
    ].some((value) => value.toLowerCase().includes(normalized));
  });
}
