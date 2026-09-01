import type { CodePatchPlan } from './patch-plan';
import type { CodeProjectContext } from './project-context';
import type { UIComponentCategory, UIComponentRecord } from './types';

export type PageKind = 'landing' | 'saas' | 'pricing' | 'dashboard-shell';
export type PageThemeId = 'project-native' | 'minimal' | 'glass' | 'bold';

export interface PageSectionSpec {
  id: string;
  label: string;
  categories: UIComponentCategory[];
  keywords: string[];
}

export interface PagePreset {
  id: PageKind;
  label: string;
  description: string;
  defaultGoal: string;
  sections: PageSectionSpec[];
}

export interface PageThemePreset {
  id: PageThemeId;
  label: string;
  instruction: string;
}

export const PAGE_PRESETS: PagePreset[] = [
  {
    id: 'landing',
    label: 'Landing',
    description: 'Navigation, hero, trust/value sections, CTA and footer-ready structure.',
    defaultGoal: 'Build a complete conversion-focused landing page that feels native to the active project.',
    sections: [
      { id: 'navigation', label: 'Navigation', categories: ['navigation'], keywords: ['navbar','navigation','header','menu'] },
      { id: 'hero', label: 'Hero', categories: ['hero'], keywords: ['hero','landing','headline','banner'] },
      { id: 'features', label: 'Features', categories: ['cards','data'], keywords: ['feature','benefit','bento','card','grid'] },
      { id: 'social-proof', label: 'Social proof', categories: ['cards','data'], keywords: ['testimonial','logo','stats','metric','review'] },
      { id: 'cta', label: 'CTA', categories: ['cta'], keywords: ['cta','call to action','banner'] },
    ],
  },
  {
    id: 'saas',
    label: 'SaaS',
    description: 'Product-first SaaS page with hero, feature proof, product UI, pricing and CTA.',
    defaultGoal: 'Build a polished SaaS marketing page with strong hierarchy, product proof and clear conversion flow.',
    sections: [
      { id: 'navigation', label: 'Navigation', categories: ['navigation'], keywords: ['navbar','navigation','header'] },
      { id: 'hero', label: 'Hero', categories: ['hero'], keywords: ['hero','saas','product','launch'] },
      { id: 'product-proof', label: 'Product proof', categories: ['dashboard','data','cards'], keywords: ['dashboard','analytics','preview','metrics'] },
      { id: 'features', label: 'Features', categories: ['cards','data'], keywords: ['feature','benefit','bento','grid'] },
      { id: 'pricing', label: 'Pricing', categories: ['pricing'], keywords: ['pricing','plans','subscription'] },
      { id: 'cta', label: 'CTA', categories: ['cta'], keywords: ['cta','start','trial','signup'] },
    ],
  },
  {
    id: 'pricing',
    label: 'Pricing',
    description: 'Focused pricing experience with plan comparison, FAQ/supporting proof and CTA.',
    defaultGoal: 'Build a trustworthy pricing page with clear plan differences, responsive comparison and conversion CTA.',
    sections: [
      { id: 'navigation', label: 'Navigation', categories: ['navigation'], keywords: ['navbar','navigation','header'] },
      { id: 'pricing', label: 'Pricing', categories: ['pricing'], keywords: ['pricing','plans','tiers','subscription'] },
      { id: 'comparison', label: 'Comparison', categories: ['data','cards'], keywords: ['comparison','table','features','plans'] },
      { id: 'proof', label: 'Proof', categories: ['cards','data'], keywords: ['testimonial','stats','trust','review'] },
      { id: 'cta', label: 'CTA', categories: ['cta'], keywords: ['cta','upgrade','start'] },
    ],
  },
  {
    id: 'dashboard-shell',
    label: 'Dashboard shell',
    description: 'Application shell with navigation, overview cards/data and responsive workspace structure.',
    defaultGoal: 'Build a responsive dashboard shell that reuses project navigation and data boundaries without inventing backend behavior.',
    sections: [
      { id: 'navigation', label: 'Navigation', categories: ['navigation'], keywords: ['sidebar','navigation','menu','header'] },
      { id: 'overview', label: 'Overview', categories: ['dashboard','data'], keywords: ['dashboard','overview','stats','metrics'] },
      { id: 'workspace', label: 'Workspace', categories: ['cards','data','forms'], keywords: ['table','panel','workspace','filters','cards'] },
    ],
  },
];

export const PAGE_THEME_PRESETS: PageThemePreset[] = [
  { id: 'project-native', label: 'Project native', instruction: 'Follow the active project style profile as closely as possible. Reuse its tokens, spacing, radii, typography and component conventions.' },
  { id: 'minimal', label: 'Minimal', instruction: 'Use restrained surfaces, generous whitespace, simple hierarchy and subtle interaction while still reusing project tokens.' },
  { id: 'glass', label: 'Glass', instruction: 'Use layered translucent surfaces and subtle depth only where they fit the existing project; preserve contrast, readability and reduced-motion behavior.' },
  { id: 'bold', label: 'Bold', instruction: 'Use stronger type hierarchy, larger visual contrast and confident section separation while staying consistent with project tokens and accessibility.' },
];

const BACKEND_PATH = /(?:^|\/)(?:api|server|backend|supabase|migrations?|functions?|edge-functions?)(?:\/|$)|(?:^|\/)route\.[cm]?[jt]s$/i;

function words(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2);
}

export function getPagePreset(kind: PageKind): PagePreset {
  return PAGE_PRESETS.find((preset) => preset.id === kind) || PAGE_PRESETS[0];
}

export function getPageTheme(id: PageThemeId): PageThemePreset {
  return PAGE_THEME_PRESETS.find((theme) => theme.id === id) || PAGE_THEME_PRESETS[0];
}

function scoreForSection(item: UIComponentRecord, section: PageSectionSpec): number {
  let score = section.categories.includes(item.category) ? 28 : 0;
  const keywords = new Set(section.keywords.flatMap(words));
  for (const word of words([item.name, item.description, ...item.tags].join(' '))) if (keywords.has(word)) score += 6;
  if ((item.kind || 'component') === 'block') score += 3;
  return score;
}

export function composePageAnchors(records: UIComponentRecord[], kind: PageKind): Array<{ section: PageSectionSpec; item: UIComponentRecord }> {
  const preset = getPagePreset(kind);
  const used = new Set<string>();
  const result: Array<{ section: PageSectionSpec; item: UIComponentRecord }> = [];

  for (const section of preset.sections) {
    const ranked = records
      .filter((item) => !used.has(item.id))
      .map((item) => ({ item, score: scoreForSection(item, section) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
    const pick = ranked[0]?.item;
    if (!pick) continue;
    used.add(pick.id);
    result.push({ section, item: pick });
  }
  return result.slice(0, 8);
}

export function pageAnchorMetadata(anchors: Array<{ section: PageSectionSpec; item: UIComponentRecord }>) {
  return anchors.map(({ section, item }) => ({
    sectionId: section.id,
    sectionLabel: section.label,
    id: item.id,
    name: item.name,
    category: item.category,
    kind: item.kind || 'component',
    sourceId: item.sourceId,
    license: item.license,
    dependencies: item.dependencyRequirements || item.dependencies,
    tags: item.tags.slice(0, 8),
  }));
}

export function validatePageComposerPlan(project: CodeProjectContext, plan: CodePatchPlan): void {
  if (plan.operations.length > 12) throw new Error('Page composition exceeds the 12-file review limit.');
  if (plan.registryDependencies.length) throw new Error('Page composition must adapt registry anchors instead of leaving registry dependencies unresolved.');

  const existing = new Set(project.filePaths);
  for (const operation of plan.operations) {
    if (BACKEND_PATH.test(operation.path)) throw new Error(`Page composition attempted to modify backend/server path "${operation.path}".`);
    if (operation.type === 'create' && existing.has(operation.path)) throw new Error(`Page composition attempted to create existing file "${operation.path}".`);
    if (operation.type === 'replace') {
      const snapshot = project.files.find((file) => file.path === operation.path);
      if (!snapshot || snapshot.truncated) throw new Error(`Page composition cannot safely replace "${operation.path}" because its complete content is unavailable.`);
    }
  }
}
