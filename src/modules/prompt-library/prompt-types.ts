export type PromptCategory = 'business' | 'career' | 'writing' | 'social';

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  category: PromptCategory;
  prompt: string;
  tags: string[];
}
