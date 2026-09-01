import type { CodePatchPlan } from './patch-plan';
import type { CodeProjectContext } from './project-context';
import { mergeNpmDependencyRequirements } from './dependency-spec';
import { resolveRegistryDependencies } from './registry-dependencies';
import type { UIComponentCategory, UIComponentRecord } from './types';

export type ComponentKitPresetId = 'landing-starter' | 'saas-dashboard' | 'auth-starter';

export interface ComponentKitPreset {
  id: ComponentKitPresetId;
  label: string;
  description: string;
  slots: Array<{ id: string; label: string; categories: UIComponentCategory[]; keywords: string[] }>;
}

export interface ComponentKitCompatibility {
  npmRequirements: string[];
  npmNames: string[];
  unresolvedRegistryDependencies: string[];
  resolvedRegistryIds: string[];
  duplicateIds: string[];
  frameworkWarnings: string[];
}

export const MAX_KIT_ITEMS = 6;

export const COMPONENT_KIT_PRESETS: ComponentKitPreset[] = [
  {
    id: 'landing-starter',
    label: 'Landing starter',
    description: 'Navigation, hero, feature/value block, pricing, FAQ/content and CTA.',
    slots: [
      { id: 'nav', label: 'Navigation', categories: ['navigation'], keywords: ['nav','navbar','header'] },
      { id: 'hero', label: 'Hero', categories: ['hero'], keywords: ['hero','landing'] },
      { id: 'features', label: 'Features', categories: ['cards','data'], keywords: ['feature','bento','benefit','grid'] },
      { id: 'pricing', label: 'Pricing', categories: ['pricing'], keywords: ['pricing','plan'] },
      { id: 'content', label: 'Content / FAQ', categories: ['cards','forms'], keywords: ['faq','accordion','content'] },
      { id: 'cta', label: 'CTA', categories: ['cta'], keywords: ['cta','call','action'] },
    ],
  },
  {
    id: 'saas-dashboard',
    label: 'SaaS dashboard',
    description: 'App navigation, overview metrics, dashboard content, data table/filter and AI/action panel.',
    slots: [
      { id: 'nav', label: 'Navigation', categories: ['navigation'], keywords: ['sidebar','navigation','menu'] },
      { id: 'overview', label: 'Overview', categories: ['dashboard','data'], keywords: ['dashboard','stats','metrics'] },
      { id: 'cards', label: 'Cards', categories: ['cards','data'], keywords: ['card','metric','overview'] },
      { id: 'data', label: 'Data', categories: ['data'], keywords: ['table','chart','data','filter'] },
      { id: 'form', label: 'Action form', categories: ['forms'], keywords: ['form','input','filter','search'] },
      { id: 'ai', label: 'AI / action', categories: ['ai','cta'], keywords: ['assistant','chat','prompt','action'] },
    ],
  },
  {
    id: 'auth-starter',
    label: 'Auth starter',
    description: 'Authentication shell, login form, secondary auth state and supporting CTA/content.',
    slots: [
      { id: 'auth', label: 'Auth shell', categories: ['authentication'], keywords: ['auth','login','sign'] },
      { id: 'form', label: 'Form', categories: ['forms','authentication'], keywords: ['form','input','password'] },
      { id: 'card', label: 'Support card', categories: ['cards'], keywords: ['card','panel','support'] },
      { id: 'cta', label: 'CTA', categories: ['cta'], keywords: ['cta','signup','register'] },
    ],
  },
];

function words(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2);
}

function scoreForSlot(item: UIComponentRecord, slot: ComponentKitPreset['slots'][number]): number {
  let total = slot.categories.includes(item.category) ? 28 : 0;
  const keywordSet = new Set(slot.keywords.flatMap(words));
  for (const word of words([item.name, item.description, ...item.tags].join(' '))) {
    if (keywordSet.has(word)) total += 7;
  }
  if ((item.kind || 'component') === 'block') total += 3;
  return total;
}

export function presetKitItems(records: UIComponentRecord[], presetId: ComponentKitPresetId): UIComponentRecord[] {
  const preset = COMPONENT_KIT_PRESETS.find((entry) => entry.id === presetId) || COMPONENT_KIT_PRESETS[0];
  const selected: UIComponentRecord[] = [];
  const used = new Set<string>();

  for (const slot of preset.slots) {
    const best = records
      .filter((item) => !used.has(item.id))
      .map((item) => ({ item, score: scoreForSlot(item, slot) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))[0]?.item;
    if (!best) continue;
    selected.push(best);
    used.add(best.id);
    if (selected.length >= MAX_KIT_ITEMS) break;
  }
  return selected;
}

export function analyzeComponentKit(
  allItems: UIComponentRecord[],
  selected: UIComponentRecord[],
  project: CodeProjectContext | null,
): ComponentKitCompatibility {
  const duplicateIds = Array.from(new Set(selected.map((item) => item.id).filter((id, index, ids) => ids.indexOf(id) !== index)));
  const npmRequirements: string[] = [];
  const npmNames = new Set<string>();
  const unresolved = new Set<string>();
  const resolvedIds = new Set<string>();
  const frameworkWarnings: string[] = [];

  for (const item of selected) {
    const resolution = resolveRegistryDependencies(allItems, item);
    resolution.npmDependencyRequirements.forEach((entry) => npmRequirements.push(entry));
    resolution.npmDependencies.forEach((entry) => npmNames.add(entry));
    resolution.unresolved.forEach((entry) => unresolved.add(entry));
    resolution.resolved.forEach((entry) => resolvedIds.add(entry.id));
  }

  if (project) {
    const framework = project.framework.toLowerCase();
    if (!framework.includes('react') && !framework.includes('next') && !framework.includes('remix')) {
      frameworkWarnings.push(`Selected registry kit is React-oriented while target framework is ${project.framework}.`);
    }
    if (selected.some((item) => item.tags.some((tag) => /next\.js|nextjs|next/i.test(tag))) && !framework.includes('next')) {
      frameworkWarnings.push('At least one selected item appears Next.js-specific but the target project is not detected as Next.js.');
    }
  }

  return {
    npmRequirements: mergeNpmDependencyRequirements(npmRequirements),
    npmNames: Array.from(npmNames),
    unresolvedRegistryDependencies: Array.from(unresolved),
    resolvedRegistryIds: Array.from(resolvedIds),
    duplicateIds,
    frameworkWarnings,
  };
}

export function kitMetadata(items: UIComponentRecord[]) {
  return items.map((item) => ({
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

export function validateComponentKitPlan(
  project: CodeProjectContext,
  compatibility: ComponentKitCompatibility,
  plan: CodePatchPlan,
): void {
  if (plan.operations.length > 14) throw new Error('Component kit plan exceeds the 14-file review limit.');
  if (compatibility.duplicateIds.length) throw new Error('Component kit contains duplicate component IDs.');
  if (compatibility.unresolvedRegistryDependencies.length) throw new Error('Resolve all registry dependencies before composing this kit.');
  if (plan.registryDependencies.length) throw new Error('Component kit patch may not leave registry dependencies unresolved.');

  const existing = new Set(project.filePaths);
  for (const operation of plan.operations) {
    if (operation.type === 'create' && existing.has(operation.path)) {
      throw new Error(`Component kit attempted to create existing file "${operation.path}".`);
    }
    if (operation.type === 'replace') {
      const snapshot = project.files.find((file) => file.path === operation.path);
      if (!snapshot || snapshot.truncated) {
        throw new Error(`Component kit cannot replace "${operation.path}" because its complete file is unavailable.`);
      }
    }
  }
}
