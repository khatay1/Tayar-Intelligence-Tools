import { mergeNpmDependencyRequirements } from './dependency-spec';
import { UIComponentRecord } from './types';

export interface RegistryDependencyResolution {
  resolved: UIComponentRecord[];
  unresolved: string[];
  npmDependencies: string[];
  npmDependencyRequirements: string[];
}

const MAX_RESOLVED_ITEMS = 16;
const MAX_DEPTH = 4;

function itemSlug(item: UIComponentRecord): string {
  const separator = item.id.indexOf(':');
  return separator >= 0 ? item.id.slice(separator + 1) : item.id;
}

function dependencySlug(reference: string): string {
  const value = reference.trim();
  if (!value) return '';
  try {
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);
      const last = url.pathname.split('/').filter(Boolean).pop() || '';
      return last.replace(/\.json$/i, '');
    }
  } catch {
    return '';
  }
  const clean = value.replace(/\.json$/i, '').replace(/^@/, '');
  const parts = clean.split('/').filter(Boolean);
  return parts[parts.length - 1] || clean;
}

function hintedSource(reference: string): string | null {
  const value = reference.toLowerCase();
  if (value.includes('ui.shadcn.com')) return 'shadcn';
  if (value.includes('magicui')) return 'magic-ui';
  if (value.includes('kokonut')) return 'kokonut-ui';
  if (value.includes('cult-ui') || value.includes('cultui')) return 'cult-ui';
  if (value.includes('8bit')) return '8bitcn';
  if (value.includes('eldora')) return 'eldora-ui';
  if (value.includes('ui-layout')) return 'ui-layouts';
  if (value.includes('spectrum')) return 'spectrum-ui';
  if (value.includes('shadcn-space') || value.includes('shadcnspace')) return 'shadcn-space';
  return null;
}

function findDependency(
  allItems: UIComponentRecord[],
  ownerSourceId: string,
  reference: string,
): UIComponentRecord | null {
  const slug = dependencySlug(reference);
  if (!slug) return null;

  const sourceHint = hintedSource(reference);
  const sourceOrder = Array.from(new Set([
    sourceHint,
    ownerSourceId,
    'shadcn',
  ].filter((value): value is string => Boolean(value))));

  for (const sourceId of sourceOrder) {
    const exact = allItems.find((item) => item.sourceId === sourceId && itemSlug(item) === slug);
    if (exact) return exact;
  }

  const global = allItems.filter((item) => itemSlug(item) === slug);
  return global.length === 1 ? global[0] : null;
}

export function resolveRegistryDependencies(
  allItems: UIComponentRecord[],
  root: UIComponentRecord,
): RegistryDependencyResolution {
  const resolved: UIComponentRecord[] = [];
  const unresolved = new Set<string>();
  const visited = new Set<string>([root.id]);
  const npmDependencies = new Set(root.dependencies);
  const npmRequirements: string[] = [...(root.dependencyRequirements || root.dependencies)];
  const queue: Array<{ item: UIComponentRecord; depth: number }> = [{ item: root, depth: 0 }];

  while (queue.length && resolved.length < MAX_RESOLVED_ITEMS) {
    const current = queue.shift()!;
    const references = current.item.remote?.registryDependencies || [];
    if (current.depth >= MAX_DEPTH) {
      references.forEach((reference) => unresolved.add(reference));
      continue;
    }

    for (const reference of references) {
      const dependency = findDependency(allItems, current.item.sourceId, reference);
      if (!dependency) {
        unresolved.add(reference);
        continue;
      }
      dependency.dependencies.forEach((name) => npmDependencies.add(name));
      npmRequirements.push(...(dependency.dependencyRequirements || dependency.dependencies));
      if (visited.has(dependency.id)) continue;
      visited.add(dependency.id);
      resolved.push(dependency);
      queue.push({ item: dependency, depth: current.depth + 1 });
      if (resolved.length >= MAX_RESOLVED_ITEMS) break;
    }
  }

  if (queue.length) {
    for (const pending of queue) {
      for (const reference of pending.item.remote?.registryDependencies || []) unresolved.add(reference);
    }
  }

  return {
    resolved,
    unresolved: Array.from(unresolved),
    npmDependencies: Array.from(npmDependencies),
    npmDependencyRequirements: mergeNpmDependencyRequirements(npmRequirements),
  };
}
