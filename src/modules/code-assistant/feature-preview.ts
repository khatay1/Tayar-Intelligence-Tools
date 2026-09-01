import { buildIsolatedLivePreview, type LivePreviewResult } from './live-preview';
import type { CodePatchOperation, CodePatchPlan } from './patch-plan';
import type { UIComponentCategory, UIComponentRecord } from './types';

export interface FeaturePreviewFile {
  path: string;
  mode: 'create' | 'replace';
  role: 'page' | 'component' | 'style' | 'hook' | 'service' | 'types' | 'other';
}

export interface FeaturePreviewModel {
  primaryPath: string | null;
  creates: number;
  replaces: number;
  routeHints: string[];
  files: FeaturePreviewFile[];
}

function roleFor(path: string): FeaturePreviewFile['role'] {
  if (/(?:^|\/)(?:page|index)\.[cm]?[jt]sx?$/.test(path) || /(?:^|\/)pages?\//.test(path)) return 'page';
  if (/\.(?:css|scss|sass|less)$/.test(path)) return 'style';
  if (/(?:^|\/)hooks?\//.test(path) || /use[A-Z][\w-]*\.[cm]?[jt]s$/.test(path)) return 'hook';
  if (/(?:service|adapter|client|repository)\.[cm]?[jt]s$/.test(path)) return 'service';
  if (/(?:types?|models?)\.[cm]?[jt]s$/.test(path) || /\.d\.ts$/.test(path)) return 'types';
  if (/\.[cm]?[jt]sx$/.test(path)) return 'component';
  return 'other';
}

function routeHint(path: string): string | null {
  const appMatch = path.match(/(?:^|\/)app\/(.+?)\/page\.[cm]?[jt]sx?$/);
  if (appMatch) {
    const route = appMatch[1].split('/').filter((part) => !/^\(.+\)$/.test(part)).join('/');
    return '/' + route.replace(/\[([^\]]+)\]/g, ':$1');
  }
  const pageMatch = path.match(/(?:^|\/)pages\/(.+?)\.[cm]?[jt]sx?$/);
  if (pageMatch) {
    const route = pageMatch[1].replace(/\/index$/, '');
    return '/' + route.replace(/\[([^\]]+)\]/g, ':$1');
  }
  return null;
}

function primaryScore(operation: CodePatchOperation): number {
  const path = operation.path.toLowerCase();
  let score = 0;
  if (/\/page\.[jt]sx?$/.test(path)) score += 80;
  if (/\/index\.[jt]sx?$/.test(path)) score += 60;
  if (/dashboard|login|settings|chat|admin/.test(path)) score += 30;
  if (/\.[jt]sx$/.test(path)) score += 10;
  if (/component|card|button|input|hook|types?/.test(path)) score -= 10;
  return score;
}

function categoryForOwner(ownerId: string): UIComponentCategory {
  if (ownerId.includes('pricing')) return 'pricing';
  if (ownerId.includes('landing') || ownerId.includes('saas')) return 'hero';
  if (ownerId.includes('login')) return 'authentication';
  if (ownerId.includes('ai-chat')) return 'ai';
  if (ownerId.includes('dashboard') || ownerId.includes('admin')) return 'dashboard';
  if (ownerId.includes('settings')) return 'forms';
  return 'cards';
}

export function buildFeaturePreviewModel(plan: CodePatchPlan | null, ownerId: string): FeaturePreviewModel | null {
  if (!plan || (!ownerId.startsWith('feature:') && !ownerId.startsWith('page:'))) return null;
  const files = plan.operations.map((operation) => ({
    path: operation.path,
    mode: operation.type,
    role: roleFor(operation.path),
  }));
  const primary = [...plan.operations].sort((a, b) => primaryScore(b) - primaryScore(a))[0] || null;
  return {
    primaryPath: primary?.path || null,
    creates: plan.operations.filter((operation) => operation.type === 'create').length,
    replaces: plan.operations.filter((operation) => operation.type === 'replace').length,
    routeHints: Array.from(new Set(plan.operations.map((operation) => routeHint(operation.path)).filter((value): value is string => Boolean(value)))).slice(0, 8),
    files,
  };
}

export function buildFeaturePrimaryLivePreview(plan: CodePatchPlan, ownerId: string): LivePreviewResult {
  const operation = [...plan.operations].sort((a, b) => primaryScore(b) - primaryScore(a))[0];
  if (!operation || !/\.[cm]?[jt]sx$/.test(operation.path)) {
    return { supported: false, reason: 'No renderable TSX/JSX primary file was found in this feature pack.' };
  }

  const item: UIComponentRecord = {
    id: `feature-preview:${operation.path}`,
    name: operation.path.split('/').pop() || 'Feature preview',
    description: 'Generated feature primary file preview.',
    category: categoryForOwner(ownerId),
    kind: 'block',
    tags: ['feature', 'generated', 'preview'],
    sourceId: 'tayar-native',
    license: 'Tayar',
    dependencies: plan.dependenciesToInstall,
    code: operation.content,
    preview: 'generic',
    aiPrompt: '',
  };
  return buildIsolatedLivePreview(item, operation.content);
}
