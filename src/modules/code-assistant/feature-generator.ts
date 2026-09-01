import type { CodePatchPlan } from './patch-plan';
import type { CodeProjectContext } from './project-context';
import type { UIComponentCategory, UIComponentRecord } from './types';

export type FeatureKind = 'dashboard' | 'login' | 'settings' | 'ai-chat' | 'admin';

export interface FeaturePreset {
  id: FeatureKind;
  label: string;
  description: string;
  categories: UIComponentCategory[];
  keywords: string[];
  defaultGoal: string;
}

export const FEATURE_PRESETS: FeaturePreset[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Overview shell, metrics, navigation and responsive content states.',
    categories: ['dashboard', 'data', 'navigation', 'cards'],
    keywords: ['dashboard', 'analytics', 'stats', 'metric', 'chart', 'table', 'sidebar'],
    defaultGoal: 'Build a polished responsive dashboard feature using existing project data boundaries and style tokens.',
  },
  {
    id: 'login',
    label: 'Login',
    description: 'Sign-in UI, validation states and existing-auth integration boundary.',
    categories: ['authentication', 'forms', 'cards'],
    keywords: ['login', 'sign in', 'auth', 'password', 'otp', 'form'],
    defaultGoal: 'Build a complete sign-in feature that reuses existing authentication services when present and never invents a backend.',
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Settings shell, sections, form controls and save-state UX.',
    categories: ['forms', 'navigation', 'cards'],
    keywords: ['settings', 'preferences', 'profile', 'account', 'form', 'tabs'],
    defaultGoal: 'Build a responsive settings feature with clear sections, accessible controls and existing project persistence boundaries.',
  },
  {
    id: 'ai-chat',
    label: 'AI Chat',
    description: 'Conversation shell, composer, empty/loading/error states and service boundary.',
    categories: ['ai', 'forms', 'navigation', 'cards'],
    keywords: ['chat', 'assistant', 'prompt', 'message', 'composer', 'ai'],
    defaultGoal: 'Build an AI chat UI feature that reuses an existing AI service if present and otherwise exposes a clean adapter boundary without fake network logic.',
  },
  {
    id: 'admin',
    label: 'Admin',
    description: 'Admin navigation, overview, tables, filters and management states.',
    categories: ['dashboard', 'data', 'navigation', 'forms'],
    keywords: ['admin', 'management', 'users', 'table', 'filter', 'dashboard', 'sidebar'],
    defaultGoal: 'Build a production-minded admin feature with responsive navigation, management tables/forms and no invented privileged backend actions.',
  },
];

const BACKEND_PATH = /(?:^|\/)(?:api|server|backend|supabase|migrations?|functions?|edge-functions?)(?:\/|$)|(?:^|\/)route\.[cm]?[jt]s$/i;

function words(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2);
}

export function getFeaturePreset(kind: FeatureKind): FeaturePreset {
  return FEATURE_PRESETS.find((preset) => preset.id === kind) || FEATURE_PRESETS[0];
}

export function featureRegistryCandidates(
  records: UIComponentRecord[],
  kind: FeatureKind,
  max = 6,
): UIComponentRecord[] {
  const preset = getFeaturePreset(kind);
  const keywordSet = new Set(preset.keywords.flatMap(words));

  const score = (record: UIComponentRecord) => {
    let total = preset.categories.includes(record.category) ? 24 : 0;
    const haystack = words([record.name, record.description, ...record.tags].join(' '));
    for (const word of haystack) if (keywordSet.has(word)) total += 6;
    if ((record.kind || 'component') === 'block') total += 3;
    if (record.sourceId === 'private-session') total += 1;
    return total;
  };

  return records
    .map((record) => ({ record, score: score(record) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.record.name.localeCompare(b.record.name))
    .slice(0, max)
    .map((entry) => entry.record);
}

export function featureCandidateMetadata(items: UIComponentRecord[]) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    kind: item.kind || 'component',
    sourceId: item.sourceId,
    license: item.license,
    dependencies: item.dependencies,
    tags: item.tags.slice(0, 8),
  }));
}

export function validateFeaturePatchPlan(project: CodeProjectContext, plan: CodePatchPlan): void {
  if (plan.operations.length > 16) throw new Error('Feature plan exceeds the 16-file review limit.');
  if (plan.registryDependencies.length) {
    throw new Error('Feature plan must inline/adapt registry inspiration instead of leaving unresolved registry dependencies.');
  }

  const existingPaths = new Set(project.filePaths);
  for (const operation of plan.operations) {
    if (BACKEND_PATH.test(operation.path)) {
      throw new Error(`Feature plan attempted to modify backend/server path "${operation.path}".`);
    }
    if (operation.type === 'create' && existingPaths.has(operation.path)) {
      throw new Error(`Feature plan attempted to create an existing file "${operation.path}".`);
    }
    if (operation.type === 'replace') {
      const snapshot = project.files.find((file) => file.path === operation.path);
      if (!snapshot || snapshot.truncated) {
        throw new Error(`Feature plan cannot replace "${operation.path}" because the complete file was not available for review.`);
      }
    }
  }
}
