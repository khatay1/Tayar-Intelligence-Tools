export type TemplateCategory = 'finance' | 'business' | 'productivity';

export interface TayarTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  columns: string[];
  sampleRows: string[][];
  tags: string[];
}
