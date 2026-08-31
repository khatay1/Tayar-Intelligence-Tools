export type NameUseCase = 'business' | 'product' | 'brand' | 'youtube' | 'instagram';
export type NameTone = 'modern' | 'professional' | 'friendly' | 'bold' | 'minimal';

export interface NameGeneratorInput {
  keyword: string;
  useCase: NameUseCase;
  tone: NameTone;
  count: number;
  nonce: number;
}

export interface GeneratedName {
  name: string;
  slug: string;
  reason: string;
}
