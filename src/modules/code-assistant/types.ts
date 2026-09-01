export type UIComponentCategory =
  | 'hero'
  | 'navigation'
  | 'dashboard'
  | 'forms'
  | 'pricing'
  | 'authentication'
  | 'ai'
  | 'cards'
  | 'cta'
  | 'data';

export type RegistryLicense = 'MIT' | 'Apache-2.0' | 'Tayar' | 'restricted';

export interface RegistrySource {
  id: string;
  name: string;
  repository?: string;
  homepageUrl?: string;
  license: RegistryLicense;
  redistributionAllowed: boolean;
  attributionRequired: boolean;
  note: string;
}

export interface UIComponentRecord {
  id: string;
  name: string;
  description: string;
  category: UIComponentCategory;
  kind?: 'component' | 'block';
  tags: string[];
  sourceId: string;
  sourcePath?: string;
  license: RegistryLicense;
  dependencies: string[];
  code: string;
  remote?: {
    sourceId: string;
    revision?: string;
    files: string[];
    registryDependencies: string[];
  };
  preview: 'hero' | 'nav' | 'pricing' | 'auth' | 'stats' | 'dashboard' | 'chat' | 'cta' | 'generic';
  aiPrompt: string;
}
